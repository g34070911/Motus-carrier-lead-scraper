const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

// Initial default database structure
const initialData = {
  users: [
    {
      id: 'usr_admin_1',
      email: 'admin@motus.com',
      passwordHash: 'admin123', // In real auth, hashed with bcrypt
      name: 'System Admin',
      role: 'admin',
      plan: 'premium',
      scraped_today: 0,
      last_scraped_date: new Date().toISOString().split('T')[0],
      created_at: new Date().toISOString()
    },
    {
      id: 'usr_demo_1',
      email: 'john@logistics.com',
      passwordHash: 'user123',
      name: 'John Smith (Trial)',
      role: 'user',
      plan: 'trial',
      scraped_today: 142,
      last_scraped_date: new Date().toISOString().split('T')[0],
      created_at: new Date(Date.now() - 86400000 * 2).toISOString()
    },
    {
      id: 'usr_demo_2',
      email: 'sarah@freightco.com',
      passwordHash: 'user123',
      name: 'Sarah Connor (Pending)',
      role: 'user',
      plan: 'unassigned',
      scraped_today: 0,
      last_scraped_date: new Date().toISOString().split('T')[0],
      created_at: new Date(Date.now() - 86400000 * 1).toISOString()
    }
  ],
  carriers: [],
  parsed_files: [],
  user_activity: [
    {
      id: 'act_1',
      user_id: 'usr_demo_1',
      user_email: 'john@logistics.com',
      user_name: 'John Smith (Trial)',
      action_type: 'SEARCH',
      details: 'Searched carriers by Date 09/15/2026',
      leads_count: 24,
      timestamp: new Date(Date.now() - 3600000 * 3).toISOString()
    },
    {
      id: 'act_2',
      user_id: 'usr_demo_1',
      user_email: 'john@logistics.com',
      user_name: 'John Smith (Trial)',
      action_type: 'EXPORT_CSV',
      details: 'Exported 142 carrier leads to CSV',
      leads_count: 142,
      timestamp: new Date(Date.now() - 3600000 * 1).toISOString()
    },
    {
      id: 'act_3',
      user_id: 'usr_admin_1',
      user_email: 'admin@motus.com',
      user_name: 'System Admin',
      action_type: 'PARSE_PDF',
      details: 'Uploaded & parsed FMCSA_Register_2026-09-15.pdf for date 09/15/2026',
      leads_count: 50,
      timestamp: new Date(Date.now() - 86400000).toISOString()
    }
  ]
};

class Database {
  constructor() {
    this.ensureDir();
    this.load();
  }

  ensureDir() {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
  }

  load() {
    if (!fs.existsSync(DB_FILE)) {
      this.data = initialData;
      this.save();
    } else {
      try {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        this.data = JSON.parse(raw);
        // ensure sections exist
        if (!this.data.users) this.data.users = [];
        if (!this.data.carriers) this.data.carriers = [];
        if (!this.data.parsed_files) this.data.parsed_files = [];
        if (!this.data.user_activity) this.data.user_activity = [];

        // Ensure default system admin account exists
        const adminExists = this.data.users.some(u => u.email && u.email.toLowerCase() === 'admin@motus.com');
        if (!adminExists) {
          this.data.users.unshift(initialData.users[0]);
        }

        // Strict deduplication of carriers by USDOT primary key
        if (Array.isArray(this.data.carriers) && this.data.carriers.length > 0) {
          const carrierMap = new Map();
          for (const c of this.data.carriers) {
            if (!c || !c.usdot) continue;
            const dot = String(c.usdot).replace(/\D/g, '').trim();
            if (!dot) continue;
            c.id = dot;
            c.usdot = dot;
            if (carrierMap.has(dot)) {
              carrierMap.set(dot, { ...carrierMap.get(dot), ...c });
            } else {
              carrierMap.set(dot, c);
            }
          }
          const deduplicated = Array.from(carrierMap.values());
          if (deduplicated.length !== this.data.carriers.length) {
            console.log(`[db] Deduplicated carriers by USDOT primary key: ${this.data.carriers.length} -> ${deduplicated.length}`);
            this.data.carriers = deduplicated;
            this.save();
          } else {
            this.data.carriers = deduplicated;
          }
        }
      } catch (err) {
        console.error('Error loading DB file, resetting:', err);
        this.data = initialData;
        this.save();
      }
    }
  }

