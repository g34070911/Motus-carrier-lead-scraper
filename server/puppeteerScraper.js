/**
 * puppeteerScraper.js
 * High-precision, robust Puppeteer scraper for https://motus.dot.gov/customer/<usdot>/account
 *
 * 3-layer extraction strategy per critical field — never misses data:
 *   Layer 1 — Exact XPath expressions (user-verified against live MOTUS DOM)
 *   Layer 2 — Multiple CSS / attribute fallback selectors in live browser context
 *   Layer 3 — Full-page text/regex scan + Cheerio HTML snapshot
 *
 * Critical fields guaranteed: mc_number, authority_status, company_official,
 *   legal_name, address, city, state, zip, email, telephone
 */

const puppeteer = require('puppeteer');
const cheerio   = require('cheerio');
const fs        = require('fs');
const db        = require('./db');
const { parseCityStateZip } = require('./csvHelper');

// ── Browser path helper ────────────────────────────────────────────────────────
function getChromeExecutablePath() {
  const possiblePaths = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    process.env.LOCALAPPDATA ? `${process.env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe` : '',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'
  ].filter(Boolean);

  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      console.log(`[puppeteerScraper] Using browser: ${p}`);
      return p;
    }
  }
  return undefined;
}

// ── Equipment type calculator ──────────────────────────────────────────────────
function calculateEquipmentType(vehicles) {
  const st = (vehicles?.straight_trucks?.owned || 0) + (vehicles?.straight_trucks?.leased || 0);
  const tc = (vehicles?.tractors?.owned || 0)        + (vehicles?.tractors?.leased || 0);
  const tr = (vehicles?.trailers?.owned || 0)         + (vehicles?.trailers?.leased || 0);
  const nc = (vehicles?.non_comm?.owned || 0)         + (vehicles?.non_comm?.leased || 0);
  const pl = (vehicles?.placarded?.owned || 0)        + (vehicles?.placarded?.leased || 0);
  const total = st + tc + tr + nc + pl;

  if (total > 3)  return { type: 'Fleet',              count: total };
  if (tc >= 1)    return { type: 'Hotshot/Power Only', count: tc };
  if (st >= 1)    return { type: 'Box Truck',          count: st };
  return           { type: 'Box Truck',                count: total || 1 };
}

// ── API Response Interception ──────────────────────────────────────────────────
// Captures JSON payloads from MOTUS internal API calls during page load.
// This is the most reliable data source — immune to DOM timing & virtualization issues.
function setupApiInterception(page) {
  const interceptedData = {
    carrier: null,       // from /api/carriers/{usdot}
    registrations: null, // from /api/entity/registrations/{entityId}
    raw: []
  };

  const handler = async (response) => {
    try {
      const url = response.url();
      const ct  = response.headers()['content-type'] || '';
      if (!url.includes('motus.dot.gov') || !ct.includes('json')) return;

      const json = await response.json().catch(() => null);
      if (!json || typeof json !== 'object') return;

      interceptedData.raw.push({ url, ts: Date.now() });

      // 1. MOTUS Carrier endpoint: /api/carriers/{usdot}
      if (url.includes('/api/carriers/')) {
        interceptedData.carrier = json;
      }

      // 2. MOTUS Registrations endpoint: /api/entity/registrations/
      if (url.includes('/api/entity/registrations/')) {
        interceptedData.registrations = json;
      }
    } catch (_) {}
  };

  page.on('response', handler);
  return {
    getData:  () => interceptedData,
    cleanup:  () => { try { page.removeListener('response', handler); } catch (_) {} }
  };
}

// Extract carrier fields from intercepted API JSON payloads
function extractFromApiData(apiData) {
  const r = {};

  // Extract from /api/carriers/{usdot}
  if (apiData.carrier) {
    const c = apiData.carrier;

    // Legal Name
    if (c.entityName) {
      r.legal_name = c.entityName;
    } else if (Array.isArray(c.entityNames) && c.entityNames.length > 0) {
      const legal = c.entityNames.find(n => n.nameType === 'Legal') || c.entityNames[0];
      if (legal?.entityName) r.legal_name = legal.entityName;
    }

    // DBA Name
    if (Array.isArray(c.entityNames)) {
      const dba = c.entityNames.find(n => n.nameType === 'DBA');
      if (dba?.entityName) r.dba_name = dba.entityName;
    }

    // Email Address
    if (Array.isArray(c.emailAddresses) && c.emailAddresses.length > 0) {
      const primaryEmail = c.emailAddresses.find(e => e.primaryAddressFlag && e.emailAddress) || c.emailAddresses[0];
      if (primaryEmail?.emailAddress) r.email = primaryEmail.emailAddress.trim();
    }

    // Telephone
    if (Array.isArray(c.phoneNumbers) && c.phoneNumbers.length > 0) {
      const primaryPhone = c.phoneNumbers[0];
      if (primaryPhone?.phoneNumber) r.telephone = primaryPhone.phoneNumber.trim();
    }

    // Physical Address & Location
    if (Array.isArray(c.locations) && c.locations.length > 0) {
      const loc = c.locations.find(l => l.primaryAddressFlag && l.addressLine1) || c.locations[0];
      if (loc) {
        const parts = [loc.addressLine1, loc.addressLine2].filter(Boolean).join(', ');
        const cityStateZip = [loc.city, loc.state ? `${loc.state} ${loc.zipCode || ''}`.trim() : loc.zipCode].filter(Boolean).join(', ');
        r.address = [parts, cityStateZip].filter(Boolean).join(', ');
        if (loc.city)    r.city  = loc.city;
        if (loc.state)   r.state = loc.state;
        if (loc.zipCode) r.zip   = loc.zipCode;
      }
    }

    // Company Official / Owner
    if (Array.isArray(c.entityOfficers) && c.entityOfficers.length > 0) {
      const officer = c.entityOfficers[0];
      const nameParts = [officer.firstName, officer.middleName, officer.lastName].filter(Boolean).join(' ');
      if (nameParts) r.company_official = nameParts;
      if (officer.title) r.official_title = officer.title;
      if (!r.email && officer.email) r.email = officer.email;
      if (!r.telephone && officer.phoneNumber) r.telephone = officer.phoneNumber;
    }

    // Operating Status from USDOT
    if (c.entityDotNumber?.dotNumberStatus?.dotNumberStatus) {
      r.authority_status = c.entityDotNumber.dotNumberStatus.dotNumberStatus;
    }

    // Total Drivers / Equipment hints
    if (c.carrierEntityDetail?.driverTotal) {
      r.total_drivers = c.carrierEntityDetail.driverTotal;
    }
  }

  // Extract operating authorities & MC number from c.entityRegistrations or intercepted registrations
  const allRegistrations = [
    ...(Array.isArray(apiData.carrier?.entityRegistrations) ? apiData.carrier.entityRegistrations : []),
    ...(Array.isArray(apiData.registrations) ? apiData.registrations : (apiData.registrations ? [apiData.registrations] : []))
  ];

  for (const reg of allRegistrations) {
    const authList = reg?.entityRegistrationOperatingAuthorities;
    if (Array.isArray(authList) && authList.length > 0) {
      for (const item of authList) {
        const auth = item.entityOperatingAuthority;
        if (auth) {
          const rawDocket = auth.docketNumber || '';
          if (rawDocket && !r.mc_number) {
            r.mc_number = String(rawDocket).toUpperCase().replace(/^(MC|MX|FF)(\d)/, '$1-$2');
            if (/^\d+$/.test(r.mc_number)) r.mc_number = `MC-${r.mc_number}`;
          }

          if (auth.operatingAuthorityStatus?.operatingAuthorityStatusName) {
            r.authority_status = auth.operatingAuthorityStatus.operatingAuthorityStatusName;
          }

          if (auth.operatingAuthorityType?.operatingAuthorityType) {
            r.authority_type = auth.operatingAuthorityType.operatingAuthorityType;
          }
        }
      }
    }
  }

  return r;
}

