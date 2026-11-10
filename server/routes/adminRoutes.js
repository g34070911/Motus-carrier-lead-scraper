const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../db');
const { verifyToken, requireAdmin } = require('../auth');
const { parsePdf } = require('../pdfParser');
const { scrapeMotusCarrier } = require('../motusScraper');
const { scrapeUsdotsWithPuppeteer } = require('../puppeteerScraper');
const { parseCsv, parseCityStateZip, csvRowsToCarrierRecords } = require('../csvHelper');

// In-memory session store for parsed USDOT lists (keyed by session token)
const parsedSessions = {};

// Configure Multer for PDF & CSV file uploads
const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => cb(null, Date.now() + '_' + file.originalname.replace(/[^a-zA-Z0-9._-]/g, ''))
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB max
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf' || file.originalname.endsWith('.pdf')) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed!'));
    }
  }
});

const uploadAny = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }
});

// GET /api/admin/users - Get all registered users
router.get('/users', verifyToken, requireAdmin, (req, res) => {
  const users = db.getUsers().map(u => ({
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role,
    plan: u.plan,
    scraped_today: u.scraped_today || 0,
    last_scraped_date: u.last_scraped_date,
    created_at: u.created_at
  }));
  res.json({ users });
});

// PUT /api/admin/users/:id/plan - Assign plan to user
router.put('/users/:id/plan', verifyToken, requireAdmin, (req, res) => {
  const { id } = req.params;
  const { plan } = req.body;

  if (!['unassigned', 'trial', 'premium'].includes(plan)) {
    return res.status(400).json({ error: 'Invalid plan name. Must be unassigned, trial, or premium.' });
  }

  const updatedUser = db.updateUserPlan(id, plan);
  if (!updatedUser) {
    return res.status(404).json({ error: 'User not found.' });
  }

  db.logActivity(req.user.id, 'PLAN_CHANGE', `Admin updated plan for ${updatedUser.email} to ${plan.toUpperCase()}`);

  res.json({
    message: `Plan updated to ${plan} successfully`,
    user: {
      id: updatedUser.id,
      email: updatedUser.email,
      name: updatedUser.name,
      plan: updatedUser.plan
    }
  });
});

// GET /api/admin/analytics - Admin User Analytics & Action Logs
router.get('/analytics', verifyToken, requireAdmin, (req, res) => {
  const logs = db.getActivityLogs();
  const users = db.getUsers();
  const carriers = db.getCarriers();
  const parsedFiles = db.getParsedFiles();

  const totalLeads = carriers.length;
  const totalUsers = users.length;
  const activeTrialUsers = users.filter(u => u.plan === 'trial').length;
  const activePremiumUsers = users.filter(u => u.plan === 'premium').length;
  const pendingUsers = users.filter(u => u.plan === 'unassigned').length;

  const totalScrapedToday = users.reduce((acc, u) => acc + (u.scraped_today || 0), 0);

  const dateMap = {};
  carriers.forEach(c => {
    const d = c.associated_date || 'Unknown';
    dateMap[d] = (dateMap[d] || 0) + 1;
  });

  res.json({
    metrics: {
      totalLeads,
      totalUsers,
      activeTrialUsers,
      activePremiumUsers,
      pendingUsers,
      totalScrapedToday
    },
    dateBreakdown: dateMap,
    activityLogs: logs,
    parsedFiles
  });
});

