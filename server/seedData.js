const db = require('./db');
const { generateFallbackCarrierData } = require('./motusScraper');

// *** MOTOR CARRIERS ONLY — Brokers, Freight Forwarders & Enterprise carriers excluded ***
const sampleCarriersFromPdf = [
  // ── 09/15/2026 Motor Carrier of Property (Except Household Goods) ────────
  { usdot: '5483688', legal_name: 'TRUE FIX BUILDERS', telephone: '+1 (713) 444-0199', company_official: 'James Wilson', address: '420 Commerce Blvd, Houston, TX 77002 US', date: '09/15/2026', authority_type: 'MOTOR CARRIER OF HOUSEHOLD GOODS' },
  { usdot: '7670563', legal_name: 'GOLDEN BOX LLC', telephone: '+1 (214) 555-0144', company_official: 'Maria Garcia', address: '821 Oak Ave, Dallas, TX 75201 US', date: '09/15/2026', authority_type: 'MOTOR CARRIER OF HOUSEHOLD GOODS' },
  { usdot: '3765012', legal_name: 'JAT TRUCKING LLC', telephone: '+1 (312) 555-0188', company_official: 'Jaswant Toor', address: '345 Maple St, Chicago, IL 60606 US', date: '09/15/2026', authority_type: 'MOTOR CARRIER OF HOUSEHOLD GOODS' },
  { usdot: '9893467', legal_name: 'APEX TRANSPORT INC', telephone: '+1 (786) 546-9446', company_official: 'Jose Perez', address: '16927 SW 141st Ave, Miami, FL 33177 US', date: '09/15/2026', authority_type: 'MOTOR CARRIER OF PROPERTY (EXCEPT HOUSEHOLD GOODS)' },
  { usdot: '4687583', legal_name: 'MARSHLINE LOGISTICS INC.', telephone: '+1 (912) 660-1483', company_official: 'Sunny Gilstrap', address: '230 B Salt Creek Rd, Savannah, GA 31405 US', date: '09/15/2026', authority_type: 'MOTOR CARRIER OF PROPERTY (EXCEPT HOUSEHOLD GOODS)' },
  { usdot: '8683355', legal_name: 'PRIPLO LOGISTIC SOLUTIONS LLC', telephone: '+1 (832) 777-7664', company_official: 'Alexander Gulle', address: '435 Rocky Briar Ct, Richmond, TX 77406 US', date: '09/15/2026', authority_type: 'MOTOR CARRIER OF PROPERTY (EXCEPT HOUSEHOLD GOODS)' },
  { usdot: '6852163', legal_name: 'BAYOU EXPRESS CARRIERS LLC', telephone: '+1 (512) 762-8822', company_official: 'Rodrigo Escalante', address: '2918 Oakwood Shores, Richwood, TX 77515 US', date: '09/15/2026', authority_type: 'MOTOR CARRIER OF PROPERTY (EXCEPT HOUSEHOLD GOODS)' },
  { usdot: '5084432', legal_name: 'LAWRENCE TRUCKING LLC', telephone: '+1 (404) 490-0526', company_official: 'Christy Smith', address: '1783 Great Shoals Cir, Lawrenceville, GA 30045 US', date: '09/15/2026', authority_type: 'MOTOR CARRIER OF PROPERTY (EXCEPT HOUSEHOLD GOODS)' },
  { usdot: '9378160', legal_name: 'COUNTRY ROAD CARRIERS LLC', telephone: '+1 (435) 633-5252', company_official: 'Zachery Leavitt', address: '710 Lacey Way, North Salt Lake, UT 84054 US', date: '09/15/2026', authority_type: 'MOTOR CARRIER OF PROPERTY (EXCEPT HOUSEHOLD GOODS)' },
  { usdot: '9777167', legal_name: 'KJD FREIGHT SERVICES LIMITED', telephone: '+1 (404) 797-1406', company_official: 'Kristen Jarrell', address: '473 E Carnegie Dr, San Bernardino, CA 92408 US', date: '09/15/2026', authority_type: 'MOTOR CARRIER OF PROPERTY (EXCEPT HOUSEHOLD GOODS)' },
  { usdot: '7140957', legal_name: 'SIMS TRANSPORT INC', telephone: '+1 (469) 823-7416', company_official: 'Jeff Sims', address: '2808 Half Moon, Aubrey, TX 76227 US', date: '09/15/2026', authority_type: 'MOTOR CARRIER OF PROPERTY (EXCEPT HOUSEHOLD GOODS)' },
  { usdot: '6639266', legal_name: 'SERAPH KINGDOM CARRIERS LLC', telephone: '+1 (515) 505-6796', company_official: 'Robert Oulsey-Lee', address: '2809 Guthrie Ave, Des Moines, IA 50317 US', date: '09/15/2026', authority_type: 'MOTOR CARRIER OF PROPERTY (EXCEPT HOUSEHOLD GOODS)' },
  { usdot: '5812690', legal_name: 'NET TRUCKING SOLUTIONS LLC', telephone: '+1 (307) 218-5133', company_official: 'Willie Deane', address: '1600 Albany St, Schenectady, NY 12304 US', date: '09/15/2026', authority_type: 'MOTOR CARRIER OF PROPERTY (EXCEPT HOUSEHOLD GOODS)' },
  { usdot: '9598946', legal_name: 'NATIONAL FREIGHT INC', telephone: '+1 (708) 205-5438', company_official: 'Dorian Meraz', address: '645 East George St, Bensenville, IL 60106 US', date: '09/15/2026', authority_type: 'MOTOR CARRIER OF PROPERTY (EXCEPT HOUSEHOLD GOODS)' },
  { usdot: '5636360', legal_name: 'BOBA TRUCKING GROUP LLC', telephone: '+1 (732) 484-4157', company_official: 'Monica Bobadilla Nova', address: '140 East Ridgewood Ave, Paramus, NJ 07652 US', date: '09/15/2026', authority_type: 'MOTOR CARRIER OF PROPERTY (EXCEPT HOUSEHOLD GOODS)' },
  { usdot: '3703871', legal_name: 'JMD CARRIERS LLC', telephone: '7326093997', company_official: 'Bhaskar Bajaj', address: '1423 Northumberland Way, Monmouth Jct, NJ 08852 US', date: '09/15/2026', authority_type: 'MOTOR CARRIER OF PROPERTY (EXCEPT HOUSEHOLD GOODS)' },
  { usdot: '7386739', legal_name: 'SHIPX TRANSPORT LLC', telephone: '+1 (267) 799-3406', company_official: 'Trey Grupp', address: '6 Ronald Dr, Holland, PA 18966 US', date: '09/15/2026', authority_type: 'MOTOR CARRIER OF PROPERTY (EXCEPT HOUSEHOLD GOODS)' },
  { usdot: '8975826', legal_name: 'GLOBAL TRUCKING SOLUTIONS LLC', telephone: '+1 (816) 947-8222', company_official: 'Kenneth Harris', address: '30 N Gould St #66515, Sheridan, WY 82801 US', date: '09/15/2026', authority_type: 'MOTOR CARRIER OF PROPERTY (EXCEPT HOUSEHOLD GOODS)' },
  // ── 03/10/2026 Motor Carrier entries ────────────────────────────────────
  { usdot: '3001234', legal_name: 'TEXAS STAR EXPRESS LLC', telephone: '+1 (214) 555-0199', company_official: 'Carlos Delgado', address: '789 Commerce St, Dallas, TX 75201 US', date: '03/10/2026', authority_type: 'MOTOR CARRIER OF PROPERTY (EXCEPT HOUSEHOLD GOODS)' },
  { usdot: '3005678', legal_name: 'MIDWEST FREIGHT SYSTEMS INC', telephone: '+1 (312) 555-0144', company_official: 'Brian Miller', address: '450 Michigan Ave, Chicago, IL 60611 US', date: '03/10/2026', authority_type: 'MOTOR CARRIER OF PROPERTY (EXCEPT HOUSEHOLD GOODS)' },
  { usdot: '3009912', legal_name: 'PACIFIC COAST CARRIERS LLC', telephone: '+1 (415) 555-0188', company_official: 'Elena Rostova', address: '1200 Market St, San Francisco, CA 94102 US', date: '03/10/2026', authority_type: 'MOTOR CARRIER OF PROPERTY (EXCEPT HOUSEHOLD GOODS)' }
];

function seedDatabase() {
  const existingCarriers = db.getCarriers();
  if (existingCarriers.length === 0) {
    console.log('[seedData] No carriers in database. Ready for user PDF parse or CSV import.');
  } else {
    console.log(`[seedData] Database initialized with ${existingCarriers.length} existing carrier leads.`);
  }
}

module.exports = { seedDatabase };
