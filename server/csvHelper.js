/**
 * RFC-4180 compliant CSV Parser & Carrier Record Normalizer
 */

function parseCsv(text) {
  if (!text) return [];
  // Strip UTF-8 BOM if present
  if (text.charCodeAt(0) === 0xFEFF) {
    text = text.slice(1);
  }

  const rows = [];
  let currentRow = [];
  let currentField = '';
  let insideQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (char === '"') {
      if (insideQuotes && nextChar === '"') {
        currentField += '"';
        i++; // skip escaped double-quote
      } else {
        insideQuotes = !insideQuotes;
      }
    } else if (char === ',' && !insideQuotes) {
      currentRow.push(currentField.trim());
      currentField = '';
    } else if ((char === '\r' || char === '\n') && !insideQuotes) {
      if (char === '\r' && nextChar === '\n') {
        i++; // skip \n of CRLF
      }
      currentRow.push(currentField.trim());
      if (currentRow.some(cell => cell.length > 0)) {
        rows.push(currentRow);
      }
      currentRow = [];
      currentField = '';
    } else {
      currentField += char;
    }
  }

  if (currentField || currentRow.length > 0) {
    currentRow.push(currentField.trim());
    if (currentRow.some(cell => cell.length > 0)) {
      rows.push(currentRow);
    }
  }

  return rows;
}

/**
 * Extract City, State, and Zip from address string
 */
