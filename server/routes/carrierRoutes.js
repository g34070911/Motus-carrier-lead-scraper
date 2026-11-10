const express = require('express');
const router = express.Router();
const db = require('../db');
const { verifyToken, checkPlanLimits } = require('../auth');
const { parseCityStateZip } = require('../csvHelper');

// Helper to get only search-ready carrier leads (scraped from MOTUS or imported leads, never raw un-scraped PDF parse data)
function getSearchableCarriers() {
  return db.getCarriers().filter(c => {
    if (!c) return false;
    // Exclude raw PDF parse records that have not been scraped from MOTUS
    if (c.source === 'pdf_parser' && !c.scraped_from_motus) {
      return false;
    }
    return true;
  });
}

// GET /api/carriers/dates - Get all available dates in database for search
router.get('/dates', (req, res) => {
  try {
    const allCarriers = getSearchableCarriers();
    const dateMap = {};
    allCarriers.forEach(c => {
      if (c.associated_date) {
        const d = c.associated_date.trim();
        dateMap[d] = (dateMap[d] || 0) + 1;
      }
    });

    // Sort dates by descending lead count or recent date
    const dates = Object.keys(dateMap).map(date => ({
      date,
      count: dateMap[date]
    })).sort((a, b) => b.count - a.count);

    res.json({
      dates,
      totalCarriers: allCarriers.length
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch dates' });
  }
});

// Helper to normalize dates for comparison (e.g. YYYY-MM-DD to MM/DD/YYYY and M/D/YYYY)
function matchesAssociatedDate(carrierDate, queryDate) {
  if (!carrierDate || !queryDate) return false;
  const cd = carrierDate.trim();
  const qd = queryDate.trim();
  if (cd === qd) return true;

  // Convert queryDate if YYYY-MM-DD
  let normalizedQuery = qd;
  if (/^\d{4}-\d{2}-\d{2}$/.test(qd)) {
    const [y, m, d] = qd.split('-');
    const mNum = parseInt(m, 10);
    const dNum = parseInt(d, 10);
    const mPadded = mNum < 10 ? `0${mNum}` : `${mNum}`;
    const dPadded = dNum < 10 ? `0${dNum}` : `${dNum}`;
    if (cd === `${mPadded}/${dPadded}/${y}`) return true;
    if (cd === `${mNum}/${dNum}/${y}`) return true;
  }

  // Strip leading zeroes for comparison
  const cdNorm = cd.replace(/\b0+(\d)/g, '$1');
  const qdNorm = normalizedQuery.replace(/\b0+(\d)/g, '$1');
  return cdNorm === qdNorm;
}

// GET /api/carriers/search - Search & Filter Motor Carriers
router.get('/search', verifyToken, (req, res) => {
  const {
    date,
    start_mc,
    end_mc,
    query,
    location,
    authority_status,
    authority_type,
    equipment_type,
    cargo_type
  } = req.query;

  // Only searchable leads: scraped from MOTUS or imported, no raw PDF parse
  let allCarriers = getSearchableCarriers();

  // Compute available dates in database
  const availableDatesMap = {};
  allCarriers.forEach(c => {
    if (c.associated_date) {
      availableDatesMap[c.associated_date.trim()] = (availableDatesMap[c.associated_date.trim()] || 0) + 1;
    }
  });
  const availableDatesList = Object.keys(availableDatesMap);

  // If date parameter is specified and not 'all'
  if (date && date !== 'all' && date.trim() !== '') {
    const dateMatches = allCarriers.filter(c => matchesAssociatedDate(c.associated_date, date));

    if (dateMatches.length === 0) {
      return res.json({
        data: [],
        dateExists: false,
        total: 0,
        availableDates: availableDatesList,
        message: `Data not available for date: ${date}. Please select an available date or view all system leads.`
      });
    }

    allCarriers = dateMatches;
  }

  // Filter by MC Range (< 8 digit MCs only)
  // Example: start_mc 1700000 to end_mc 1701000 extracts only data within this range
  if ((start_mc && start_mc.trim()) || (end_mc && end_mc.trim())) {
    const startNum = start_mc && start_mc.trim() ? parseInt(start_mc.trim().replace(/\D/g, ''), 10) : null;
    const endNum = end_mc && end_mc.trim() ? parseInt(end_mc.trim().replace(/\D/g, ''), 10) : null;

    allCarriers = allCarriers.filter(c => {
      if (!c.mc_number) return false;
      const mcDigits = String(c.mc_number).replace(/\D/g, '');
      if (!mcDigits) return false;

      // Strictly enforce: only works for less than 8-digit MCs
      if (mcDigits.length >= 8) return false;

      const mcVal = parseInt(mcDigits, 10);
      if (isNaN(mcVal)) return false;

      if (startNum !== null && !isNaN(startNum) && mcVal < startNum) return false;
      if (endNum !== null && !isNaN(endNum) && mcVal > endNum) return false;

      return true;
    });
  }

  // Filter by search query (USDOT, MC number, Legal Name, Official Name, Phone, Email)
  if (query && query.trim()) {
    const q = query.trim().toLowerCase();
    allCarriers = allCarriers.filter(c => 
      (c.usdot && String(c.usdot).toLowerCase().includes(q)) ||
      (c.mc_number && String(c.mc_number).toLowerCase().includes(q)) ||
      (c.legal_name && String(c.legal_name).toLowerCase().includes(q)) ||
      (c.company_official && String(c.company_official).toLowerCase().includes(q)) ||
      (c.telephone && String(c.telephone).toLowerCase().includes(q)) ||
      (c.email && String(c.email).toLowerCase().includes(q))
    );
  }

  // Filter by location (City, State, Zip, Address)
  if (location && location.trim()) {
    const loc = location.trim().toLowerCase();
    allCarriers = allCarriers.filter(c => 
      (c.address && c.address.toLowerCase().includes(loc)) ||
      (c.city && c.city.toLowerCase().includes(loc)) ||
      (c.state && c.state.toLowerCase().includes(loc)) ||
      (c.zip && c.zip.toLowerCase().includes(loc))
    );
  }

  // Filter by Authority Status (Active vs Pending)
  if (authority_status && authority_status !== 'all') {
    const statusFilter = authority_status.toLowerCase();
    allCarriers = allCarriers.filter(c => {
      const status = (c.authority_status || '').toLowerCase();
      if (statusFilter === 'active' || statusFilter === 'authorized') {
        return (status.includes('active') || status.includes('authorized')) && !status.includes('not');
      } else if (statusFilter === 'pending' || statusFilter === 'not_authorized' || statusFilter === 'not authorized') {
        return status.includes('pending') || status.includes('not') || status.includes('revoked') || status.includes('inactive');
      }
      return status.includes(statusFilter);
    });
  }

  // Filter by Authority Type (Broker, Motor Carrier, Freight Forwarder)
  if (authority_type && authority_type !== 'all') {
    const typeFilter = authority_type.toLowerCase();
    allCarriers = allCarriers.filter(c => 
      (c.authority_type || '').toLowerCase().includes(typeFilter)
    );
  }

  // Filter by Equipment Type (Multi-selection support: e.g. Box Truck, Trailer)
  if (equipment_type && equipment_type !== 'all') {
    const selectedEquip = Array.isArray(equipment_type)
      ? equipment_type.map(e => e.trim().toLowerCase())
      : equipment_type.split(',').map(e => e.trim().toLowerCase()).filter(Boolean);

    if (selectedEquip.length > 0 && !selectedEquip.includes('all')) {
      allCarriers = allCarriers.filter(c => {
        const carrierEquip = (c.equipment_type || '').toLowerCase();
        return selectedEquip.some(eq => carrierEquip.includes(eq) || eq.includes(carrierEquip));
      });
    }
  }

  // Filter by Cargo Type (Multi-selection support: e.g. General Freight, Metal)
  if (cargo_type && cargo_type !== 'all') {
    const selectedCargos = Array.isArray(cargo_type)
      ? cargo_type.map(cg => cg.trim().toLowerCase())
      : cargo_type.split(',').map(cg => cg.trim().toLowerCase()).filter(Boolean);

    if (selectedCargos.length > 0 && !selectedCargos.includes('all')) {
      allCarriers = allCarriers.filter(c => {
        if (!c.cargo_classifications) return false;
        const cargos = Array.isArray(c.cargo_classifications) 
          ? c.cargo_classifications.map(x => String(x).toLowerCase())
          : [String(c.cargo_classifications).toLowerCase()];

        return selectedCargos.some(sel => cargos.some(cg => cg.includes(sel)));
      });
    }
  }

  // Log user search activity
  db.logActivity(
    req.user.id,
    'SEARCH',
    `Searched carriers: date='${date || 'all'}', query='${query || 'all'}', mc_range='${start_mc || ''}-${end_mc || ''}', status='${authority_status || 'all'}'`,
    allCarriers.length
  );

  res.json({
    data: allCarriers,
    dateExists: true,
    total: allCarriers.length,
    userPlan: req.user.plan,
    scrapedToday: req.user.scraped_today || 0
  });
});

// POST /api/carriers/export - Export Leads to CSV with Plan Limit Enforcement
router.post('/export', verifyToken, (req, res) => {
  const {
    carrierIds,
    carrierUsdots,
    date,
    start_mc,
    end_mc,
    query,
    location,
    authority_status,
    authority_type,
    equipment_type,
    cargo_type
  } = req.body;

  let leadsToExport = [];
  const allCarriers = getSearchableCarriers();

  const selectedTargets = (carrierUsdots && Array.isArray(carrierUsdots) && carrierUsdots.length > 0)
    ? carrierUsdots
    : (carrierIds && Array.isArray(carrierIds) && carrierIds.length > 0 ? carrierIds : null);

  if (selectedTargets && selectedTargets.length > 0) {
    const dotSet = new Set(selectedTargets.map(d => String(d).replace(/\D/g, '').trim()).filter(Boolean));
    leadsToExport = allCarriers.filter(c => 
      dotSet.has(String(c.usdot).replace(/\D/g, '').trim()) || dotSet.has(String(c.id).trim())
    );
  } else {
    // Re-apply filters to get exact matching list
    leadsToExport = allCarriers;

    if (date && date !== 'all') {
      leadsToExport = leadsToExport.filter(c => matchesAssociatedDate(c.associated_date, date));
    }

    if ((start_mc && String(start_mc).trim()) || (end_mc && String(end_mc).trim())) {
      const startNum = start_mc ? parseInt(String(start_mc).trim().replace(/\D/g, ''), 10) : null;
      const endNum = end_mc ? parseInt(String(end_mc).trim().replace(/\D/g, ''), 10) : null;

      leadsToExport = leadsToExport.filter(c => {
        if (!c.mc_number) return false;
        const mcDigits = String(c.mc_number).replace(/\D/g, '');
        if (!mcDigits || mcDigits.length >= 8) return false;
        const mcVal = parseInt(mcDigits, 10);
        if (isNaN(mcVal)) return false;
        if (startNum !== null && !isNaN(startNum) && mcVal < startNum) return false;
        if (endNum !== null && !isNaN(endNum) && mcVal > endNum) return false;
        return true;
      });
    }

    if (query && query.trim()) {
      const q = query.trim().toLowerCase();
      leadsToExport = leadsToExport.filter(c => 
        (c.usdot && String(c.usdot).toLowerCase().includes(q)) ||
        (c.mc_number && String(c.mc_number).toLowerCase().includes(q)) ||
        (c.legal_name && String(c.legal_name).toLowerCase().includes(q))
      );
    }

    if (location && location.trim()) {
      const loc = location.trim().toLowerCase();
      leadsToExport = leadsToExport.filter(c => 
        (c.address && c.address.toLowerCase().includes(loc)) ||
        (c.city && c.city.toLowerCase().includes(loc)) ||
        (c.state && c.state.toLowerCase().includes(loc)) ||
        (c.zip && c.zip.toLowerCase().includes(loc))
      );
    }

    if (authority_status && authority_status !== 'all') {
      const statusFilter = authority_status.toLowerCase();
      leadsToExport = leadsToExport.filter(c => {
        const status = (c.authority_status || '').toLowerCase();
        if (statusFilter === 'active' || statusFilter === 'authorized') {
          return (status.includes('active') || status.includes('authorized')) && !status.includes('not');
        } else if (statusFilter === 'pending' || statusFilter === 'not_authorized' || statusFilter === 'not authorized') {
          return status.includes('pending') || status.includes('not') || status.includes('revoked') || status.includes('inactive');
        }
        return status.includes(statusFilter);
      });
    }

    if (equipment_type && equipment_type !== 'all') {
      const selectedEquip = Array.isArray(equipment_type)
        ? equipment_type.map(e => e.trim().toLowerCase())
        : equipment_type.split(',').map(e => e.trim().toLowerCase()).filter(Boolean);

      if (selectedEquip.length > 0 && !selectedEquip.includes('all')) {
        leadsToExport = leadsToExport.filter(c => {
          const carrierEquip = (c.equipment_type || '').toLowerCase();
          return selectedEquip.some(eq => carrierEquip.includes(eq) || eq.includes(carrierEquip));
        });
      }
    }

    if (cargo_type && cargo_type !== 'all') {
      const selectedCargos = Array.isArray(cargo_type)
        ? cargo_type.map(cg => cg.trim().toLowerCase())
        : cargo_type.split(',').map(cg => cg.trim().toLowerCase()).filter(Boolean);

      if (selectedCargos.length > 0 && !selectedCargos.includes('all')) {
        leadsToExport = leadsToExport.filter(c => {
          if (!c.cargo_classifications) return false;
          const cargos = Array.isArray(c.cargo_classifications) 
            ? c.cargo_classifications.map(x => String(x).toLowerCase())
            : [String(c.cargo_classifications).toLowerCase()];

          return selectedCargos.some(sel => cargos.some(cg => cg.includes(sel)));
        });
      }
    }
  }

  const exportCount = leadsToExport.length;
  if (exportCount === 0) {
    return res.status(400).json({ error: 'No carriers selected to export.' });
  }

  // Plan Limit Check
  if (req.user.role !== 'admin') {
    if (!req.user.plan || req.user.plan === 'unassigned' || req.user.plan === 'none') {
      return res.status(403).json({
        error: 'Service Locked',
        message: 'Your account is pending plan activation by admin. Contact admin to unlock CSV export.',
        code: 'PLAN_UNASSIGNED'
      });
    }

    if (req.user.plan === 'trial') {
      const today = new Date().toISOString().split('T')[0];
      let scrapedToday = req.user.scraped_today || 0;
      if (req.user.last_scraped_date !== today) {
        scrapedToday = 0;
      }

      if (scrapedToday + exportCount > 1000) {
        return res.status(429).json({
          error: 'Daily Trial Limit Exceeded',
          message: `Trial plan limit is 1,000 leads per day. Attempting to export ${exportCount} leads would exceed your daily remaining capacity (${1000 - scrapedToday} left today). Please upgrade to Premium for unlimited exports!`,
          scrapedToday,
          limit: 1000
        });
      }
    }
  }

  // Update user usage count
  db.incrementUserUsage(req.user.id, exportCount);
  db.logActivity(req.user.id, 'EXPORT_CSV', `Exported ${exportCount} carrier leads to CSV`, exportCount);

  // Generate CSV string with requested renamed headers:
  // - "official/ owner" -> "Legal name"
  // - "no. of trucks" -> "Total Equipment"
  // - "truck type" -> "Equipment type"
  const csvRows = [
    [
      'USDOT Number',
      'MC Number',
      'Company Name',
      'Legal name',
      'Operating Status',
      'Email',
      'Phone',
      'Address',
      'Equipment type',
      'Total Equipment',
      'Cargo Classifications'
    ]
  ];

  leadsToExport.forEach(c => {
    const cargosStr = Array.isArray(c.cargo_classifications)
      ? c.cargo_classifications.join('; ')
      : (c.cargo_classifications || 'General Freight');

    const statusStr = (c.authority_status || 'Active').toLowerCase().includes('active') || (c.authority_status || '').toLowerCase().includes('authorized')
      ? 'Active'
      : 'Pending';

    csvRows.push([
      `"${c.usdot || ''}"`,
      `"${c.mc_number || 'N/A'}"`,
      `"${(c.legal_name || '').replace(/"/g, '""')}"`,
      `"${(c.company_official || c.legal_name || 'N/A').replace(/"/g, '""')}"`,
      `"${statusStr}"`,
      `"${c.email || 'N/A'}"`,
      `"${c.telephone || 'N/A'}"`,
      `"${(c.address || 'N/A').replace(/"/g, '""')}"`,
      `"${c.equipment_type || 'Box Truck'}"`,
      `"${c.total_trucks != null ? c.total_trucks : 1}"`,
      `"${cargosStr.replace(/"/g, '""')}"`
    ]);
  });

  const csvContent = csvRows.map(row => row.join(',')).join('\n');

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename=motus_carrier_leads_${Date.now()}.csv`);
  res.send(csvContent);
});

// ─────────────────────────────────────────────────────────────────────────────
// PUT & POST /api/carriers/leads/:usdot & /api/carriers/update-lead
// Allows authenticated users / admins to update lead details manually
// ─────────────────────────────────────────────────────────────────────────────
function handleCarrierUpdateLead(req, res) {
  const usdot = req.params.usdot || req.body.usdot;
  const updateData = req.body || {};

  if (!usdot) {
    return res.status(400).json({ error: 'USDOT parameter is required.' });
  }

  const cleanDot = String(usdot).replace(/\D/g, '').trim();

  // Format MC number if provided
  if (updateData.mc_number && updateData.mc_number !== 'N/A' && updateData.mc_number !== '-') {
    let rawMc = String(updateData.mc_number).trim();
    const digits = rawMc.replace(/\D/g, '');
    if (digits) {
      const prefix = rawMc.match(/^(MC|MX|FF)/i)?.[0]?.toUpperCase() || 'MC';
      updateData.mc_number = `${prefix}-${digits}`;
    }
  }

  // Format city, state, zip if address was updated
  if (updateData.address && (!updateData.city || updateData.city === 'N/A')) {
    const loc = parseCityStateZip(updateData.address);
    if (loc.city) updateData.city = loc.city;
    if (loc.state) updateData.state = loc.state;
    if (loc.zip) updateData.zip = loc.zip;
  }

  let updated = db.updateCarrier(cleanDot, updateData);
  if (!updated) {
    updated = db.addCarrier({ ...updateData, usdot: cleanDot, id: cleanDot });
  }

  if (req.user && req.user.id) {
    try {
      db.logActivity(req.user.id, 'EDIT_LEAD', `User/Admin manually updated carrier lead USDOT ${cleanDot}`);
    } catch (_) {}
  }

  return res.json({
    message: `Lead USDOT ${cleanDot} updated successfully!`,
    carrier: updated
  });
}

router.put('/leads/:usdot', verifyToken, handleCarrierUpdateLead);
router.post('/leads/:usdot', verifyToken, handleCarrierUpdateLead);
router.put('/update-lead', verifyToken, handleCarrierUpdateLead);
router.post('/update-lead', verifyToken, handleCarrierUpdateLead);
router.put('/:usdot', verifyToken, handleCarrierUpdateLead);

module.exports = router;