// POST /api/admin/upload-pdf - Upload PDF, Parse USDOTs, Scrape MOTUS & Store in DB
router.post('/upload-pdf', verifyToken, requireAdmin, upload.single('pdf'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No PDF file uploaded.' });
    }

    const associatedDate = req.body.associated_date || req.body.date;
    if (!associatedDate) {
      return res.status(400).json({ error: 'Target date (associated_date) is required for PDF parsing.' });
    }

    const filePath = req.file.path;
    console.log(`Processing uploaded PDF: ${req.file.originalname} for date ${associatedDate}`);

    // Step 1: Parse PDF text and extract carrier metadata & USDOTs
    const extractedList = await parsePdf(filePath);

    if (!extractedList || extractedList.length === 0) {
      return res.status(400).json({
        error: 'No motor carrier USDOT records found in the uploaded PDF. Please make sure the PDF contains FMCSA carrier tables.'
      });
    }

    console.log(`Extracted ${extractedList.length} USDOT records from PDF. Starting high-speed batch scrape...`);

    // Step 2: High-speed parallel batch scraping (chunk size 25)
    const BATCH_SIZE = 25;
    const scrapedResults = [];

    for (let i = 0; i < extractedList.length; i += BATCH_SIZE) {
      const chunk = extractedList.slice(i, i + BATCH_SIZE);
      const batchPromises = chunk.map(async (item) => {
        try {
          const fullCarrier = await scrapeMotusCarrier(item.usdot, item);
          fullCarrier.associated_date = associatedDate;
          return fullCarrier;
        } catch (err) {
          return null;
        }
      });

      const batchResults = await Promise.all(batchPromises);
      const validCarriers = batchResults.filter(Boolean);
      db.bulkAddCarriers(validCarriers);
      scrapedResults.push(...validCarriers);
    }

    // Step 3: Record Parsed File log
    const fileRecord = db.addParsedFile({
      filename: req.file.originalname,
      associated_date: associatedDate,
      total_dot_found: extractedList.length,
      total_scraped: scrapedResults.length,
      status: 'completed'
    });

    db.logActivity(
      req.user.id,
      'PARSE_PDF',
      `Uploaded ${req.file.originalname}, extracted ${extractedList.length} USDOTs for date ${associatedDate}`,
      scrapedResults.length
    );

    res.json({
      message: `PDF successfully parsed! Extracted and scraped ${scrapedResults.length} motor carrier leads.`,
      associated_date: associatedDate,
      totalExtracted: extractedList.length,
      totalScraped: scrapedResults.length,
      fileRecord,
      sampleScraped: scrapedResults.slice(0, 5)
    });

  } catch (err) {
    console.error('Error during PDF upload & scraping:', err);
    res.status(500).json({ error: 'Failed to parse PDF and scrape MOTUS data: ' + err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/admin/parse-pdf-only
// Parses the uploaded PDF and returns only the USDOT list (no scraping).
// The list is stored in-memory so the admin can then trigger scraping.
// ─────────────────────────────────────────────────────────────────────────────
router.post('/parse-pdf-only', verifyToken, requireAdmin, upload.single('pdf'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No PDF file uploaded.' });

    const associatedDate = req.body.associated_date;
    if (!associatedDate) return res.status(400).json({ error: 'associated_date is required.' });

    const filePath = req.file.path;
    console.log(`[parse-pdf-only] Parsing: ${req.file.originalname} for date ${associatedDate}`);

    const extractedList = await parsePdf(filePath);

    if (!extractedList || extractedList.length === 0) {
      return res.status(400).json({ error: 'No motor carrier USDOT records found in the PDF.' });
    }

    // Convert extracted motor carriers into preview records for session
    const fullCarriers = extractedList.map(item => {
      const loc = parseCityStateZip(item.address);
      return {
        usdot: String(item.usdot).trim(),
        mc_number: item.mc_number || 'N/A',
        legal_name: item.legal_name || `MOTOR CARRIER ${item.usdot}`,
        authority_status: item.authority_status || 'Active',
        authority_type: item.authority_type || 'Motor Carrier of Property (Except Household Goods)',
        telephone: item.telephone || 'N/A',
        address: item.address || 'N/A',
        city: loc.city || 'N/A',
        state: loc.state || 'N/A',
        zip: loc.zip || 'N/A',
        email: item.email || 'N/A',
        company_official: item.company_official && item.company_official !== 'N/A' ? item.company_official : (item.legal_name || 'N/A'),
        total_trucks: item.total_trucks || 1,
        equipment_type: item.equipment_type || 'Box Truck',
        cargo_classifications: item.cargo_classifications || ['General Freight'],
        filing_date: item.filing_date || '',
        associated_date: associatedDate,
        motus_url: `https://motus.dot.gov/customer/${item.usdot}/account`,
        source: 'pdf_parser'
      };
    });

    // DO NOT save raw PDF parse data into the database.
    // In Search Leads section, only data scraped from MOTUS is added!

    // Record uploaded PDF file record
    const fileRecord = db.addParsedFile({
      filename: req.file.originalname,
      associated_date: associatedDate,
      total_dot_found: extractedList.length,
      total_scraped: 0,
      status: 'pending_scrape'
    });

    // Log admin activity
    db.logActivity(
      req.user.id,
      'PARSE_PDF',
      `Uploaded ${req.file.originalname}, extracted ${extractedList.length} USDOTs for date ${associatedDate}. Ready for MOTUS web scraping.`,
      extractedList.length
    );

    // Store parsed session so scrape-stream can scrape MOTUS web data
    const sessionId = 'sess_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8);
    parsedSessions[sessionId] = {
      usdotList: extractedList.map(c => c.usdot),
      carriers: fullCarriers,
      associatedDate,
      filename: req.file.originalname,
      createdAt: Date.now()
    };

    // Clean old sessions (older than 2 hours)
    const now = Date.now();
    Object.keys(parsedSessions).forEach(k => {
      if (now - parsedSessions[k].createdAt > 7200000) delete parsedSessions[k];
    });

    console.log(`[parse-pdf-only] Extracted ${extractedList.length} USDOTs from PDF. Ready for MOTUS scraping. Session: ${sessionId}`);

    res.json({
      message: `PDF parsed successfully! Extracted ${extractedList.length} USDOT records. Click "Start Scraping MOTUS Website" to scrape and add them to Search Leads.`,
      sessionId,
      associatedDate,
      totalExtracted: extractedList.length,
      totalSaved: 0,
      fileRecord,
      carriers: fullCarriers
    });

  } catch (err) {
    console.error('[parse-pdf-only] Error:', err);
    res.status(500).json({ error: 'Failed to parse PDF: ' + err.message });
  }
});

// DELETE /api/admin/clear-leads - Delete all carrier leads from DB
router.delete('/clear-leads', verifyToken, requireAdmin, (req, res) => {
  const count = db.clearAllCarriers();
  db.logActivity(req.user.id, 'CLEAR_DATABASE', `Admin deleted all ${count} carrier leads from database`);
  res.json({ message: `Successfully deleted all ${count} previous carrier leads from database.`, count });
});

// POST /api/admin/delete-leads - Delete specific or all selected carrier leads (Admin Only)
router.post('/delete-leads', verifyToken, requireAdmin, (req, res) => {
  const { usdots, all, associated_date } = req.body;

  if (all) {
    let count;
    if (associated_date) {
      const carriers = db.getCarriers().filter(c => c.associated_date === associated_date);
      const dots = carriers.map(c => c.usdot);
      count = db.deleteCarriersByUsdots(dots);
      db.logActivity(req.user.id, 'DELETE_LEADS', `Admin deleted all ${count} leads for date ${associated_date}`, count);
    } else {
      count = db.clearAllCarriers();
      db.logActivity(req.user.id, 'CLEAR_DATABASE', `Admin deleted all ${count} carrier leads from database`, count);
    }
    return res.json({ message: `Successfully deleted ${count} leads`, count });
  }

  if (!usdots || !Array.isArray(usdots) || usdots.length === 0) {
    return res.status(400).json({ error: 'Please provide an array of USDOTs to delete.' });
  }

  const count = db.deleteCarriersByUsdots(usdots);
  db.logActivity(req.user.id, 'DELETE_LEADS', `Admin deleted ${count} specific carrier lead(s)`, count);
  res.json({ message: `Successfully deleted ${count} carrier lead(s).`, count });
});

// DELETE /api/admin/leads/:usdot - Delete single carrier lead by USDOT (Admin Only)
router.delete('/leads/:usdot', verifyToken, requireAdmin, (req, res) => {
  const { usdot } = req.params;
  const count = db.deleteCarriersByUsdots([usdot]);
  if (count > 0) {
    db.logActivity(req.user.id, 'DELETE_LEAD', `Admin deleted carrier lead USDOT ${usdot}`);
    res.json({ message: `Successfully deleted lead ${usdot}.`, count });
  } else {
    res.status(404).json({ error: `Lead with USDOT ${usdot} not found.` });
  }
});

// Helper handler for manual lead updates
function handleAdminUpdateLead(req, res) {
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
      db.logActivity(req.user.id, 'EDIT_LEAD', `Admin manually updated carrier lead USDOT ${cleanDot}`);
    } catch (_) {}
  }

  return res.json({
    message: `Lead USDOT ${cleanDot} updated successfully!`,
    carrier: updated
  });
}