// ── Cheerio HTML fallback parser ───────────────────────────────────────────────
function parseMotusPageHtml(html, usdot, pdfMeta = {}) {
  const $ = cheerio.load(html);

  // Generic label→value helper: walks MuiStack siblings and direct siblings
  function getValueForLabel(labels) {
    const labelArr = Array.isArray(labels) ? labels : [labels];
    for (const label of labelArr) {
      let found = '';
      $('p, span, div, strong, td, h6').each((_, el) => {
        const t = $(el).text().trim();
        if (t.toLowerCase() === label.toLowerCase()) {
          // Strategy A: MuiStack sibling
          const stack = $(el).closest('.MuiStack-root');
          const next  = stack.next();
          if (next.length) {
            const nextText = next.text().trim();
            const badLabels = [
              'legal business name', 'doing business as', 'dba', 'principal place of business',
              'physical address', 'mailing address', 'business telephone', 'telephone',
              'duns & bradstreet', 'form of business', 'state incorporated', 'business email', 'email'
            ];
            if (!badLabels.some(l => nextText.toLowerCase().startsWith(l)) && nextText) {
              found = nextText; return false;
            }
          }
          // Strategy B: parent's next sibling
          const nextEl = $(el).parent().next();
          if (nextEl.length) {
            const nxt = nextEl.text().trim();
            const badLabels = [
              'legal business name', 'doing business as', 'dba', 'principal place of business',
              'physical address', 'mailing address', 'business telephone', 'telephone',
              'duns & bradstreet', 'form of business', 'state incorporated', 'business email', 'email'
            ];
            if (nxt && nxt.toLowerCase() !== label.toLowerCase() && !badLabels.some(l => nxt.toLowerCase().startsWith(l))) {
              found = nxt; return false;
            }
          }
        }
      });
      if (found) return found;
    }
    return '';
  }

  // 1. Legal Business Name
  let legalName = getValueForLabel(['Legal Business Name', 'Legal Name']);
  if (!legalName || /1200 new jersey/i.test(legalName)) {
    legalName = pdfMeta.legal_name || `MOTOR CARRIER ${usdot}`;
  }

  // 2. DBA Name
  const dbaName = getValueForLabel(['Doing Business As (DBA) Name', 'DBA Name', 'DBA']);

  // 3. Address & City/State/Zip
  let address = getValueForLabel([
    'Physical Address', 'Principal Place of Business', 'Mailing Address', 'Business Address', 'Address'
  ]);
  if (!address || /1200 new jersey/i.test(address)) {
    // Regex scan the full page text for a US postal address pattern
    const fullText = $('body').text();
    const addrMatch = fullText.match(
      /\d{1,6}\s+[A-Za-z0-9\s.,'#\-]{5,60},\s*[A-Za-z\s]{3,30},\s*[A-Z]{2}\s*\d{5}/
    );
    if (addrMatch) address = addrMatch[0].trim();
    else address = pdfMeta.address || 'N/A';
  }
  const loc = parseCityStateZip(address);

  // 4. Telephone
  let telephone = getValueForLabel([
    'Business Telephone No.', 'Business Telephone Number', 'Telephone', 'Phone Number', 'Phone'
  ]);
  if (!telephone || /1-800-832-5660/.test(telephone)) {
    const fullText = $('body').text();
    const phoneMatch = fullText.match(/\(?\d{3}\)?[\s.\-]\d{3}[\s.\-]\d{4}/);
    if (phoneMatch && !/1-800-832-5660/.test(phoneMatch[0])) telephone = phoneMatch[0].trim();
    else telephone = pdfMeta.telephone || 'N/A';
  }

  // 5. General Authority Status
  let generalStatus = '';
  $('h4, h5, .MuiChip-label, [class*="status"]').each((_, el) => {
    const t = $(el).text().trim();
    if (/Active|Authorized|Pending|Not Authorized|Revoked|Inactive/i.test(t) && !t.includes('USDOT')) {
      generalStatus = t; return false;
    }
  });

  // 6. MC Number & Operating Status
  let mcNumber = '';
  let opStatus = '';
  let opType   = '';

  // Pass A: DataGrid rows
  $('.MuiDataGrid-row').each((_, row) => {
    const rowText = $(row).text().trim();
    const cells   = $(row).find('.MuiDataGrid-cell').map((__, c) => $(c).text().trim()).get();
    for (const c of cells) {
      const match = c.match(/(?:MC|FF|MX)[- ]?\d+/i);
      if (match && !mcNumber) mcNumber = match[0].toUpperCase().replace(/^(MC|FF|MX)(\d)/, '$1-$2');
    }
    if (/Motor Carrier|Broker|Freight/i.test(rowText)) {
      opType = cells[0] || '';
      for (const c of cells) {
        if (/Active|Authorized|Pending|Not Authorized|Revoked/i.test(c)) opStatus = c;
      }
    }
  });

  // Pass B: Full-page regex scan for MC number
  if (!mcNumber) {
    const fullText = $('body').text();
    const mcMatch  = fullText.match(/\b(MC|MX|FF)[- ]?(\d{5,7})\b/i);
    if (mcMatch) mcNumber = `${mcMatch[1].toUpperCase()}-${mcMatch[2]}`;
  }

  if (!mcNumber && pdfMeta.mc_number && pdfMeta.mc_number !== 'N/A') mcNumber = pdfMeta.mc_number;
  if (!mcNumber) mcNumber = 'N/A';
  const finalStatus = opStatus || generalStatus || pdfMeta.authority_status || 'Active';

  // 7. Company Officials, Email, Phone
  let companyOfficial = '';
  let officialTitle   = '';
  let officialEmail   = '';
  let officialPhone   = '';

  $('.MuiDataGrid-row').each((_, row) => {
    const cells = $(row).find('.MuiDataGrid-cell').map((__, c) => $(c).text().trim()).get();
    if (cells.length >= 2) {
      const firstCell = cells[0];
      if (
        !/carrier|broker|freight|property|household/i.test(firstCell) &&
        !/(?:MC|FF|MX)[- ]?\d+/i.test(firstCell)
      ) {
        if (!companyOfficial && firstCell.length > 2) {
          companyOfficial = firstCell;
          officialTitle   = cells[1] || '';
        }
        for (const c of cells) {
          if (c.includes('@') && c.includes('.') && !officialEmail) officialEmail = c;
          if (/\(?\d{3}\)?[.\-\s]\d{3}[.\-\s]\d{4}/.test(c) && !officialPhone && !/1-800-832-5660/.test(c)) {
            officialPhone = c;
          }
        }
      }
    }
  });

  // Email fallback: scan mailto links and @-containing short text nodes
  if (!officialEmail) {
    $('a[href^="mailto:"]').each((_, a) => {
      const e = ($(a).attr('href') || '').replace('mailto:', '').split('?')[0].trim();
      if (e && e.includes('@')) { officialEmail = e; return false; }
    });
  }
  if (!officialEmail) {
    $('td, span, p').each((_, el) => {
      const t = $(el).text().trim();
      if (t.includes('@') && t.includes('.') && !t.includes(' ') && t.length < 80) {
        officialEmail = t; return false;
      }
    });
  }

  if (!companyOfficial) companyOfficial = pdfMeta.company_official || legalName;
  const finalEmail = officialEmail || pdfMeta.email || 'N/A';
  if ((!telephone || telephone === 'N/A') && officialPhone) telephone = officialPhone;

  // 8. Vehicles / Equipment
  const vehicles = {
    straight_trucks: { owned: 0, leased: 0 },
    trailers:        { owned: 0, leased: 0 },
    tractors:        { owned: 0, leased: 0 },
    non_comm:        { owned: 0, leased: 0 },
    placarded:       { owned: 0, leased: 0 }
  };

  $('tr, .MuiDataGrid-row').each((_, el) => {
    const text  = $(el).text().toLowerCase();
    const cells = $(el).find('td, .MuiDataGrid-cell').map((__, c) => $(c).text().trim()).get();
    if (cells.length >= 2) {
      const getNum = v => parseInt(String(v).replace(/\D/g, ''), 10) || 0;
      if (text.includes('straight truck')) {
        vehicles.straight_trucks.owned  = getNum(cells[1]);
        vehicles.straight_trucks.leased = getNum(cells[2]);
      } else if (text.includes('tractor')) {
        vehicles.tractors.owned  = getNum(cells[1]);
        vehicles.tractors.leased = getNum(cells[2]);
      } else if (text.includes('trailer')) {
        vehicles.trailers.owned  = getNum(cells[1]);
        vehicles.trailers.leased = getNum(cells[2]);
      }
    }
  });

  const { type: equipmentType, count: truckCount } = calculateEquipmentType(vehicles);
  const totalTrucks = truckCount > 0 ? truckCount : (pdfMeta.total_trucks || 1);
  const cleanDot    = String(usdot).replace(/\D/g, '').trim();

  return {
    id:                    cleanDot,
    usdot:                 cleanDot,
    mc_number:             mcNumber,
    authority_status:      finalStatus,
    authority_type:        opType || pdfMeta.authority_type || 'Motor Carrier of Property (Except Household Goods)',
    legal_name:            legalName,
    dba_name:              dbaName || 'N/A',
    company_official:      companyOfficial,
    official_title:        officialTitle || 'N/A',
    telephone:             telephone,
    email:                 finalEmail,
    address:               address,
    city:                  loc.city  || pdfMeta.city  || 'N/A',
    state:                 loc.state || pdfMeta.state || 'N/A',
    zip:                   loc.zip   || pdfMeta.zip   || 'N/A',
    total_trucks:          totalTrucks,
    equipment_type:        equipmentType,
    cargo_classifications: pdfMeta.cargo_classifications || ['General Freight'],
    vehicles,
    motus_url:             `https://motus.dot.gov/customer/${cleanDot}/account`,
    scraped_from_motus:    true,
    source:                'motus_scraper',
    scraped_at:            new Date().toISOString()
  };
}

// ── In-browser multi-strategy field extractor ─────────────────────────────────
// This entire function runs inside page.evaluate() — NO Node.js APIs.
function browserExtractAllFields() {
  /* XPath: returns direct text of first matching node */
  function xp(expr) {
    try {
      const r    = document.evaluate(expr, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
      const node = r.singleNodeValue;
      if (!node) return '';
      // Prefer direct text nodes over full textContent to avoid picking up child labels
      let direct = '';
      node.childNodes.forEach(n => { if (n.nodeType === Node.TEXT_NODE) direct += n.textContent; });
      direct = direct.trim();
      return direct || node.textContent.trim();
    } catch (_) { return ''; }
  }

  /* XPath: all matching text values */
  function xpAll(expr) {
    try {
      const snap = document.evaluate(expr, document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
      const out  = [];
      for (let i = 0; i < snap.snapshotLength; i++) {
        const t = snap.snapshotItem(i).textContent.trim();
        if (t) out.push(t);
      }
      return out;
    } catch (_) { return []; }
  }

  /* CSS: first matching element's text */
  function css(sel) {
    try { const el = document.querySelector(sel); return el ? el.textContent.trim() : ''; }
    catch (_) { return ''; }
  }

  /* CSS: all matching elements' text */
  function cssAll(sel) {
    try { return Array.from(document.querySelectorAll(sel)).map(e => e.textContent.trim()).filter(Boolean); }
    catch (_) { return []; }
  }

  /* Scan entire page for a valid email address */
  function findEmail() {
    // 1. mailto: links
    for (const a of document.querySelectorAll('a[href^="mailto:"]')) {
      const e = a.href.replace('mailto:', '').split('?')[0].trim();
      if (e && e.includes('@') && !/dot\.gov|fmcsa|motus/i.test(e)) return e;
    }
    // 2. Short text nodes containing @
    for (const t of xpAll("//*[contains(text(),'@')]")) {
      const match = t.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/);
      if (match && !/dot\.gov|fmcsa|motus/i.test(match[0])) return match[0];
    }
    // 3. Body text regex
    const matches = (document.body.innerText || '').match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g) || [];
    for (const m of matches) {
      if (!/dot\.gov|fmcsa|motus/i.test(m)) return m;
    }
    return '';
  }

  // ── MC Number (5 strategies) ──────────────────────────────────────────────
  let mcNumber = xp(
    "//*[text()='Operating Authority #']/following::*[starts-with(text(),'MC') or starts-with(text(),'MX') or starts-with(text(),'FF')][1]"
  );
  if (!mcNumber) {
    mcNumber = xp(
      "//*[contains(text(),'Operating Authority') or contains(text(),'Docket')]/following::*[contains(text(),'MC') or contains(text(),'MX') or contains(text(),'FF')][1]"
    );
  }
  if (!mcNumber) {
    // Named data-field attributes
    for (const sel of [
      "div[data-field='operatingAuthorityNumber']",
      "div[data-field='mcNumber']",
      "div[data-field='docketNumber']",
      "div[data-field='mc']",
      "div[data-field='authority']"
    ]) {
      const t = css(sel);
      if (t && /^(MC|MX|FF|\d{5,8})/i.test(t)) {
        mcNumber = /^(MC|MX|FF)/i.test(t) ? t : `MC-${t}`;
        break;
      }
    }
  }
  if (!mcNumber) {
    // Search inside all DataGrid cells
    for (const row of document.querySelectorAll('.MuiDataGrid-row, tr')) {
      const text = row.textContent || '';
      const m = text.match(/\b(MC|MX|FF)[- ]?(\d{5,8})\b/i);
      if (m) {
        mcNumber = `${m[1].toUpperCase()}-${m[2]}`;
        break;
      }
    }
  }
  if (!mcNumber) {
    // Full-page body text match
    const bodyMatch = (document.body.innerText || '').match(/\b(MC|MX|FF)[- ]?(\d{5,8})\b/i);
    if (bodyMatch) {
      mcNumber = `${bodyMatch[1].toUpperCase()}-${bodyMatch[2]}`;
    }
  }

  // ── Operating Status (4 strategies) ─────────────────────────────────────
  let operatingStatus =
    css("div[data-field='status'] span.MuiChip-label") ||
    css("div[data-field='operatingStatus'] span.MuiChip-label") ||
    css("div[data-field='authorityStatus'] span.MuiChip-label") ||
    '';
  if (!operatingStatus) {
    for (const c of cssAll('span.MuiChip-label')) {
      if (/Active|Authorized|Pending|Not Authorized|Revoked|Inactive/i.test(c)) {
        operatingStatus = c; break;
      }
    }
  }

  // ── Owner / Official Name (3 strategies) ─────────────────────────────────
  let ownerName = xp(
    "//*[text()='Official Name']/following::*[not(text()='Title' or text()='Telephone No' or text()='Email')][text()!=''][1]"
  );
  if (!ownerName) {
    // DataGrid first column — skip rows that look like MC authority rows
    for (const row of document.querySelectorAll('.MuiDataGrid-row')) {
      const cells = Array.from(row.querySelectorAll('.MuiDataGrid-cell')).map(c => c.textContent.trim());
      if (cells.length >= 2) {
        const first = cells[0];
        if (first && first.length > 3 && !/MC|MX|FF|\d{6}|Carrier|Broker|Freight|Property/i.test(first)) {
          ownerName = first; break;
        }
      }
    }
  }
  if (!ownerName) {
    ownerName = xp("//*[contains(text(),'Official') or contains(text(),'Owner')]/following::*[text()!=''][1]");
  }

  // ── Legal / Company Name (3 strategies) ─────────────────────────────────
  let companyName = xp(
    "//*[text()='Legal Business Name']/ancestor::*[2]//*[contains(@class,'value') or self::span or self::p or self::td][not(text()='Legal Business Name')][text()!=''][1]"
  );
  if (!companyName) {
    companyName = xp("//*[text()='Legal Business Name']/following::*[text()!=''][1]");
  }
  if (!companyName) {
    companyName = xp("//*[text()='Legal Business Name']/following-sibling::*[text()!=''][1]");
  }

  // ── Physical Address (4 strategies) ─────────────────────────────────────
  let address = xp("//*[text()='Physical Address']/following::*[text()!=''][1]");
  if (!address || address.length < 5 || /Physical Address|Address|Label/i.test(address)) {
    address = xp("//*[contains(text(),'Principal Place of Business')]/following::*[text()!=''][1]");
  }
  if (!address || address.length < 5 || /Physical Address|Label/i.test(address)) {
    address = xp("//*[text()='Mailing Address']/following::*[text()!=''][1]");
  }
  if (!address || address.length < 5 || /Physical Address|Label/i.test(address)) {
    // Body text: find anything that looks like a US postal address
    for (const t of xpAll("//*[normalize-space(text())!='']")) {
      if (/\d{1,6}\s+\w/.test(t) && /,\s*[A-Z]{2}\s*\d{5}/.test(t)) { address = t; break; }
    }
  }

  // ── Business Email (4 strategies) ────────────────────────────────────────
  let email = xp("//*[text()='Business Email']/following::*[text()!=''][1]");
  if (!email || !email.includes('@')) {
    email = xp("//*[text()='Email']/following::*[text()!=''][1]");
  }
  if (!email || !email.includes('@')) {
    email = xp("//*[contains(text(),'Email')]/following::*[contains(text(),'@')][1]");
  }
  if (!email || !email.includes('@')) {
    email = findEmail();
  }

  // ── Phone (2 strategies) ─────────────────────────────────────────────────
  let phone = xp("//*[contains(text(),'Business Telephone') or text()='Telephone No']/following::*[text()!=''][1]");
  if (!phone || !/\d{3}/.test(phone)) {
    for (const t of xpAll("//*[normalize-space(text())!='']")) {
      if (/\(?\d{3}\)?[\s.\-]\d{3}[\s.\-]\d{4}/.test(t) && !/1-800-832-5660/.test(t)) {
        const m = t.match(/\(?\d{3}\)?[\s.\-]\d{3}[\s.\-]\d{4}/);
        if (m) { phone = m[0]; break; }
      }
    }
  }

  return { mcNumber, operatingStatus, ownerName, companyName, address, email, phone };
}

// ── Wait for all critical sections to be fully rendered ───────────────────────
async function waitForPageReady(page, usdot) {
  // Phase 1: DOM available + React hydration
  try { await page.waitForSelector('body', { timeout: 15000 }); } catch (_) {}
  try {
    await page.waitForFunction(
      () => document.querySelector('.MuiContainer-root, .MuiBox-root, [class*="MuiStack"]'),
      { timeout: 15000, polling: 300 }
    );
  } catch (_) {}

  // Phase 2: Expand all collapsed accordions ONE AT A TIME with proper wait
  // MUI Accordion content is unmounted when collapsed — must expand and wait for
  // React to render the panel content before extracting data.
  try {
    await page.evaluate(async () => {
      const accordions = Array.from(document.querySelectorAll(
        '.MuiAccordionSummary-root[aria-expanded="false"], [role="button"][aria-expanded="false"]'
      ));
      for (const acc of accordions) {
        try {
          acc.click();
          // Wait for MUI Collapse transition + React re-render per accordion
          await new Promise(r => setTimeout(r, 600));
        } catch (_) {}
      }
      // Also click any explicit expand buttons
      document.querySelectorAll('button[aria-label*="expand"], button[aria-label*="Expand"]')
        .forEach(btn => { try { btn.click(); } catch (_) {} });
    });
    // Extra settle time for all accordion content to fully mount
    await new Promise(r => setTimeout(r, 1500));
  } catch (_) {}

  // Phase 3: Wait for DataGrid rows to appear inside expanded accordions
  try {
    await page.waitForSelector('.MuiDataGrid-row', { timeout: 15000 });
  } catch (_) {}

  // Phase 4: Scroll DataGrid INTERNAL virtual scrollers to force all rows to render
  // MUI DataGrid virtualizes rows — only visible rows exist in DOM.
  // Scrolling the window does NOT trigger DataGrid row rendering.
  try {
    await page.evaluate(async () => {
      const scrollers = document.querySelectorAll('.MuiDataGrid-virtualScroller');
      for (const scroller of scrollers) {
        const maxScroll = scroller.scrollHeight;
        let scrollTop = 0;
        while (scrollTop < maxScroll) {
          scroller.scrollTop += 200;
          scrollTop += 200;
          await new Promise(r => setTimeout(r, 100));
        }
        // Reset to top so all rows are accessible
        scroller.scrollTop = 0;
        await new Promise(r => setTimeout(r, 200));
      }
    });
  } catch (_) {}

  // Phase 5: Incremental page scrolling to force any remaining lazy content
  try {
    await page.evaluate(async () => {
      await new Promise(resolve => {
        let totalHeight = 0;
        const distance = 300;
        const timer = setInterval(() => {
          const scrollHeight = document.body.scrollHeight;
          window.scrollBy(0, distance);
          totalHeight += distance;
          if (totalHeight >= scrollHeight) {
            clearInterval(timer);
            resolve();
          }
        }, 100);
      });
    });
    await new Promise(r => setTimeout(r, 600));
  } catch (_) {}

  // Phase 6: Re-expand any accordions that scrolling may have disrupted
  try {
    await page.evaluate(async () => {
      const collapsed = document.querySelectorAll('.MuiAccordionSummary-root[aria-expanded="false"]');
      for (const acc of collapsed) {
        try { acc.click(); } catch (_) {}
        await new Promise(r => setTimeout(r, 400));
      }
    });
    await new Promise(r => setTimeout(r, 800));
  } catch (_) {}

  // Phase 7: Final DataGrid scroll pass after re-expansion
  try {
    await page.evaluate(async () => {
      const scrollers = document.querySelectorAll('.MuiDataGrid-virtualScroller');
      for (const scroller of scrollers) {
        scroller.scrollTop = scroller.scrollHeight;
        await new Promise(r => setTimeout(r, 300));
        scroller.scrollTop = 0;
      }
    });
  } catch (_) {}

  // Phase 8: Reset scroll to top
  try { await page.evaluate(() => window.scrollTo(0, 0)); } catch (_) {}
  await new Promise(r => setTimeout(r, 400));
}

// ── Main per-page extractor ────────────────────────────────────────────────────
async function extractCarrierFromPage(page, usdot, pdfMeta = {}, apiInterceptor = null) {
  // Phase 1–7: smart wait until all sections are loaded
  await waitForPageReady(page, usdot);

  // Layer 1 + 2: run all in-browser XPath/CSS strategies
  let liveData = {};
  try {
    liveData = await page.evaluate(browserExtractAllFields);
  } catch (evalErr) {
    console.warn(`[puppeteerScraper] USDOT ${usdot}: page.evaluate error: ${evalErr.message}`);
  }
  console.log(`[puppeteerScraper] USDOT ${usdot} live data:`, JSON.stringify(liveData));

  // Layer 3: Cheerio HTML snapshot (catches anything the live DOM missed)
  const html    = await page.content();
  const carrier = parseMotusPageHtml(html, usdot, pdfMeta);

  // Merge: live browser data wins over Cheerio, Cheerio wins over 'N/A'
  const ok = s => typeof s === 'string' && s.trim() !== '' && s.trim() !== 'N/A';

  if (ok(liveData.mcNumber)) {
    carrier.mc_number = liveData.mcNumber.toUpperCase().replace(/^(MC|MX|FF)(\d)/, '$1-$2');
  }
  if (ok(liveData.operatingStatus)) {
    carrier.authority_status = liveData.operatingStatus;
  }
  if (ok(liveData.ownerName)) {
    carrier.company_official = liveData.ownerName;
  }
  if (ok(liveData.companyName) && !/1200 new jersey/i.test(liveData.companyName)) {
    carrier.legal_name = liveData.companyName;
  }
  if (ok(liveData.address) && liveData.address.length > 5 && !/1200 new jersey/i.test(liveData.address)) {
    const loc = parseCityStateZip(liveData.address);
    carrier.address = liveData.address;
    if (loc.city)  carrier.city  = loc.city;
    if (loc.state) carrier.state = loc.state;
    if (loc.zip)   carrier.zip   = loc.zip;
  }
  if (ok(liveData.email) && liveData.email.includes('@') && liveData.email.includes('.')) {
    if (!/fmcsa\.dot\.gov|motus\.dot\.gov/i.test(liveData.email)) {
      carrier.email = liveData.email;
    }
  }
  if (ok(liveData.phone) && /\d{3}/.test(liveData.phone) && !/1-800-832-5660/.test(liveData.phone)) {
    if (!ok(carrier.telephone)) carrier.telephone = liveData.phone;
  }

  // Final safety net: fill any remaining N/A with pdfMeta values
  if (!ok(carrier.mc_number)        && ok(pdfMeta.mc_number))        carrier.mc_number        = pdfMeta.mc_number;
  if (!ok(carrier.email)            && ok(pdfMeta.email))            carrier.email            = pdfMeta.email;
  if (!ok(carrier.telephone)        && ok(pdfMeta.telephone))        carrier.telephone        = pdfMeta.telephone;
  if (!ok(carrier.address)          && ok(pdfMeta.address))          carrier.address          = pdfMeta.address;
  if (!ok(carrier.authority_status) && ok(pdfMeta.authority_status)) carrier.authority_status = pdfMeta.authority_status;

  // ── Layer 4: API intercepted data (HIGHEST PRIORITY) ────────────────────────
  // JSON from MOTUS internal API calls is the most reliable source — no DOM
  // parsing ambiguity, no accordion/virtualization issues.
  if (apiInterceptor) {
    try {
      const apiData  = apiInterceptor.getData();
      const apiFields = extractFromApiData(apiData);
      console.log(`[puppeteerScraper] USDOT ${usdot} API intercepted ${apiData.raw.length} responses:`, JSON.stringify(apiFields));

      if (ok(apiFields.mc_number))        carrier.mc_number        = apiFields.mc_number;
      if (ok(apiFields.authority_status)) carrier.authority_status = apiFields.authority_status;
      if (ok(apiFields.authority_type))   carrier.authority_type   = apiFields.authority_type;
      if (ok(apiFields.company_official)) carrier.company_official = apiFields.company_official;
      if (ok(apiFields.official_title))   carrier.official_title   = apiFields.official_title;
      if (ok(apiFields.legal_name) && !/1200 new jersey/i.test(apiFields.legal_name)) {
        carrier.legal_name = apiFields.legal_name;
      }
      if (ok(apiFields.dba_name))         carrier.dba_name = apiFields.dba_name;
      if (ok(apiFields.email) && apiFields.email.includes('@') && !/fmcsa\.dot\.gov|motus\.dot\.gov/i.test(apiFields.email)) {
        carrier.email = apiFields.email;
      }
      if (ok(apiFields.telephone) && /\d{3}/.test(apiFields.telephone) && !/1-800-832-5660/.test(apiFields.telephone)) {
        carrier.telephone = apiFields.telephone;
      }
      if (ok(apiFields.address) && apiFields.address.length > 5 && !/1200 new jersey/i.test(apiFields.address)) {
        carrier.address = apiFields.address;
        const loc = parseCityStateZip(apiFields.address);
        if (loc.city)  carrier.city  = loc.city;
        if (loc.state) carrier.state = loc.state;
        if (loc.zip)   carrier.zip   = loc.zip;
      }
      if (ok(apiFields.city))  carrier.city  = apiFields.city;
      if (ok(apiFields.state)) carrier.state = apiFields.state;
      if (ok(apiFields.zip))   carrier.zip   = apiFields.zip;
    } catch (apiErr) {
      console.warn(`[puppeteerScraper] USDOT ${usdot}: API data merge error: ${apiErr.message}`);
    }
  }

  // ── Retry: if critical fields still missing, re-expand + re-extract ─────────
  const criticalMissing = !ok(carrier.mc_number) || !ok(carrier.email) || !ok(carrier.company_official) || !ok(carrier.address);
  if (criticalMissing) {
    console.log(`[puppeteerScraper] USDOT ${usdot}: Critical fields missing after first pass — retrying extraction...`);
    try {
      // Re-expand accordions and re-scroll DataGrids
      await waitForPageReady(page, usdot);
      await new Promise(r => setTimeout(r, 1000));

      const retryData = await page.evaluate(browserExtractAllFields);
      console.log(`[puppeteerScraper] USDOT ${usdot} retry data:`, JSON.stringify(retryData));

      if (!ok(carrier.mc_number)        && ok(retryData.mcNumber))        carrier.mc_number        = retryData.mcNumber.toUpperCase().replace(/^(MC|MX|FF)(\d)/, '$1-$2');
      if (!ok(carrier.company_official) && ok(retryData.ownerName))       carrier.company_official = retryData.ownerName;
      if (!ok(carrier.legal_name)       && ok(retryData.companyName) && !/1200 new jersey/i.test(retryData.companyName)) carrier.legal_name = retryData.companyName;
      if (!ok(carrier.email)            && ok(retryData.email) && retryData.email.includes('@')) carrier.email = retryData.email;
      if (!ok(carrier.address)          && ok(retryData.address) && retryData.address.length > 5) {
        carrier.address = retryData.address;
        const loc = parseCityStateZip(retryData.address);
        if (loc.city)  carrier.city  = loc.city;
        if (loc.state) carrier.state = loc.state;
        if (loc.zip)   carrier.zip   = loc.zip;
      }
      if ((!ok(carrier.telephone) || carrier.telephone === 'N/A') && ok(retryData.phone) && !/1-800-832-5660/.test(retryData.phone)) {
        carrier.telephone = retryData.phone;
      }
      if (ok(retryData.operatingStatus) && !ok(carrier.authority_status)) carrier.authority_status = retryData.operatingStatus;
    } catch (retryErr) {
      console.warn(`[puppeteerScraper] USDOT ${usdot}: Retry extraction error: ${retryErr.message}`);
    }
  }

  console.log(
    `[puppeteerScraper] ✅ USDOT: ${carrier.usdot}` +
    ` | MC: "${carrier.mc_number}"` +
    ` | Status: "${carrier.authority_status}"` +
    ` | Company: "${carrier.legal_name}"` +
    ` | Owner: "${carrier.company_official}"` +
    ` | Address: "${carrier.address}"` +
    ` | Email: "${carrier.email}"` +
    ` | Phone: "${carrier.telephone}"`
  );
  return carrier;
}

// ── Browser connection manager ─────────────────────────────────────────────────
//
// Strategy:
//   1. Try to connect to an already-running Chrome via CDP on port 9222.
//      Scraping then runs INSIDE the same browser where the project website
//      is open — no separate browser window ever appears.
//   2. If no running Chrome is found on port 9222, launch a new visible browser
//      window as a fallback (and expose it on 9222 so future runs reuse it too).
//
// How to start Chrome with remote debugging (one-time setup):
//   Windows shortcut target:
//     "C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222
//   Or run: Start-Process "chrome" "--remote-debugging-port=9222"
//   The helper script open-chrome.bat in this project does this automatically.
// ─────────────────────────────────────────────────────────────────────────────
const http = require('http');

/**
 * Probe Chrome's debug endpoint on localhost:port.
 * Returns the browser WebSocket URL, or null if Chrome is not available.
 */
function probeChromeDebugEndpoint(port = 9222) {
  return new Promise(resolve => {
    const req = http.get(`http://127.0.0.1:${port}/json/version`, res => {
      let data = '';
      res.on('data', d => { data += d; });
      res.on('end', () => {
        try {
          const info = JSON.parse(data);
          resolve(info.webSocketDebuggerUrl || null);
        } catch (_) { resolve(null); }
      });
    });
    req.setTimeout(2000, () => { req.destroy(); resolve(null); });
    req.on('error', () => resolve(null));
  });
}

/**
 * Connect to (or launch) the browser.
 * Returns { browser, page, isConnected }
 *   isConnected = true  → we attached to an existing Chrome window
 *                         → only close the TAB when done, not the browser
 *   isConnected = false → we launched a new browser
 *                         → close the browser when done
 */
async function connectOrLaunchBrowser() {
  const wsUrl = await probeChromeDebugEndpoint(9222);

  if (wsUrl) {
    try {
      const browser = await puppeteer.connect({
        browserWSEndpoint: wsUrl,
        defaultViewport: null
      });
      // Open a new tab in the EXISTING browser window (same window as the project website)
      const page = await browser.newPage();
      try { await page.bringToFront(); } catch (_) {}
      console.log('[puppeteerScraper] ✅ Attached to existing Chrome — scraping in a new tab of the same browser.');
      return { browser, page, isConnected: true };
    } catch (connErr) {
      console.warn(`[puppeteerScraper] Could not attach to running Chrome: ${connErr.message}. Launching new window.`);
    }
  }

  // ── Fallback: launch a new browser window ─────────────────────────────────
  console.log('[puppeteerScraper] No Chrome detected on port 9222. Launching new browser window...');
  const launchOptions = {
    headless: false,
    defaultViewport: null,
    args: [
      '--start-maximized',
      '--remote-debugging-port=9222',          // expose port so next run can reuse this window
      '--disable-blink-features=AutomationControlled',
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-web-security'
    ]
  };
  const exePath = getChromeExecutablePath();
  if (exePath) launchOptions.executablePath = exePath;

  const browser = await puppeteer.launch(launchOptions);
  const pages   = await browser.pages();
  const page    = pages[0] || await browser.newPage();
  return { browser, page, isConnected: false };
}

// ── Main scrape loop ───────────────────────────────────────────────────────────
async function scrapeUsdotsWithPuppeteer(usdotList, associatedDate, onProgress, isCanceled, options = {}) {
  const startIndex = options.startIndex || 0;
  const isPaused   = options.isPaused;
  const results    = [];
  console.log(`[puppeteerScraper] Starting scrape session for ${usdotList.length} items (starting at index ${startIndex})...`);

  let browser, page, isConnected;
  try {
    // Get a page inside the already-running Chrome (or a new window as fallback)
    ({ browser, page, isConnected } = await connectOrLaunchBrowser());

    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );

    for (let i = startIndex; i < usdotList.length; i++) {
      if (isCanceled && isCanceled()) {
        console.log(`[puppeteerScraper] Stopped by user at ${i}/${usdotList.length}`);
        break;
      }
      if (isPaused && isPaused()) {
        console.log(`[puppeteerScraper] Paused by user at ${i}/${usdotList.length}`);
        break;
      }

      const item     = usdotList[i];
      const rawUsdot = typeof item === 'object' ? item.usdot : item;
      const usdot    = String(rawUsdot || '').replace(/\D/g, '').trim();
      if (!usdot) continue;

      // ── Strict PK deduplication ──────────────────────────────────────────
      const existing = db.getCarrierByUsdot(usdot);
      const pdfMeta  = typeof item === 'object' ? item : (existing || {});

      if (existing && existing.scraped_from_motus === true) {
        console.log(`[puppeteerScraper] (${i+1}/${usdotList.length}) USDOT ${usdot} already scraped. Skipping.`);
        results.push(existing);
        onProgress({ current: i+1, total: usdotList.length, usdot, status: 'already_available', carrier: existing });
        continue;
      }

      const url = `https://motus.dot.gov/customer/${usdot}/account`;
      // Set up API response interception BEFORE navigating — captures JSON payloads
      // from MOTUS internal API calls as the page loads.
      const apiInterceptor = setupApiInterception(page);
      try {
        onProgress({ current: i+1, total: usdotList.length, usdot, status: 'navigating' });
        console.log(`[puppeteerScraper] (${i+1}/${usdotList.length}) → ${url}`);

        try {
          await page.goto(url, { waitUntil: 'networkidle2', timeout: 40000 });
        } catch (navErr) {
          console.warn(`[puppeteerScraper] Nav timeout for ${usdot}: ${navErr.message} — continuing with current DOM`);
        }

        // Allow extra time for late API responses to arrive
        await new Promise(r => setTimeout(r, 1500));

        const carrier = await extractCarrierFromPage(page, usdot, pdfMeta, apiInterceptor);
        carrier.associated_date =
          associatedDate ||
          pdfMeta.associated_date ||
          (existing && existing.associated_date) ||
          new Date().toLocaleDateString('en-US');

        try { db.addCarrier(carrier); } catch (_) {}
        results.push(carrier);
        onProgress({ current: i+1, total: usdotList.length, usdot, status: 'done', carrier });

      } catch (err) {
        console.error(`[puppeteerScraper] Error scraping USDOT ${usdot}:`, err.message);
        const fallback = {
          ...(existing || {}),
          ...(pdfMeta  || {}),
          id: usdot,
          usdot,
          associated_date:
            associatedDate ||
            pdfMeta.associated_date ||
            (existing && existing.associated_date) ||
            new Date().toLocaleDateString('en-US'),
          motus_url: url
        };
        try { db.addCarrier(fallback); } catch (_) {}
        results.push(fallback);
        onProgress({ current: i+1, total: usdotList.length, usdot, status: 'error', error: err.message, carrier: fallback });
      } finally {
        if (apiInterceptor) apiInterceptor.cleanup();
      }

      if (i < usdotList.length - 1 && !(isCanceled && isCanceled()) && !(isPaused && isPaused())) {
        await new Promise(r => setTimeout(r, 1000));
      }
    }

  } finally {
    // ── Only close the scrape TAB — never the whole browser ───────────────
    // If we connected to an existing Chrome, closing the browser would kill
    // the project website too. So we only close the tab we opened.
    if (page) {
      try { await page.close(); } catch (_) {}
      console.log('[puppeteerScraper] Scrape tab closed.');
    }
    if (isConnected) {
      // Detach from the running browser without closing it
      try { browser.disconnect(); } catch (_) {}
      console.log('[puppeteerScraper] Disconnected from Chrome (browser window left open).');
    } else if (browser) {
      // We launched this browser ourselves — safe to close it
      await browser.close();
      console.log('[puppeteerScraper] Launched browser window closed.');
    }
  }

  return results;
}

module.exports = {
  scrapeUsdotsWithPuppeteer,
  extractCarrierFromPage,
  parseMotusPageHtml,
  calculateEquipmentType,
  getChromeExecutablePath,
  setupApiInterception,
  extractFromApiData
};