  save() {
    fs.writeFileSync(DB_FILE, JSON.stringify(this.data, null, 2), 'utf-8');
  }

  // User methods
  getUsers() {
    return this.data.users;
  }

  getUserById(id) {
    if (!id) return null;
    return this.data.users.find(u => u.id === id);
  }

  getUserByEmail(email) {
    if (!email) return null;
    const clean = String(email).trim().toLowerCase();
    return this.data.users.find(u => u.email && u.email.trim().toLowerCase() === clean);
  }

  createUser(userData) {
    const cleanEmail = String(userData.email).trim().toLowerCase();
    const newUser = {
      id: 'usr_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      email: cleanEmail,
      passwordHash: String(userData.passwordHash).trim(),
      name: String(userData.name).trim(),
      role: userData.role || 'user',
      plan: userData.plan || (userData.role === 'admin' ? 'premium' : 'unassigned'),
      scraped_today: 0,
      last_scraped_date: new Date().toISOString().split('T')[0],
      created_at: new Date().toISOString()
    };
    this.data.users.push(newUser);
    this.save();
    return newUser;
  }

  updateUserPlan(userId, newPlan) {
    const user = this.getUserById(userId);
    if (user) {
      user.plan = newPlan;
      this.save();
      return user;
    }
    return null;
  }

  incrementUserUsage(userId, count = 1) {
    const user = this.getUserById(userId);
    if (!user) return null;

    const today = new Date().toISOString().split('T')[0];
    if (user.last_scraped_date !== today) {
      user.scraped_today = 0;
      user.last_scraped_date = today;
    }

    user.scraped_today += count;
    this.save();
    return user;
  }

  // Carrier methods (USDOT is the Primary Key)
  getCarriers() {
    return this.data.carriers;
  }

  getCarrierByUsdot(usdot) {
    if (!usdot) return null;
    const cleanDot = String(usdot).replace(/\D/g, '').trim();
    if (!cleanDot) return null;
    return this.data.carriers.find(c => String(c.usdot).replace(/\D/g, '').trim() === cleanDot) || null;
  }

  clearAllCarriers() {
    const count = this.data.carriers.length;
    this.data.carriers = [];
    this.data.parsed_files = [];
    this.save();
    console.log(`[db] Cleared all ${count} carrier leads from database.`);
    return count;
  }

  deleteCarriersByUsdots(usdots = []) {
    if (!Array.isArray(usdots) || usdots.length === 0) return 0;
    const dotSet = new Set(usdots.map(d => String(d).replace(/\D/g, '').trim()).filter(Boolean));
    const initialCount = this.data.carriers.length;
    this.data.carriers = this.data.carriers.filter(c => !dotSet.has(String(c.usdot).replace(/\D/g, '').trim()));
    const deletedCount = initialCount - this.data.carriers.length;
    this.save();
    console.log(`[db] Deleted ${deletedCount} carrier leads by USDOT primary key.`);
    return deletedCount;
  }

  deleteCarrierByUsdot(usdot) {
    return this.deleteCarriersByUsdots([usdot]);
  }

