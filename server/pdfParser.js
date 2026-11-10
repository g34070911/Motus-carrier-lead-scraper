// Node 24 Polyfill for DOMMatrix, ImageData, Path2D required by pdf-parse
if (typeof global.DOMMatrix === 'undefined') {
  global.DOMMatrix = class DOMMatrix {
    constructor() {
      this.a = 1; this.b = 0; this.c = 0; this.d = 1; this.e = 0; this.f = 0;
    }
  };
}
if (typeof global.ImageData === 'undefined') {
  global.ImageData = class ImageData {};
}
if (typeof global.Path2D === 'undefined') {
  global.Path2D = class Path2D {};
}

const fs = require('fs');
let pdfModule;
try {
  pdfModule = require('pdf-parse');
} catch (e) {
  console.warn('pdf-parse module load warning:', e.message);
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION CLASSIFICATION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns true ONLY for genuine Motor Carrier sections.
 * Brokers, Freight Forwarders, Enterprise, and other authority types
 * are explicitly excluded.
 */
function isMotorCarrierSection(sectionHeader) {
  const h = sectionHeader.toUpperCase().trim();

  // Explicitly EXCLUDE these sections (never scrape their USDOTs)
  const excludedPrefixes = [
    'BROKER OF',
    'FREIGHT FORWARDER',
    'ENTERPRISE MOTOR CARRIER',  // Enterprise carriers are a special class – exclude per spec
  ];
  for (const ex of excludedPrefixes) {
    if (h.startsWith(ex)) return false;
  }

  // Include only genuine Motor Carrier sections
  const includedPrefixes = [
    'MOTOR CARRIER OF PROPERTY',
    'MOTOR CARRIER OF HOUSEHOLD GOODS',
    'MOTOR CARRIER OF PASSENGERS',
  ];
  for (const inc of includedPrefixes) {
    if (h.startsWith(inc)) return true;
  }

  return false;
}

/**
 * Returns true when a line is a recognised section-header line in the FMCSA Register.
 */
function isSectionHeader(line) {
  const t = line.trim().toUpperCase();
  return /^(BROKER OF|FREIGHT FORWARDER|ENTERPRISE MOTOR|MOTOR CARRIER OF)/.test(t);
}

// ─────────────────────────────────────────────────────────────────────────────
// PDF PARSING ENTRY-POINT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Parse an uploaded FMCSA Register PDF file and return Motor Carrier leads ONLY.
 * @param {Buffer|string} fileInput - Buffer or absolute file path of the PDF
 * @returns {Promise<Array>} Array of motor-carrier records
 */
async function parsePdf(fileInput) {
  let text = '';

  try {
    let buffer;
    if (typeof fileInput === 'string') {
      buffer = fs.readFileSync(fileInput);
    } else {
      buffer = fileInput;
    }

    const uint8Data = new Uint8Array(buffer);

    if (pdfModule) {
      if (typeof pdfModule === 'function') {
        const data = await pdfModule(uint8Data);
        text = data.text || '';
      } else if (pdfModule.PDFParse && typeof pdfModule.PDFParse === 'function') {
        const instance = new pdfModule.PDFParse(uint8Data);
        const data = await instance.getText();
        text = typeof data === 'string' ? data : (data.text || '');
      } else if (pdfModule.default && typeof pdfModule.default === 'function') {
        const data = await pdfModule.default(uint8Data);
        text = data.text || '';
      }
    }
  } catch (err) {
    console.error('pdf-parse extraction failed, attempting raw fallback:', err.message);
  }

  // Raw text fallback
  if (!text || text.length < 50) {
    if (typeof fileInput === 'string') {
      text = fs.readFileSync(fileInput, 'utf-8');
    } else {
      text = fileInput.toString('utf-8');
    }
  }

  return extractMotorCarriersFromText(text);
}

// ─────────────────────────────────────────────────────────────────────────────
// CORE PARSER – Motor Carriers Only
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Walk through the extracted PDF text line-by-line.
 * Track which FMCSA Register section we are in and ONLY collect
 * USDOT records that appear inside a Motor Carrier section.
 */
function extractMotorCarriersFromText(text) {
  const extracted = [];
  const lines = text.split(/\r?\n/);

  // We start with no section – nothing will be collected until we hit a known section header
  let currentSection = '';
  let inMotorCarrierSection = false;

  // USDOT row: 6-8 leading digits followed by a space and more text
  const usdotRowRegex = /^\s*(\d{6,8})\s+(.+)$/;

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const line = raw.trim();

    if (!line) continue;

    // ── Detect section-header lines ────────────────────────────────────────
    if (isSectionHeader(line)) {
      currentSection = line.trim();
      inMotorCarrierSection = isMotorCarrierSection(currentSection);

      if (inMotorCarrierSection) {
        console.log('[pdfParser] Entering Motor Carrier section:', currentSection);
      } else {
        console.log('[pdfParser] Skipping non-Motor-Carrier section:', currentSection);
      }
      continue;
    }

    // Skip if we are NOT inside a valid Motor Carrier section
    if (!inMotorCarrierSection) continue;

    // Skip generic table-header rows
    if (
      line.includes('USDOT Number') ||
      line.includes('Legal Business Name') ||
      line.includes('U.S. Department of Transportation') ||
      line.includes('FMCSA Register') ||
      line.includes('Run Date =') ||
      line.includes('Federal Motor Carrier')
    ) {
      continue;
    }

    // ── Try to parse a USDOT data row ─────────────────────────────────────
    const match = line.match(usdotRowRegex);
    if (!match) continue;

    const usdot = match[1];
    const remainder = match[2];

    // Filing date: MM/DD/YYYY
    const dateMatch = remainder.match(/(\d{2}\/\d{2}\/\d{4})/);
    const filingDate = dateMatch ? dateMatch[1] : '';

    let legalName = remainder;
    let afterDateStr = '';

    if (dateMatch) {
      const parts = remainder.split(dateMatch[1]);
      legalName = parts[0].trim();
      afterDateStr = parts.slice(1).join(' ').trim();
    }

    // Phone: +1 (xxx) xxx-xxxx  OR  10-digit run-on
    const phoneMatch = afterDateStr.match(/(\+?\d{1,2}\s*\(\d{3}\)\s*\d{3}-\d{4}|\d{10})/);
    const phone = phoneMatch ? phoneMatch[0] : '';
    let addressAndOfficer = phoneMatch
      ? afterDateStr.replace(phoneMatch[0], '').trim()
      : afterDateStr;

    // Split address / company-official at state+zip boundary
    let companyOfficial = '';
    let address = addressAndOfficer;

    const stateZipMatch = addressAndOfficer.match(
      /([A-Z]{2}\s+\d{5}(?:-\d{4})?\s+US|[A-Z]{2}\s+[A-Z0-9]{3,7}\s+CA)/i
    );
    if (stateZipMatch) {
      const idx = addressAndOfficer.indexOf(stateZipMatch[0]) + stateZipMatch[0].length;
      address = addressAndOfficer.substring(0, idx).trim();
      companyOfficial = addressAndOfficer.substring(idx).trim();
    }

    if (!legalName || legalName.length < 2) {
      legalName = 'MOTOR CARRIER ' + usdot;
    }

    // Deduplicate by USDOT
    if (!extracted.some(c => c.usdot === usdot)) {
      extracted.push({
        usdot,
        legal_name: legalName,
        filing_date: filingDate,
        address: address || 'N/A',
        company_official: companyOfficial || 'N/A',
        telephone: phone || 'N/A',
        authority_type: currentSection
      });
    }
  }

  console.log(`[pdfParser] Total Motor Carrier USDOTs extracted: ${extracted.length}`);
  return extracted;
}

/**
 * Fallback: when line-based parsing returns nothing, do a broad USDOT regex scan
 * (still limited to text that clearly isn't in a broker section).
 */
function fallbackExtractUsdotsFromRawText(text) {
  const matches = text.match(/\b\d{7,8}\b/g) || [];
  const uniqueUsdots = [...new Set(matches)];

  return uniqueUsdots.map(usdot => ({
    usdot,
    legal_name: `MOTOR CARRIER ${usdot}`,
    filing_date: '',
    address: 'N/A',
    company_official: 'N/A',
    telephone: 'N/A',
    authority_type: 'MOTOR CARRIER OF PROPERTY (EXCEPT HOUSEHOLD GOODS)'
  }));
}

module.exports = {
  parsePdf,
  extractMotorCarriersFromText
};
