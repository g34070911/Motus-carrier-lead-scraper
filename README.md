# MOTUS Carrier Lead Scraper

A full-stack lead-generation platform for the trucking/logistics industry. It parses the daily **FMCSA carrier register PDF**, extracts newly registered motor carriers, scrapes each carrier's profile from the public **MOTUS (motus.dot.gov)** portal, and gives sales teams a searchable, exportable lead database with role- and plan-based access.

**Stack:** React 19 · Vite · Node.js · Express 5 · Puppeteer · Cheerio · JWT · bcrypt · pdf-parse · Server-Sent Events

## Features

**Data pipeline**
- **PDF register parser** – reads FMCSA register PDFs, classifies sections and keeps genuine *Motor Carrier* authorities (brokers, freight forwarders and enterprise carriers are excluded).
- **Puppeteer scraper** – three-layer extraction per field (exact XPath → CSS fallbacks → full-page regex/Cheerio scan) for MC number, authority status, legal name, official, address, e-mail and phone.
- **Equipment classification** – derives *Fleet*, *Hotshot/Power Only* or *Box Truck* plus truck count from the carrier's vehicle table.
- **Live progress via SSE** with **pause / resume / stop** controls and resumable start index.
- **CSV import / export** helpers with city–state–ZIP parsing.

**Lead search portal (React)**
- Filter by registration date (custom calendar picker), state, equipment type, authority status and more.
- CSV export with **plan enforcement** (trial: 1,000 leads/day; premium: unlimited).
- Carrier detail modal, plan-upgrade flow, responsive UI.

**Accounts & admin**
- JWT authentication (7-day tokens), e-mail OTP registration flow, separate secure admin login.
- Admin portal: user management & plan assignment, analytics, PDF upload history, lead edit/delete/bulk-delete.

## Architecture

```
server/
  index.js                Express app, middleware, static hosting
  auth.js                 JWT sign/verify, plan-limit checks
  db.js                   JSON-file data layer
  pdfParser.js            FMCSA register PDF → carriers
  puppeteerScraper.js     headless-browser scraper (primary)
  motusScraper.js         Axios + Cheerio scraper (lightweight / fallback)
  csvHelper.js            CSV import/export utilities
  routes/                 authRoutes · carrierRoutes · adminRoutes
src/
  App.jsx · components/   SearchPortal · AdminPortal · AuthModal · CarrierModal · …
```

## Getting started

Requirements: Node.js 20+ and Google Chrome/Edge installed (used by Puppeteer).

```bash
git clone https://github.com/YOUR-GITHUB-USERNAME/motus-carrier-lead-scraper.git
cd motus-carrier-lead-scraper
npm install
cp .env.example .env        # set JWT_SECRET
npm start                   # API on :5000, Vite dev server on :3000
```

On first run the app creates `server/data/db.json` and seeds demo accounts (see `server/db.js`). **Change or remove the seeded credentials before any real deployment.**

Production build: `npm run build` then `node server/index.js` (Express serves `dist/`).

## Responsible use

Scrapes publicly available government data. Respect the target site's terms of service and rate limits, and comply with applicable data-protection and marketing laws when contacting leads.

## Roadmap

- Hash seeded/demo passwords with bcrypt and migrate from JSON storage to a real database
- Rate limiting and request queueing for the scraper
- Automated tests and CI

## License

MIT © YOUR NAME