  updateCarrier(usdot, updateFields) {
    if (!usdot) return null;
    const cleanDot = String(usdot).replace(/\D/g, '').trim();
    if (!cleanDot) return null;

    const existingIndex = this.data.carriers.findIndex(
      c => String(c.usdot).replace(/\D/g, '').trim() === cleanDot
    );

    if (existingIndex < 0) return null;

    const updatedRecord = {
      ...this.data.carriers[existingIndex],
      ...updateFields,
      id: cleanDot,
      usdot: cleanDot,
      updated_at: new Date().toISOString()
    };

    this.data.carriers[existingIndex] = updatedRecord;
    this.save();
    console.log(`[db] Updated carrier lead USDOT ${cleanDot}`);
    return updatedRecord;
  }

  addCarrier(carrierData) {
    if (!carrierData || !carrierData.usdot) return null;
    const cleanDot = String(carrierData.usdot).replace(/\D/g, '').trim();
    if (!cleanDot) return null;

    // Strict deduplication by USDOT Primary Key
    const existingIndex = this.data.carriers.findIndex(
      c => String(c.usdot).replace(/\D/g, '').trim() === cleanDot
    );

    const record = {
      ...carrierData,
      id: cleanDot,       // USDOT is the Primary Key
      usdot: cleanDot,    // USDOT is the Primary Key
      updated_at: new Date().toISOString(),
      created_at: existingIndex >= 0 ? (this.data.carriers[existingIndex].created_at || new Date().toISOString()) : new Date().toISOString()
    };

    if (existingIndex >= 0) {
      // Merge into existing record by USDOT primary key
      this.data.carriers[existingIndex] = {
        ...this.data.carriers[existingIndex],
        ...record
      };
    } else {
      this.data.carriers.push(record);
    }

    this.save();
    return record;
  }

  bulkAddCarriers(carriersList) {
    if (!Array.isArray(carriersList) || carriersList.length === 0) return 0;
    let count = 0;
    for (const c of carriersList) {
      if (!c || !c.usdot) continue;
      const cleanDot = String(c.usdot).replace(/\D/g, '').trim();
      if (!cleanDot) continue;

      const existingIndex = this.data.carriers.findIndex(
        item => String(item.usdot).replace(/\D/g, '').trim() === cleanDot
      );

      const record = {
        ...c,
        id: cleanDot,       // USDOT is the Primary Key
        usdot: cleanDot,    // USDOT is the Primary Key
        updated_at: new Date().toISOString(),
        created_at: existingIndex >= 0 ? (this.data.carriers[existingIndex].created_at || new Date().toISOString()) : new Date().toISOString()
      };

      if (existingIndex >= 0) {
        // Merge into existing record by USDOT primary key
        this.data.carriers[existingIndex] = {
          ...this.data.carriers[existingIndex],
          ...record
        };
      } else {
        this.data.carriers.push(record);
      }
      count++;
    }
    this.save();
    return count;
  }

  // Activity log methods
  logActivity(userId, actionType, details, leadsCount = 0) {
    const user = this.getUserById(userId);
    const activity = {
      id: 'act_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      user_id: userId,
      user_email: user ? user.email : 'Unknown',
      user_name: user ? user.name : 'Unknown',
      action_type: actionType,
      details: details,
      leads_count: leadsCount,
      timestamp: new Date().toISOString()
    };
    this.data.user_activity.unshift(activity); // latest first
    this.save();
    return activity;
  }

  getActivityLogs() {
    return this.data.user_activity;
  }

  // Parsed / Uploaded Files log
  addParsedFile(fileLog) {
    const record = {
      id: 'file_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      ...fileLog,
      uploaded_at: new Date().toISOString(),
      created_at: new Date().toISOString()
    };
    this.data.parsed_files.unshift(record);
    this.save();
    return record;
  }

  getParsedFiles() {
    return this.data.parsed_files;
  }

  deleteParsedFile(id) {
    const initialLen = this.data.parsed_files.length;
    this.data.parsed_files = this.data.parsed_files.filter(f => f.id !== id);
    const deleted = initialLen !== this.data.parsed_files.length;
    if (deleted) this.save();
    return deleted;
  }
}

module.exports = new Database();