// PUT & POST /api/admin/leads/:usdot - Update single carrier lead manually (Admin Only)
router.put('/leads/:usdot', verifyToken, requireAdmin, handleAdminUpdateLead);
router.post('/leads/:usdot', verifyToken, requireAdmin, handleAdminUpdateLead);
router.put('/update-lead', verifyToken, requireAdmin, handleAdminUpdateLead);
router.post('/update-lead', verifyToken, requireAdmin, handleAdminUpdateLead);

// GET /api/admin/pdfs - List all uploaded/saved PDF files
router.get('/pdfs', verifyToken, requireAdmin, (req, res) => {
  const files = db.getParsedFiles();
  res.json({ files });
});

// DELETE /api/admin/pdfs/:id - Remove a saved PDF record from admin section
router.delete('/pdfs/:id', verifyToken, requireAdmin, (req, res) => {
  const { id } = req.params;
  const deleted = db.deleteParsedFile(id);
  if (deleted) {
    db.logActivity(req.user.id, 'DELETE_PDF', `Admin removed PDF record ${id}`);
    res.json({ message: 'PDF record removed successfully.' });
  } else {
    res.status(404).json({ error: 'PDF record not found.' });
  }
});

// POST /api/admin/import-leads - Import carrier leads from CSV/Excel data or direct file upload
router.post('/import-leads', verifyToken, requireAdmin, uploadAny.single('file'), (req, res) => {
  try {
    let validLeads = [];
    let filename = req.body.filename;
    const associatedDate = req.body.associated_date || req.body.date || new Date().toLocaleDateString('en-US');

    // Case 1: Direct file upload via FormData
    if (req.file) {
      filename = filename || req.file.originalname;
      const csvContent = fs.readFileSync(req.file.path, 'utf-8');
      const rows = parseCsv(csvContent);
      validLeads = csvRowsToCarrierRecords(rows, associatedDate);
    }
    // Case 2: Raw CSV text passed in request body
    else if (typeof req.body.leads === 'string') {
      const rows = parseCsv(req.body.leads);
      validLeads = csvRowsToCarrierRecords(rows, associatedDate);
    }
    // Case 3: Pre-parsed rows array (either 2D array or array of objects)
    else if (Array.isArray(req.body.leads)) {
      if (req.body.leads.length > 0 && Array.isArray(req.body.leads[0])) {
        // 2D row array
        validLeads = csvRowsToCarrierRecords(req.body.leads, associatedDate);
      } else {
        // Array of row objects
        validLeads = req.body.leads
          .filter(row => row && (row.usdot || row.USDOT || row['USDOT Number'] || row['usdot number']))
          .map(row => {
            const rawDot = row.usdot || row.USDOT || row['USDOT Number'] || row['usdot number'] || '';
            const usdot = String(rawDot).replace(/\D/g, '').trim();

            const rawMc = row.mc_number || row['MC Number'] || row['mc number'] || row.mc || 'N/A';
            let mc_number = String(rawMc).trim();
            if (!mc_number || mc_number === '-' || mc_number.toLowerCase() === 'n/a') {
              mc_number = 'N/A';
            } else {
              const digits = mc_number.replace(/\D/g, '');
              if (digits) {
                mc_number = mc_number.toUpperCase().startsWith('MC') ? mc_number : `MC-${digits}`;
              }
            }

            const legal_name = String(row.legal_name || row['Company Name'] || row['company name'] || row.name || `MOTOR CARRIER ${usdot}`).trim();
            const rawStatus = String(row.authority_status || row['Status'] || row['Operating Status'] || row.status || 'Active').trim();
            const authority_status = rawStatus.toLowerCase().includes('pending') || rawStatus.toLowerCase().includes('not') ? 'Pending' : 'Active';

            const telephone = String(row.telephone || row['Phone'] || row['phone'] || 'N/A').trim();
            const address = String(row.address || row['Address'] || 'N/A').trim();
            const loc = parseCityStateZip(address);
            const city = row.city || row['City'] || loc.city || 'N/A';
            const state = row.state || row['State'] || loc.state || 'N/A';
            const zip = row.zip || row['Zip'] || loc.zip || 'N/A';
            const email = String(row.email || row['Email'] || 'N/A').trim();
            const official = String(row.company_official || row['Official / Owner'] || row['Official/ Owner'] || row['Legal name'] || row['Legal Name'] || row.owner || legal_name).trim();

            const total_trucks = parseInt(row.total_trucks || row['Total Equipment'] || row['No. of Trucks'] || row['No of Trucks'] || '1', 10) || 1;
            let equipment_type = String(row.equipment_type || row['Equipment type'] || row['Truck Type'] || row.type || (total_trucks > 3 ? 'Fleet' : 'Box Truck')).trim();
            if (!equipment_type || equipment_type === 'N/A') equipment_type = total_trucks > 3 ? 'Fleet' : 'Box Truck';

            const cargo = row.cargo_classifications || row['Cargo Types'] || ['General Freight'];

            return {
              usdot,
              mc_number,
              legal_name,
              authority_status,
              authority_type: 'Motor Carrier of Property (Except Household Goods)',
              telephone,
              address,
              city,
              state,
              zip,
              email,
              company_official: official,
              total_trucks,
              equipment_type,
              cargo_classifications: Array.isArray(cargo) ? cargo : [cargo],
              associated_date: associatedDate,
              motus_url: `https://motus.dot.gov/customer/${usdot}/account`,
              source: 'csv_import'
            };
          }).filter(c => c.usdot && c.usdot.length >= 5);
      }
    }

    if (!validLeads || validLeads.length === 0) {
      return res.status(400).json({ error: 'No valid motor carrier USDOT rows recognized in imported dataset.' });
    }

    // Deduplicate and save into database
    const count = db.bulkAddCarriers(validLeads);

    // Record imported file log
    const fileRecord = db.addParsedFile({
      filename: filename || 'Imported_Leads.csv',
      associated_date: associatedDate,
      total_dot_found: validLeads.length,
      total_scraped: count,
      status: 'completed'
    });

    db.logActivity(
      req.user.id,
      'IMPORT_LEADS',
      `Admin imported ${count} leads from ${filename || 'file'} for date ${associatedDate}`,
      count
    );

    res.json({
      message: `Successfully imported and saved ${count} carrier leads into database! Leads are now immediately available in Lead Search.`,
      totalImported: count,
      associated_date: associatedDate,
      fileRecord,
      sample: validLeads.slice(0, 5)
    });
  } catch (err) {
    console.error('[import-leads] Error:', err);
    res.status(500).json({ error: 'Failed to import leads: ' + err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/admin/scrape-stream?sessionId=XXX&associated_date=MM/DD/YYYY
// ─────────────────────────────────────────────────────────────────────────────
// POST /api/admin/pause-scrape
// Pauses an active scraping session cleanly.
// ─────────────────────────────────────────────────────────────────────────────
router.post('/pause-scrape', verifyToken, requireAdmin, (req, res) => {
  const { sessionId } = req.body;
  if (!sessionId || !parsedSessions[sessionId]) {
    return res.status(400).json({ error: 'Invalid or active session not found.' });
  }

  const session = parsedSessions[sessionId];
  session.isPaused = true;
  session.status = 'paused';
  console.log(`[pause-scrape] Pause requested for session ${sessionId} at item index ${session.currentIndex || 0}`);

  res.json({
    message: 'Scraping pause requested cleanly.',
    sessionId,
    currentIndex: session.currentIndex || 0,
    total: (session.usdotList || []).length
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/admin/stop-scrape
// Cancels/stops a scraping session completely.
// ─────────────────────────────────────────────────────────────────────────────
router.post('/stop-scrape', verifyToken, requireAdmin, (req, res) => {
  const { sessionId } = req.body;
  if (sessionId && parsedSessions[sessionId]) {
    const session = parsedSessions[sessionId];
    session.isCanceled = true;
    session.status = 'stopped';
    delete parsedSessions[sessionId];
    console.log(`[stop-scrape] Session ${sessionId} stopped and removed.`);
  }
  res.json({ message: 'Scraping session stopped.' });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/admin/scrape-stream?sessionId=XXX&startIndex=N
// Server-Sent Events (SSE) endpoint.
// Streams progress events to the frontend in real-time.
// Supports pausing and resuming from startIndex.
// ─────────────────────────────────────────────────────────────────────────────
router.get('/scrape-stream', verifyToken, requireAdmin, async (req, res) => {
  const { sessionId, startIndex: reqStartIndex } = req.query;

  if (!sessionId || !parsedSessions[sessionId]) {
    return res.status(400).json({ error: 'Invalid or expired session ID. Please upload & parse a PDF first.' });
  }

  const session = parsedSessions[sessionId];
  const { usdotList, carriers, associatedDate, filename } = session;
  const itemsToScrape = carriers && carriers.length > 0 ? carriers : usdotList;

  const startIndex = reqStartIndex !== undefined ? Math.max(0, parseInt(reqStartIndex, 10)) : (session.currentIndex || 0);

  session.isPaused = false;
  session.isCanceled = false;
  session.status = 'scraping';
  session.currentIndex = startIndex;

  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.flushHeaders();

  let isCanceledFlag = false;

  req.on('close', () => {
    console.log(`[scrape-stream] Client closed connection for session ${sessionId}. Pausing scrape.`);
    session.isPaused = true;
  });

  function sendEvent(data) {
    if (!res.writableEnded) {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    }
  }

  sendEvent({
    type: 'start',
    total: itemsToScrape.length,
    startIndex,
    message: `Starting Puppeteer scrape of ${itemsToScrape.length} USDOTs from item #${startIndex + 1}...`
  });

  try {
    const scrapedResults = await scrapeUsdotsWithPuppeteer(
      itemsToScrape,
      associatedDate,
      (progress) => {
        if (progress.current !== undefined) {
          session.currentIndex = progress.current - 1;
        }
        sendEvent({
          type: 'progress',
          current: progress.current,
          total: progress.total,
          usdot: progress.usdot,
          status: progress.status,
          carrier: progress.carrier || null,
          error: progress.error || null
        });

        // Store each scraped carrier immediately in DB
        if ((progress.status === 'done' || progress.status === 'already_available') && progress.carrier) {
          try { db.addCarrier(progress.carrier); } catch(e) {}
        }
      },
      () => isCanceledFlag || session.isCanceled,
      {
        startIndex,
        isPaused: () => session.isPaused
      }
    );

    if (session.isPaused) {
      console.log(`[scrape-stream] Session ${sessionId} paused at index ${session.currentIndex}`);
      sendEvent({
        type: 'paused',
        currentIndex: session.currentIndex,
        total: itemsToScrape.length,
        message: `Scraping paused at item #${session.currentIndex + 1} of ${itemsToScrape.length}. Click Resume to continue anytime.`
      });
    } else {
      session.status = 'completed';

      // Log parsed file record
      db.addParsedFile({
        filename,
        associated_date: associatedDate,
        total_dot_found: usdotList.length,
        total_scraped: scrapedResults.length,
        status: (isCanceledFlag || session.isCanceled) ? 'stopped_early' : 'completed'
      });

      db.logActivity(
        req.user.id,
        'PARSE_PDF',
        `Puppeteer scraped ${scrapedResults.length}/${usdotList.length} USDOTs from ${filename} for date ${associatedDate}`,
        scrapedResults.length
      );

      // Clean session only when completely done or canceled
      delete parsedSessions[sessionId];

      sendEvent({
        type: 'complete',
        totalScraped: scrapedResults.length,
        total: usdotList.length,
        wasStopped: isCanceledFlag || session.isCanceled
      });
    }

  } catch (err) {
    console.error('[scrape-stream] Error during stream processing:', err);
    sendEvent({ type: 'error', message: err.message });
  }

  res.end();
});

module.exports = router;
