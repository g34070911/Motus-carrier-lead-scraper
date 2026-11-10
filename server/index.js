const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

dotenv.config();

const { seedDatabase } = require('./seedData');
const authRoutes = require('./routes/authRoutes');
const adminRoutes = require('./routes/adminRoutes');
const carrierRoutes = require('./routes/carrierRoutes');

const app = express();
const PORT = process.env.PORT || 5000;

// Seed sample carrier data from FMCSA PDF register on start
seedDatabase();

// Middleware
app.use(cors());
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/carriers', carrierRoutes);

// Healthcheck route
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// Serve frontend static files in production if dist exists
const clientDistPath = path.join(__dirname, '../dist');
app.use(express.static(clientDistPath));

// Fallback route handler for single page application in Express 5
app.use((req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'API endpoint not found' });
  }
  const indexPath = path.join(clientDistPath, 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.send('MOTUS Carrier Scraper Server is running on port ' + PORT);
  }
});

app.listen(PORT, () => {
  console.log(`===================================================`);
  console.log(` MOTUS Carrier Lead Scraper API Server running on port ${PORT}`);
  console.log(` Admin Login: admin@motus.com / admin123`);
  console.log(` Demo User Login: john@logistics.com / user123`);
  console.log(`===================================================`);
});