function parseCityStateZip(addressStr) {
  let city = '';
  let state = '';
  let zip = '';

  if (!addressStr || addressStr === 'N/A') {
    return { city, state, zip };
  }

  const cleanAddr = addressStr.trim();

  // Pattern 1: City, State Zip (e.g. "Houston, TX 77002" or "Austin, TX 78701 US")
  const matchWithZip = cleanAddr.match(/(?:^|,\s*)([A-Za-z\s.'-]+?),\s*([A-Z]{2})\s+(\d{5}(?:-\d{4})?)(?:\s+US|\s+USA)?$/i);
  if (matchWithZip) {
    city = matchWithZip[1].trim();
    state = matchWithZip[2].trim().toUpperCase();
    zip = matchWithZip[3].trim();
    return { city, state, zip };
  }

  // Pattern 2: City, State without zip (e.g. "JACKSONVILLE, FL" or "STOCKTON, CA")
  const matchCityState = cleanAddr.match(/(?:^|,\s*)([A-Za-z\s.'-]+?),\s*([A-Z]{2})$/i);
  if (matchCityState) {
    city = matchCityState[1].trim();
    state = matchCityState[2].trim().toUpperCase();
    return { city, state, zip: '' };
  }

  // Pattern 3: Look for state abbreviation followed by zip anywhere
  const stateZipMatch = cleanAddr.match(/\b([A-Z]{2})\s+(\d{5})\b/);
  if (stateZipMatch) {
    state = stateZipMatch[1].toUpperCase();
    zip = stateZipMatch[2];
  }

  return { city, state, zip };
}

/**
 * Normalize header name for matching
 */
function cleanHeader(h) {
  return String(h || '')
    .trim()
    .toLowerCase()
    .replace(/^["'\uFEFF]+|["']+$/g, '')
    .replace(/[_\s-]+/g, ' ')
    .trim();
}

/**
 * Convert parsed CSV rows into standardized carrier records
 */
function csvRowsToCarrierRecords(rows, defaultDate) {
  if (!rows || rows.length < 2) return [];

  const rawHeaders = rows[0];
  const cleanedHeaders = rawHeaders.map(cleanHeader);

  // Helper to find column index matching any of the alias patterns
  const findColIdx = (aliases) => {
    return cleanedHeaders.findIndex(h => aliases.some(alias => h === alias || h.includes(alias)));
  };

  const usdotIdx = findColIdx(['usdot number', 'usdot', 'dot number', 'dot', 'us dot']);
  const mcIdx = findColIdx(['mc number', 'mc #', 'docket number', 'mc', 'operating authority']);
  const companyIdx = findColIdx(['company name', 'legal name', 'carrier name', 'business name', 'company']);
  const statusIdx = findColIdx(['operating status', 'authority status', 'status']);
  const phoneIdx = findColIdx(['phone number', 'telephone', 'phone', 'contact number']);
  const addressIdx = findColIdx(['physical address', 'address', 'street', 'location']);
  const cityIdx = findColIdx(['city']);
  const stateIdx = findColIdx(['state']);
  const zipIdx = findColIdx(['zip code', 'zipcode', 'zip', 'postal code']);
  const emailIdx = findColIdx(['contact email', 'email', 'e-mail']);
  const officialIdx = findColIdx(['official / owner', 'official / owner name', 'official/ owner', 'company official', 'owner name', 'owner', 'legal name', 'officer']);
  const trucksIdx = findColIdx(['total equipment', 'no. of trucks', 'no of trucks', 'total trucks', 'trucks', 'equipment count', 'fleet size']);
  const equipIdx = findColIdx(['truck type', 'equipment type', 'type of trucks', 'trailer type']);
  const cargoIdx = findColIdx(['cargo classifications', 'cargo types', 'cargo type', 'cargo']);

  const carrierList = [];
  const seenUsdots = new Set();

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;

    const rawUsdot = usdotIdx >= 0 ? row[usdotIdx] : '';
    const cleanUsdot = String(rawUsdot || '').replace(/\D/g, '').trim();

    if (!cleanUsdot || cleanUsdot.length < 5) continue;
    if (seenUsdots.has(cleanUsdot)) continue;
    seenUsdots.add(cleanUsdot);

    const rawMc = mcIdx >= 0 ? row[mcIdx] : '';
    let mcNumber = String(rawMc || '').trim();
    if (!mcNumber || mcNumber === '-' || mcNumber.toLowerCase() === 'n/a') {
      mcNumber = 'N/A';
    } else {
      const digits = mcNumber.replace(/\D/g, '');
      if (digits) {
        mcNumber = mcNumber.toUpperCase().startsWith('MC') ? mcNumber : `MC-${digits}`;
      }
    }

    const legalName = (companyIdx >= 0 && row[companyIdx]) ? row[companyIdx].trim() : `MOTOR CARRIER ${cleanUsdot}`;
    const rawStatus = (statusIdx >= 0 && row[statusIdx]) ? row[statusIdx].trim() : 'Active';
    const authorityStatus = rawStatus.toLowerCase().includes('pending') || rawStatus.toLowerCase().includes('not')
      ? 'Pending'
      : 'Active';

    const telephone = (phoneIdx >= 0 && row[phoneIdx]) ? row[phoneIdx].trim() : 'N/A';
    const address = (addressIdx >= 0 && row[addressIdx]) ? row[addressIdx].trim() : 'N/A';
    const email = (emailIdx >= 0 && row[emailIdx]) ? row[emailIdx].trim() : 'N/A';
    const official = (officialIdx >= 0 && row[officialIdx]) ? row[officialIdx].trim() : legalName;

    // Trucks count
    let totalTrucks = 1;
    if (trucksIdx >= 0 && row[trucksIdx]) {
      const parsedTrucks = parseInt(String(row[trucksIdx]).replace(/\D/g, ''), 10);
      if (!isNaN(parsedTrucks) && parsedTrucks > 0) totalTrucks = parsedTrucks;
    }

    // Equipment Type
    let equipmentType = (equipIdx >= 0 && row[equipIdx]) ? row[equipIdx].trim() : 'Box Truck';
    if (!equipmentType || equipmentType === 'N/A') {
      equipmentType = totalTrucks > 3 ? 'Fleet' : 'Box Truck';
    }

    // Cargo
    let cargo = ['General Freight'];
    if (cargoIdx >= 0 && row[cargoIdx]) {
      const rawCargo = row[cargoIdx].trim();
      if (rawCargo && rawCargo !== 'N/A') {
        cargo = rawCargo.split(/[,;/]+/).map(c => c.trim()).filter(Boolean);
      }
    }

    // Extract or pick City, State, Zip
    const loc = parseCityStateZip(address);
    const city = (cityIdx >= 0 && row[cityIdx]) ? row[cityIdx].trim() : (loc.city || '');
    const state = (stateIdx >= 0 && row[stateIdx]) ? row[stateIdx].trim().toUpperCase() : (loc.state || '');
    const zip = (zipIdx >= 0 && row[zipIdx]) ? row[zipIdx].trim() : (loc.zip || '');

    carrierList.push({
      usdot: cleanUsdot,
      mc_number: mcNumber,
      legal_name: legalName,
      authority_status: authorityStatus,
      authority_type: 'Motor Carrier of Property (Except Household Goods)',
      telephone: telephone || 'N/A',
      address: address || 'N/A',
      city: city || 'N/A',
      state: state || 'N/A',
      zip: zip || 'N/A',
      email: email || 'N/A',
      company_official: official || legalName,
      total_trucks: totalTrucks,
      equipment_type: equipmentType,
      cargo_classifications: cargo.length > 0 ? cargo : ['General Freight'],
      associated_date: defaultDate || new Date().toLocaleDateString('en-US'),
      motus_url: `https://motus.dot.gov/customer/${cleanUsdot}/account`,
      source: 'csv_import'
    });
  }

  return carrierList;
}

module.exports = {
  parseCsv,
  parseCityStateZip,
  csvRowsToCarrierRecords
};
