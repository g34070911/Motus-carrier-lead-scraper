import React, { useState, useEffect, useRef } from 'react';
import {
  Users, UploadCloud, BarChart3, ShieldCheck, AlertTriangle, FileText, CheckCircle,
  RefreshCw, ArrowRight, Sparkles, Search, Loader, XCircle, Globe, ChevronRight,
  Trash2, Download, FilePlus, FolderOpen, Database, ArrowUpCircle, Pause, Play,
  Edit2, Save, X
} from 'lucide-react';
import CalendarDatePicker from './CalendarDatePicker';

// ── CSV/Excel parser (RFC-4180 compliant) ───────────────────────────────────
function parseCsvToRows(text) {
  if (!text) return [];
  if (text.charCodeAt(0) === 0xFEFF) {
    text = text.slice(1);
  }
  const lines = [];
  let currentRow = [];
  let currentField = '';
  let insideQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (char === '"') {
      if (insideQuotes && nextChar === '"') {
        currentField += '"';
        i++;
      } else {
        insideQuotes = !insideQuotes;
      }
    } else if (char === ',' && !insideQuotes) {
      currentRow.push(currentField.trim());
      currentField = '';
    } else if ((char === '\r' || char === '\n') && !insideQuotes) {
      if (char === '\r' && nextChar === '\n') {
        i++;
      }
      currentRow.push(currentField.trim());
      if (currentRow.some(cell => cell.length > 0)) {
        lines.push(currentRow);
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
      lines.push(currentRow);
    }
  }

  if (lines.length < 2) return [];
  const rawHeaders = lines[0];
  const headers = rawHeaders.map(h => h.trim().replace(/^"|"$/g, ''));

  return lines.slice(1).map(row => {
    const obj = {};
    headers.forEach((h, i) => {
      obj[h] = row[i] !== undefined ? row[i] : '';
    });
    return obj;
  });
}

export default function AdminPortal({ user, activeSubTab = 'users' }) {
  const [subTab, setSubTab] = useState(activeSubTab);

  // Users State
  const [usersList, setUsersList] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [savingPlanId, setSavingPlanId] = useState(null);

  // PDF Parser Upload State
  const [pdfFile, setPdfFile] = useState(null);
  const [associatedDate, setAssociatedDate] = useState('09/15/2026');
  const [parsing, setParsing] = useState(false);
  const [parseProgress, setParseProgress] = useState(0);
  const [parseResult, setParseResult] = useState(null);

  // Phase 1: Parsed USDOT list
  const [parsedCarriers, setParsedCarriers] = useState([]);
  const [parseSessionId, setParseSessionId] = useState(null);
  const [parsedDate, setParsedDate] = useState('');

  // Phase 2: Scraping / SSE state
  const [scraping, setScraping] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [scrapeProgress, setScrapeProgress] = useState({ current: 0, total: 0 });
  const [scrapeStatuses, setScrapeStatuses] = useState({});
  const [scrapeComplete, setScrapeComplete] = useState(false);
  const [scrapedCount, setScrapedCount] = useState(0);
  const sseRef = useRef(null);

  // Inline Manual Edit State for Leads
  const [editingUsdot, setEditingUsdot] = useState(null);
  const [editRowData, setEditRowData] = useState({});
  const [savingEdit, setSavingEdit] = useState(false);

  // Saved PDF files list
  const [savedPdfs, setSavedPdfs] = useState([]);
  const [loadingPdfs, setLoadingPdfs] = useState(false);
  const [deletingPdfId, setDeletingPdfId] = useState(null);

  // Import Leads State
  const [importFile, setImportFile] = useState(null);
  const [importDate, setImportDate] = useState(new Date().toLocaleDateString('en-US'));
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);

  // Analytics State
  const [analytics, setAnalytics] = useState(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);

  useEffect(() => {
    if (user && user.role === 'admin') {
      if (subTab === 'users') fetchUsers();
      if (subTab === 'analytics') fetchAnalytics();
      if (subTab === 'pdf') fetchSavedPdfs();
    }
  }, [subTab, user]);

  const token = () => localStorage.getItem('motus_token');

  // ── Fetch Users ────────────────────────────────────────────────────────────
  const fetchUsers = async () => {
    setLoadingUsers(true);
    try {
      const res = await fetch('/api/admin/users', { headers: { Authorization: `Bearer ${token()}` } });
      const data = await res.json();
      if (res.ok) setUsersList(data.users || []);
    } catch (err) { console.error('Error fetching users:', err); }
    finally { setLoadingUsers(false); }
  };

  // ── Fetch Analytics ────────────────────────────────────────────────────────
  const fetchAnalytics = async () => {
    setLoadingAnalytics(true);
    try {
      const res = await fetch('/api/admin/analytics', { headers: { Authorization: `Bearer ${token()}` } });
      const data = await res.json();
      if (res.ok) setAnalytics(data);
    } catch (err) { console.error('Error fetching analytics:', err); }
    finally { setLoadingAnalytics(false); }
  };

  // ── Fetch saved PDFs list ──────────────────────────────────────────────────
  const fetchSavedPdfs = async () => {
    setLoadingPdfs(true);
    try {
      const res = await fetch('/api/admin/pdfs', { headers: { Authorization: `Bearer ${token()}` } });
      const data = await res.json();
      if (res.ok) setSavedPdfs(data.files || []);
    } catch (err) { console.error('Error fetching PDFs:', err); }
    finally { setLoadingPdfs(false); }
  };

  // ── Delete a saved PDF record ──────────────────────────────────────────────
  const handleDeletePdf = async (id) => {
    if (!confirm('Remove this PDF record from the system?')) return;
    setDeletingPdfId(id);
    try {
      const res = await fetch(`/api/admin/pdfs/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token()}` }
      });
      const data = await res.json();
      if (res.ok) {
        setSavedPdfs(prev => prev.filter(f => f.id !== id));
        alert('PDF record removed.');
      } else {
        alert(data.error || 'Failed to remove PDF.');
      }
    } catch (err) { alert('Error: ' + err.message); }
    finally { setDeletingPdfId(null); }
  };

  // ── Plan Update ────────────────────────────────────────────────────────────
  const handleUpdatePlan = async (userId, newPlan) => {
    setSavingPlanId(userId);
    try {
      const res = await fetch(`/api/admin/users/${userId}/plan`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ plan: newPlan })
      });
      const data = await res.json();
      if (res.ok) {
        setUsersList(usersList.map(u => u.id === userId ? { ...u, plan: newPlan } : u));
        alert(`Plan updated to ${newPlan.toUpperCase()} successfully.`);
      } else {
        alert(data.error || 'Failed to update plan');
      }
    } catch (err) { alert('Error updating plan: ' + err.message); }
    finally { setSavingPlanId(null); }
  };

  // ── PDF Upload & Parse ─────────────────────────────────────────────────────
  const handlePdfUpload = async (e) => {
    e.preventDefault();
    if (!pdfFile) { alert('Please select a PDF file.'); return; }
    if (!associatedDate) { alert('Please enter a target date.'); return; }

    setParsing(true);
    setParseProgress(10);
    setParseResult(null);
    setParsedCarriers([]);
    setParseSessionId(null);
    setScrapeStatuses({});
    setScrapeComplete(false);
    setIsPaused(false);
    setScrapedCount(0);

    const formData = new FormData();
    formData.append('pdf', pdfFile);
    formData.append('associated_date', associatedDate);

    try {
      const interval = setInterval(() => {
        setParseProgress(prev => prev < 85 ? prev + 10 : prev);
      }, 300);

      const res = await fetch('/api/admin/parse-pdf-only', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token()}` },
        body: formData
      });

      clearInterval(interval);
      setParseProgress(100);

      const data = await res.json();
      if (res.ok) {
        setParseResult(data);
        setParsedCarriers(data.carriers || []);
        setParseSessionId(data.sessionId);
        setParsedDate(data.associatedDate);
        // Refresh PDF list
        fetchSavedPdfs();
      } else {
        alert(data.error || 'PDF Parsing failed.');
      }
    } catch (err) {
      alert('PDF Parse error: ' + err.message);
    } finally {
      setParsing(false);
    }
  };

  // ── Scraping SSE Handlers (Start, Pause, Resume, Stop) ──────────────────────
  const handleStartScraping = (startIndex = 0) => {
    if (!parseSessionId) { alert('No parsed session found. Please upload & parse a PDF first.'); return; }
    if (scraping) return;

    setScraping(true);
    setIsPaused(false);
    setScrapeComplete(false);

    if (startIndex === 0) {
      setScrapedCount(0);
      setScrapeStatuses({});
    }

    setScrapeProgress(prev => ({
      current: startIndex,
      total: parsedCarriers.length || prev.total || 0
    }));

    const url = `/api/admin/scrape-stream?sessionId=${parseSessionId}&startIndex=${startIndex}&token=${token()}`;
    const evtSource = new EventSource(url);
    sseRef.current = evtSource;

    evtSource.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.type === 'start') {
          setScrapeProgress({ current: msg.startIndex || 0, total: msg.total });
        } else if (msg.type === 'progress') {
          setScrapeProgress({ current: msg.current, total: msg.total });
          setScrapeStatuses(prev => ({ ...prev, [msg.usdot]: msg.status }));
          if (msg.status === 'done' || msg.status === 'already_available') {
            setScrapedCount(prev => prev + 1);
            if (msg.carrier) {
              setParsedCarriers(prev => prev.map(c => (
                String(c.usdot).replace(/\D/g, '') === String(msg.usdot).replace(/\D/g, '')
                  ? { ...c, ...msg.carrier }
                  : c
              )));
            }
          }
        } else if (msg.type === 'paused') {
          setScraping(false);
          setIsPaused(true);
          evtSource.close();
          fetchSavedPdfs();
        } else if (msg.type === 'complete') {
          setScrapeComplete(true);
          setScraping(false);
          setIsPaused(false);
          setScrapedCount(msg.totalScraped);
          evtSource.close();
          fetchSavedPdfs();
        } else if (msg.type === 'error') {
          alert('Scraping error: ' + msg.message);
          setScraping(false);
          evtSource.close();
        }
      } catch (err) { console.error('SSE parse error:', err); }
    };

    evtSource.onerror = () => {
      setScraping(false);
      evtSource.close();
    };
  };

  const handlePauseScraping = async () => {
    if (sseRef.current) {
      sseRef.current.close();
      sseRef.current = null;
    }
    setScraping(false);
    setIsPaused(true);

    try {
      await fetch('/api/admin/pause-scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ sessionId: parseSessionId })
      });
    } catch (err) {
      console.error('Pause request error:', err);
    }
  };

  const handleResumeScraping = () => {
    const nextIndex = scrapeProgress.current > 0 ? scrapeProgress.current : 0;
    handleStartScraping(nextIndex);
  };

  const handleStopScraping = async () => {
    if (sseRef.current) {
      sseRef.current.close();
      sseRef.current = null;
    }
    setScraping(false);
    setIsPaused(false);

    try {
      await fetch('/api/admin/stop-scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ sessionId: parseSessionId })
      });
    } catch (_) {}

    alert('Scraping stopped. All extracted data up to this point has been saved.');
  };

  // ── Manual Inline Row Edit Handlers ───────────────────────────────────────
  const handleStartEditRow = (carrier) => {
    setEditingUsdot(carrier.usdot);
    setEditRowData({
      mc_number: carrier.mc_number || '',
      legal_name: carrier.legal_name || '',
      company_official: carrier.company_official || '',
      email: carrier.email || '',
      telephone: carrier.telephone || '',
      authority_status: carrier.authority_status || 'Active',
      address: carrier.address || ''
    });
  };

  const handleCancelEditRow = () => {
    setEditingUsdot(null);
    setEditRowData({});
  };

  const handleSaveEditRow = async (usdot) => {
    setSavingEdit(true);
    try {
      const cleanUsdot = String(usdot || '').replace(/\D/g, '').trim();
      const payload = { ...editRowData, usdot: cleanUsdot };

      let res = await fetch(`/api/admin/leads/${cleanUsdot}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
        body: JSON.stringify(payload)
      });

      if (res.status === 404) {
        res = await fetch(`/api/carriers/leads/${cleanUsdot}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
          body: JSON.stringify(payload)
        });
      }

      if (res.status === 404) {
        res = await fetch(`/api/admin/update-lead`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
          body: JSON.stringify(payload)
        });
      }

      const data = await res.json();
      if (res.ok) {
        setParsedCarriers(prev => prev.map(c => (
          String(c.usdot) === String(cleanUsdot) ? { ...c, ...data.carrier } : c
        )));
        setEditingUsdot(null);
        setEditRowData({});
      } else {
        alert(data.error || 'Failed to save lead edit. Please restart the backend server so the new routes are active.');
      }
    } catch (err) {
      alert('Error updating lead: ' + err.message);
    } finally {
      setSavingEdit(false);
    }
  };

  // ── Clear All Leads ────────────────────────────────────────────────────────
  const handleClearDatabase = async () => {
    if (!confirm('Are you sure you want to delete ALL carrier leads from the database?')) return;
    try {
      const res = await fetch('/api/admin/clear-leads', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token()}` }
      });
      const data = await res.json();
      if (res.ok) {
        alert(data.message);
        setParsedCarriers([]);
        setParseResult(null);
        setScrapeStatuses({});
      } else {
        alert(data.error || 'Failed to clear database');
      }
    } catch (err) { alert('Error clearing database: ' + err.message); }
  };

  // ── Import Leads from CSV/Excel ────────────────────────────────────────────
  const handleImportLeads = async (e) => {
    e.preventDefault();
    if (!importFile) { alert('Please select a CSV file to import.'); return; }
    setImporting(true);
    setImportResult(null);
    try {
      const formData = new FormData();
      formData.append('file', importFile);
      formData.append('associated_date', importDate);
      formData.append('filename', importFile.name);

      const res = await fetch('/api/admin/import-leads', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token()}` },
        body: formData
      });
      const data = await res.json();
      if (res.ok) {
        setImportResult(data);
        fetchSavedPdfs();
      } else {
        alert(data.error || 'Import failed.');
      }
    } catch (err) {
      alert('Import error: ' + err.message);
    } finally {
      setImporting(false);
    }
  };

  // ── Access Guard ───────────────────────────────────────────────────────────
  if (!user || user.role !== 'admin') {
    return (
      <div className="mx-auto max-w-4xl px-4 py-16 text-center">
        <div className="rounded-3xl p-8 space-y-4" style={{ background: '#fff', border: '1px solid #fecaca' }}>
          <AlertTriangle className="mx-auto h-12 w-12" style={{ color: '#dc2626' }} />
          <h2 className="text-2xl font-bold" style={{ color: '#0f172a' }}>Access Restricted: Admin Console</h2>
          <p className="text-sm" style={{ color: '#64748b' }}>
            The Admin Console is authorized only for system administrators.
          </p>
        </div>
      </div>
    );
  }

  // ── Shared style helpers ───────────────────────────────────────────────────
  const cardStyle = { background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', boxShadow: '0 4px 16px rgba(0,0,0,0.04)' };
  const subTabBtn = (id) => ({
    display: 'flex', alignItems: 'center', gap: '6px',
    padding: '8px 14px', borderRadius: '8px', fontSize: '13px', fontWeight: '600',
    cursor: 'pointer', transition: 'all 0.2s', border: 'none',
    background: subTab === id ? '#4f46e5' : 'transparent',
    color: subTab === id ? '#ffffff' : '#64748b',
    boxShadow: subTab === id ? '0 2px 8px rgba(79,70,229,0.3)' : 'none'
  });

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-6">
      
      {/* Admin Title & Tabs Header */}
      <div style={{ ...cardStyle, padding: '20px 24px', borderColor: '#ddd6fe' }}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <ShieldCheck className="h-6 w-6" style={{ color: '#7c3aed' }} />
              <h1 className="text-2xl font-bold font-outfit" style={{ color: '#0f172a' }}>Admin Console & Portal</h1>
            </div>
            <p className="text-xs" style={{ color: '#64748b' }}>
              Authorized Owner Management: User Plans, PDF Scraper Engine, Import Leads, System Analytics.
            </p>
          </div>

          {/* Subtab Switcher */}
          <div className="flex items-center gap-1 p-1 rounded-xl" style={{ background: '#f1f5f9', border: '1px solid #e2e8f0' }}>
            <button style={subTabBtn('users')} onClick={() => setSubTab('users')}>
              <Users className="h-4 w-4" /> <span>Users</span>
            </button>
            <button style={subTabBtn('pdf')} onClick={() => setSubTab('pdf')}>
              <UploadCloud className="h-4 w-4" /> <span>PDF Scraper</span>
            </button>
            <button style={subTabBtn('import')} onClick={() => setSubTab('import')}>
              <FilePlus className="h-4 w-4" /> <span>Import Leads</span>
            </button>
            <button style={subTabBtn('analytics')} onClick={() => setSubTab('analytics')}>
              <BarChart3 className="h-4 w-4" /> <span>Analytics</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── TAB: User Management ── */}
      {subTab === 'users' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold" style={{ color: '#0f172a' }}>Registered Users & Service Plans</h2>
              <p className="text-xs" style={{ color: '#64748b' }}>
                New accounts start as <span style={{ color: '#d97706', fontWeight: '700' }}>Unassigned</span> until you assign Trial or Premium plan.
              </p>
            </div>
            <button
              onClick={fetchUsers}
              className="flex items-center space-x-1.5 text-xs px-3 py-1.5 rounded-lg"
              style={{ background: '#f8fafc', border: '1px solid #e2e8f0', color: '#475569' }}
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loadingUsers ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>

          <div style={{ ...cardStyle, overflow: 'hidden' }}>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs" style={{ color: '#334155' }}>
                <thead style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: '700' }}>
                  <tr>
                    <th className="p-4">User Name</th>
                    <th className="p-4">Email</th>
                    <th className="p-4">Role</th>
                    <th className="p-4">Current Plan</th>
                    <th className="p-4 text-center">Scraped Today</th>
                    <th className="p-4">Registered</th>
                    <th className="p-4 text-right">Assign Plan</th>
                  </tr>
                </thead>
                <tbody>
                  {usersList.map((u) => (
                    <tr key={u.id} style={{ borderTop: '1px solid #f1f5f9' }}>
                      <td className="p-4 font-bold" style={{ color: '#0f172a' }}>{u.name}</td>
                      <td className="p-4 font-mono" style={{ color: '#4f46e5' }}>{u.email}</td>
                      <td className="p-4">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold" style={
                          u.role === 'admin'
                            ? { background: '#f5f3ff', color: '#7c3aed', border: '1px solid #ddd6fe' }
                            : { background: '#f1f5f9', color: '#64748b' }
                        }>{u.role.toUpperCase()}</span>
                      </td>
                      <td className="p-4">
                        <span className="px-2.5 py-1 rounded-full text-xs font-bold" style={
                          u.plan === 'premium'
                            ? { background: '#f0fdf4', color: '#059669', border: '1px solid #a7f3d0' }
                            : u.plan === 'trial'
                            ? { background: '#eef2ff', color: '#4f46e5', border: '1px solid #c7d2fe' }
                            : { background: '#fffbeb', color: '#d97706', border: '1px solid #fde68a' }
                        }>
                          {u.plan === 'unassigned' ? 'Awaiting Plan' : u.plan === 'trial' ? 'Trial (1k/day)' : 'Premium (Unlimited)'}
                        </span>
                      </td>
                      <td className="p-4 text-center font-mono font-bold" style={{ color: '#4f46e5' }}>{u.scraped_today || 0}</td>
                      <td className="p-4" style={{ color: '#94a3b8' }}>{new Date(u.created_at).toLocaleDateString()}</td>
                      <td className="p-4 text-right">
                        <select
                          value={u.plan}
                          onChange={(e) => handleUpdatePlan(u.id, e.target.value)}
                          disabled={savingPlanId === u.id || u.role === 'admin'}
                          className="rounded-lg px-2.5 py-1 text-xs"
                          style={{ border: '1px solid #cbd5e1', background: '#f8fafc', color: '#0f172a' }}
                        >
                          <option value="unassigned">Unassigned (Locked)</option>
                          <option value="trial">Trial (1,000 Leads/Day)</option>
                          <option value="premium">Premium (Unlimited)</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB: PDF Scraper Engine ── */}
      {subTab === 'pdf' && (
        <div className="space-y-6">

          {/* Upload Card */}
          <div style={{ ...cardStyle, padding: '28px', borderColor: '#c7d2fe' }}>
            <div className="space-y-1 mb-5">
              <h2 className="text-xl font-bold flex items-center space-x-2" style={{ color: '#0f172a' }}>
                <UploadCloud className="h-5 w-5" style={{ color: '#4f46e5' }} />
                <span>FMCSA Register PDF Parser</span>
              </h2>
              <p className="text-xs" style={{ color: '#64748b' }}>
                Upload an FMCSA Register PDF. System parses all USDOT numbers, then you can launch
                a live Chrome browser scrape from <code style={{ color: '#4f46e5' }}>motus.dot.gov</code>.
              </p>
            </div>

            <form onSubmit={handlePdfUpload} className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider" style={{ color: '#0f172a' }}>Target Date for Scraped Leads (Calendar)</label>
                  <CalendarDatePicker
                    value={associatedDate}
                    onChange={setAssociatedDate}
                    placeholder="Pick target date from calendar..."
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider" style={{ color: '#64748b' }}>Upload FMCSA PDF File</label>
                  <div className="relative flex flex-col items-center justify-center rounded-xl p-4 text-center" style={{ border: '2px dashed #c7d2fe', background: '#f8faff' }}>
                    <FileText className="h-8 w-8 mb-2" style={{ color: '#4f46e5' }} />
                    <input
                      type="file"
                      accept=".pdf,application/pdf"
                      onChange={e => setPdfFile(e.target.files[0])}
                      className="absolute inset-0 opacity-0 cursor-pointer"
                    />
                    <p className="text-xs font-semibold" style={{ color: '#0f172a' }}>
                      {pdfFile ? pdfFile.name : 'Drag & drop FMCSA PDF or click to browse'}
                    </p>
                    <p className="text-[10px]" style={{ color: '#94a3b8' }}>Up to 25MB</p>
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={parsing || !pdfFile}
                className="w-full flex items-center justify-center space-x-2 rounded-xl py-3.5 text-sm font-bold text-white"
                style={{ background: 'linear-gradient(135deg, #4f46e5, #7c3aed)', boxShadow: '0 4px 14px rgba(79,70,229,0.3)', opacity: (parsing || !pdfFile) ? 0.5 : 1 }}
              >
                {parsing ? <Loader className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
                <span>{parsing ? 'Parsing PDF...' : 'Parse PDF & Show USDOT Numbers'}</span>
              </button>
            </form>

            {parsing && (
              <div className="space-y-2 pt-4">
                <div className="flex justify-between text-xs font-semibold" style={{ color: '#334155' }}>
                  <span>Extracting USDOT numbers...</span>
                  <span>{parseProgress}%</span>
                </div>
                <div className="h-2.5 w-full rounded-full overflow-hidden" style={{ background: '#f1f5f9' }}>
                  <div className="h-full transition-all duration-300 rounded-full" style={{ width: `${parseProgress}%`, background: 'linear-gradient(90deg, #4f46e5, #7c3aed)' }} />
                </div>
              </div>
            )}
          </div>

          {/* Parsed USDOT Results + Scraping */}
          {parsedCarriers.length > 0 && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl p-4" style={{ background: '#f0fdf4', border: '1px solid #a7f3d0' }}>
                <div className="flex items-center space-x-3">
                  <div className="h-10 w-10 rounded-xl flex items-center justify-center" style={{ background: '#dcfce7', border: '1px solid #a7f3d0' }}>
                    <CheckCircle className="h-5 w-5" style={{ color: '#059669' }} />
                  </div>
                  <div>
                    <p className="text-sm font-bold" style={{ color: '#059669' }}>
                      {parsedCarriers.length} Motor Carrier USDOTs Extracted from PDF
                    </p>
                    <p className="text-xs" style={{ color: '#475569' }}>
                      Associated Date: <span className="font-mono font-bold" style={{ color: '#4f46e5' }}>{parsedDate}</span> · {
                        scrapeComplete ? <span className="font-bold text-emerald-700">✓ {scrapedCount} leads scraped from MOTUS &amp; added to Search Leads</span>
                        : isPaused ? <span className="font-bold text-amber-700">⏸ Scraping Paused at item #{scrapeProgress.current} of {parsedCarriers.length}</span>
                        : scraping ? <span className="font-bold text-teal-700">⚡ Scraping item #{scrapeProgress.current} of {parsedCarriers.length}...</span>
                        : <span className="text-slate-600 font-medium">Ready to scrape · Click Start Scraping to fetch from MOTUS &amp; add to Search Leads</span>
                      }
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={handleClearDatabase}
                    className="flex items-center space-x-1.5 px-3 py-2 rounded-xl text-xs font-semibold"
                    style={{ background: '#fff', border: '1px solid #fecaca', color: '#dc2626' }}
                  >
                    <XCircle className="h-3.5 w-3.5" /> <span>Clear DB Leads</span>
                  </button>

                  {/* Active Scraping Controls */}
                  {scraping && (
                    <>
                      <button
                        onClick={handlePauseScraping}
                        className="flex items-center space-x-1.5 px-4 py-2.5 rounded-xl text-sm font-bold text-amber-900"
                        style={{ background: '#fef08a', border: '1px solid #fde047', boxShadow: '0 2px 8px rgba(234,179,8,0.2)' }}
                      >
                        <Pause className="h-4 w-4 text-amber-700" /> <span>Pause Scraping</span>
                      </button>

                      <button
                        onClick={handleStopScraping}
                        className="flex items-center space-x-1.5 px-3.5 py-2.5 rounded-xl text-sm font-bold text-white"
                        style={{ background: '#dc2626' }}
                      >
                        <XCircle className="h-4 w-4" /> <span>Stop</span>
                      </button>
                    </>
                  )}

                  {/* Paused Controls */}
                  {isPaused && !scraping && (
                    <>
                      <button
                        onClick={handleResumeScraping}
                        className="flex items-center space-x-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white"
                        style={{ background: 'linear-gradient(135deg, #059669, #0d9488)', boxShadow: '0 4px 14px rgba(5,150,105,0.3)' }}
                      >
                        <Play className="h-4 w-4 fill-current" /> <span>Resume Scraping (#{scrapeProgress.current + 1})</span>
                      </button>

                      <button
                        onClick={handleStopScraping}
                        className="flex items-center space-x-1 px-3 py-2 rounded-xl text-xs font-semibold"
                        style={{ background: '#fff', border: '1px solid #fecaca', color: '#dc2626' }}
                      >
                        <XCircle className="h-3.5 w-3.5" /> <span>Reset Session</span>
                      </button>
                    </>
                  )}

                  {/* Initial Start / Complete Button */}
                  {!scraping && !isPaused && (
                    <button
                      onClick={() => handleStartScraping(0)}
                      disabled={scrapeComplete || !parseSessionId}
                      className="flex items-center space-x-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white"
                      style={{
                        background: scrapeComplete ? '#059669' : 'linear-gradient(135deg, #059669, #0891b2)',
                        boxShadow: '0 4px 12px rgba(5,150,105,0.3)',
                        opacity: (scrapeComplete || !parseSessionId) ? 0.6 : 1
                      }}
                    >
                      {scrapeComplete ? <><CheckCircle className="h-4 w-4" /><span>Complete!</span></>
                        : <><Globe className="h-4 w-4" /><span>Start Scraping MOTUS Website</span></>}
                    </button>
                  )}
                </div>
              </div>

              {/* Active Scraping Progress Bar */}
              {scraping && (
                <div className="rounded-xl p-4 space-y-2" style={{ background: '#f0fdfa', border: '1px solid #99f6e4' }}>
                  <div className="flex items-center justify-between text-xs font-semibold">
                    <span className="flex items-center space-x-1.5" style={{ color: '#0f766e' }}>
                      <Globe className="h-3.5 w-3.5 animate-pulse" />
                      <span>Chrome browser open — scraping motus.dot.gov...</span>
                    </span>
                    <span className="font-mono" style={{ color: '#0f172a' }}>{scrapeProgress.current} / {scrapeProgress.total}</span>
                  </div>
                  <div className="h-2 w-full rounded-full overflow-hidden" style={{ background: '#e2e8f0' }}>
                    <div className="h-full rounded-full transition-all duration-500" style={{ width: `${scrapeProgress.total > 0 ? (scrapeProgress.current / scrapeProgress.total) * 100 : 0}%`, background: 'linear-gradient(90deg, #059669, #0891b2)' }} />
                  </div>
                </div>
              )}

              {/* Paused Banner */}
              {isPaused && !scraping && (
                <div className="rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3" style={{ background: '#fffbeb', border: '1px solid #fde68a' }}>
                  <div className="flex items-center space-x-3">
                    <div className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: '#fef3c7', border: '1px solid #fde68a' }}>
                      <Pause className="h-4 w-4 text-amber-700" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-amber-900">
                        Scraping Paused at item #{scrapeProgress.current} of {parsedCarriers.length}
                      </p>
                      <p className="text-[11px] text-amber-700">
                        All carriers scraped so far are saved. Click <strong>Resume Scraping</strong> to continue from item #{scrapeProgress.current + 1}.
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={handleResumeScraping}
                    className="flex items-center justify-center space-x-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white shrink-0"
                    style={{ background: '#d97706', boxShadow: '0 2px 8px rgba(217,119,6,0.3)' }}
                  >
                    <Play className="h-3.5 w-3.5 fill-current" />
                    <span>Resume Now</span>
                  </button>
                </div>
              )}

              {/* USDOT table */}
              <div style={{ ...cardStyle, overflow: 'hidden' }}>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs" style={{ color: '#334155' }}>
                    <thead style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: '700' }}>
                      <tr>
                        <th className="p-3.5 w-8">#</th>
                        <th className="p-3.5">USDOT Number</th>
                        <th className="p-3.5">MC Number</th>
                        <th className="p-3.5">Company Name</th>
                        <th className="p-3.5">Official / Owner</th>
                        <th className="p-3.5">Email</th>
                        <th className="p-3.5">Telephone</th>
                        <th className="p-3.5 text-center">MOTUS Status</th>
                        <th className="p-3.5 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parsedCarriers.map((carrier, idx) => {
                        const status = scrapeStatuses[carrier.usdot];
                        const isEditingThisRow = editingUsdot === carrier.usdot;

                        if (isEditingThisRow) {
                          return (
                            <tr key={carrier.usdot} style={{ borderTop: '1px solid #c7d2fe', background: '#f5f3ff' }}>
                              <td className="p-3" style={{ color: '#4f46e5', fontFamily: 'monospace', fontWeight: 'bold' }}>{idx + 1}</td>
                              <td className="p-3 font-mono font-bold" style={{ color: '#4f46e5' }}>{carrier.usdot}</td>
                              <td className="p-3">
                                <input
                                  type="text"
                                  value={editRowData.mc_number}
                                  onChange={e => setEditRowData({ ...editRowData, mc_number: e.target.value })}
                                  placeholder="MC-XXXXXX"
                                  className="w-28 px-2 py-1 rounded border border-indigo-300 text-xs font-mono font-bold bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                              </td>
                              <td className="p-3">
                                <input
                                  type="text"
                                  value={editRowData.legal_name}
                                  onChange={e => setEditRowData({ ...editRowData, legal_name: e.target.value })}
                                  placeholder="Company Name"
                                  className="w-40 px-2 py-1 rounded border border-indigo-300 text-xs font-semibold bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                              </td>
                              <td className="p-3">
                                <input
                                  type="text"
                                  value={editRowData.company_official}
                                  onChange={e => setEditRowData({ ...editRowData, company_official: e.target.value })}
                                  placeholder="Official / Owner"
                                  className="w-32 px-2 py-1 rounded border border-indigo-300 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                              </td>
                              <td className="p-3">
                                <input
                                  type="text"
                                  value={editRowData.email}
                                  onChange={e => setEditRowData({ ...editRowData, email: e.target.value })}
                                  placeholder="email@domain.com"
                                  className="w-36 px-2 py-1 rounded border border-indigo-300 text-xs font-mono bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                              </td>
                              <td className="p-3">
                                <input
                                  type="text"
                                  value={editRowData.telephone}
                                  onChange={e => setEditRowData({ ...editRowData, telephone: e.target.value })}
                                  placeholder="Phone"
                                  className="w-28 px-2 py-1 rounded border border-indigo-300 text-xs font-mono bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                              </td>
                              <td className="p-3 text-center">
                                <select
                                  value={editRowData.authority_status}
                                  onChange={e => setEditRowData({ ...editRowData, authority_status: e.target.value })}
                                  className="px-2 py-1 rounded border border-indigo-300 text-xs font-bold bg-white"
                                >
                                  <option value="Active">Active</option>
                                  <option value="Pending">Pending</option>
                                </select>
                              </td>
                              <td className="p-3 text-right space-x-1">
                                <button
                                  onClick={() => handleSaveEditRow(carrier.usdot)}
                                  disabled={savingEdit}
                                  className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-xs"
                                >
                                  {savingEdit ? <Loader className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                                  <span>Save</span>
                                </button>
                                <button
                                  onClick={handleCancelEditRow}
                                  className="inline-flex items-center space-x-1 px-2 py-1 rounded-lg text-xs font-semibold text-slate-700 bg-slate-200 hover:bg-slate-300"
                                >
                                  <X className="h-3 w-3" />
                                  <span>Cancel</span>
                                </button>
                              </td>
                            </tr>
                          );
                        }

                        return (
                          <tr key={carrier.usdot} style={{ borderTop: '1px solid #f1f5f9' }}>
                            <td className="p-3.5" style={{ color: '#94a3b8', fontFamily: 'monospace' }}>{idx + 1}</td>
                            <td className="p-3.5 font-mono font-bold" style={{ color: '#4f46e5' }}>{carrier.usdot}</td>
                            <td className="p-3.5 font-mono font-semibold" style={{ color: '#0f766e' }}>{carrier.mc_number && carrier.mc_number !== 'N/A' ? carrier.mc_number : '—'}</td>
                            <td className="p-3.5 font-semibold max-w-[180px] truncate" style={{ color: '#0f172a' }}>{carrier.legal_name || '—'}</td>
                            <td className="p-3.5 max-w-[130px] truncate" style={{ color: '#475569' }}>{carrier.company_official && carrier.company_official !== 'N/A' ? carrier.company_official : '—'}</td>
                            <td className="p-3.5 font-mono max-w-[140px] truncate" style={{ color: '#0369a1' }}>{carrier.email && carrier.email !== 'N/A' ? carrier.email : '—'}</td>
                            <td className="p-3.5 font-mono" style={{ color: '#475569' }}>{carrier.telephone && carrier.telephone !== 'N/A' ? carrier.telephone : '—'}</td>
                            <td className="p-3.5 text-center">
                              {!status && <span className="px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ background: '#f1f5f9', color: '#94a3b8' }}>Pending</span>}
                              {status === 'navigating' && <span className="px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center space-x-1 w-fit mx-auto" style={{ background: '#fffbeb', color: '#d97706', border: '1px solid #fde68a' }}><Loader className="h-2.5 w-2.5 animate-spin" /><span>Visiting...</span></span>}
                              {status === 'done' && <span className="px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center space-x-1 w-fit mx-auto" style={{ background: '#f0fdf4', color: '#059669', border: '1px solid #a7f3d0' }}><CheckCircle className="h-2.5 w-2.5" /><span>Scraped</span></span>}
                              {status === 'already_available' && <span className="px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center space-x-1 w-fit mx-auto" style={{ background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe' }}><CheckCircle className="h-2.5 w-2.5" /><span>Already in DB</span></span>}
                              {status === 'error' && <span className="px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center space-x-1 w-fit mx-auto" style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' }}><XCircle className="h-2.5 w-2.5" /><span>Error</span></span>}
                            </td>
                            <td className="p-3.5 text-right flex items-center justify-end space-x-2">
                              <button
                                onClick={() => handleStartEditRow(carrier)}
                                className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg text-xs font-bold transition-all"
                                style={{ background: '#e0e7ff', color: '#4338ca', border: '1px solid #c7d2fe' }}
                                title="Manually edit MC, Email, Official, Phone..."
                              >
                                <Edit2 className="h-3 w-3" />
                                <span>Edit</span>
                              </button>
                              <a href={`https://motus.dot.gov/customer/${carrier.usdot}/account`} target="_blank" rel="noreferrer"
                                className="inline-flex items-center space-x-1 text-xs font-semibold" style={{ color: '#4f46e5' }}>
                                <Globe className="h-3 w-3" /><span>MOTUS</span><ChevronRight className="h-3 w-3" />
                              </a>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {scrapeComplete && (
                <div className="rounded-2xl p-5 flex items-center space-x-3" style={{ background: '#f0fdf4', border: '1px solid #a7f3d0' }}>
                  <CheckCircle className="h-6 w-6 shrink-0" style={{ color: '#059669' }} />
                  <div>
                    <p className="text-sm font-bold" style={{ color: '#059669' }}>Scraping Complete!</p>
                    <p className="text-xs" style={{ color: '#64748b' }}>{scrapedCount} of {parsedCarriers.length} carriers scraped & stored for date <span className="font-mono" style={{ color: '#4f46e5' }}>{parsedDate}</span>.</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Saved / Uploaded PDFs Management ── */}
          <div style={{ ...cardStyle, padding: '24px' }}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-bold text-base" style={{ color: '#0f172a' }}>Uploaded PDF Records</h3>
                <p className="text-xs" style={{ color: '#64748b' }}>All PDFs uploaded by admin. Click Remove to delete from the system.</p>
              </div>
              <button onClick={fetchSavedPdfs} className="flex items-center space-x-1 text-xs px-2.5 py-1.5 rounded-lg" style={{ background: '#f8fafc', border: '1px solid #e2e8f0', color: '#475569' }}>
                <RefreshCw className={`h-3.5 w-3.5 ${loadingPdfs ? 'animate-spin' : ''}`} />
                <span>Refresh</span>
              </button>
            </div>

            {loadingPdfs ? (
              <div className="py-8 text-center" style={{ color: '#94a3b8' }}><RefreshCw className="mx-auto h-5 w-5 animate-spin mb-2" /><p className="text-xs">Loading PDF records...</p></div>
            ) : savedPdfs.length === 0 ? (
              <div className="py-8 text-center" style={{ color: '#94a3b8' }}>
                <FolderOpen className="mx-auto h-8 w-8 mb-2 opacity-40" />
                <p className="text-xs">No PDF records found. Upload a PDF above to get started.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs" style={{ color: '#334155' }}>
                  <thead style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: '700' }}>
                    <tr>
                      <th className="p-3.5">Filename</th>
                      <th className="p-3.5">Associated Date</th>
                      <th className="p-3.5 text-center">USDOTs Found</th>
                      <th className="p-3.5 text-center">Scraped</th>
                      <th className="p-3.5 text-center">Status</th>
                      <th className="p-3.5">Uploaded At</th>
                      <th className="p-3.5 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {savedPdfs.map(pdf => (
                      <tr key={pdf.id} style={{ borderTop: '1px solid #f1f5f9' }}>
                        <td className="p-3.5 font-medium" style={{ color: '#0f172a' }}>
                          <div className="flex items-center space-x-2">
                            <FileText className="h-4 w-4" style={{ color: '#4f46e5' }} />
                            <span className="max-w-[200px] truncate">{pdf.filename}</span>
                          </div>
                        </td>
                        <td className="p-3.5 font-mono" style={{ color: '#4f46e5' }}>{pdf.associated_date}</td>
                        <td className="p-3.5 text-center font-mono font-bold" style={{ color: '#0f172a' }}>{pdf.total_dot_found || 0}</td>
                        <td className="p-3.5 text-center font-mono font-bold" style={{ color: '#059669' }}>{pdf.total_scraped || 0}</td>
                        <td className="p-3.5 text-center">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold" style={
                            pdf.status === 'completed'
                              ? { background: '#f0fdf4', color: '#059669', border: '1px solid #a7f3d0' }
                              : { background: '#fffbeb', color: '#d97706', border: '1px solid #fde68a' }
                          }>{pdf.status || 'completed'}</span>
                        </td>
                        <td className="p-3.5" style={{ color: '#94a3b8' }}>{pdf.uploaded_at ? new Date(pdf.uploaded_at).toLocaleString() : '—'}</td>
                        <td className="p-3.5 text-right">
                          <button
                            onClick={() => handleDeletePdf(pdf.id)}
                            disabled={deletingPdfId === pdf.id}
                            className="flex items-center space-x-1 px-2.5 py-1.5 rounded-lg text-xs font-bold ml-auto"
                            style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' }}
                          >
                            {deletingPdfId === pdf.id ? <Loader className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                            <span>Remove</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── TAB: Import Leads (CSV/Excel) ── */}
      {subTab === 'import' && (
        <div className="space-y-6">
          <div style={{ ...cardStyle, padding: '28px', borderColor: '#a7f3d0' }}>
            <div className="space-y-1 mb-6">
              <h2 className="text-xl font-bold flex items-center space-x-2" style={{ color: '#0f172a' }}>
                <FilePlus className="h-5 w-5" style={{ color: '#059669' }} />
                <span>Import Carrier Leads from CSV</span>
              </h2>
              <p className="text-xs" style={{ color: '#64748b' }}>
                Upload a CSV file containing carrier leads. The system will deduplicate by USDOT and save to the database.
                Imported leads are immediately searchable by users.
              </p>
            </div>

            {/* CSV Format guide */}
            <div className="rounded-xl p-4 mb-5 space-y-2" style={{ background: '#f0fdf4', border: '1px solid #a7f3d0' }}>
              <p className="text-xs font-bold" style={{ color: '#059669' }}>📋 Expected CSV Column Headers (any order):</p>
              <div className="flex flex-wrap gap-2">
                {['USDOT', 'MC Number', 'Company Name', 'Status', 'Phone', 'Address', 'Email', 'Legal name', 'Total Equipment', 'Equipment type'].map(col => (
                  <span key={col} className="px-2 py-0.5 rounded text-[11px] font-mono font-bold" style={{ background: '#fff', border: '1px solid #a7f3d0', color: '#0f172a' }}>{col}</span>
                ))}
              </div>
            </div>

            <form onSubmit={handleImportLeads} className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider" style={{ color: '#0f172a' }}>Associated Date for Imported Leads (Calendar)</label>
                  <CalendarDatePicker
                    value={importDate}
                    onChange={setImportDate}
                    placeholder="Pick associated date from calendar..."
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider" style={{ color: '#64748b' }}>Upload CSV File</label>
                  <div className="relative flex flex-col items-center justify-center rounded-xl p-4 text-center" style={{ border: '2px dashed #a7f3d0', background: '#f0fdf4' }}>
                    <Database className="h-8 w-8 mb-2" style={{ color: '#059669' }} />
                    <input
                      type="file"
                      accept=".csv,text/csv"
                      onChange={e => { setImportFile(e.target.files[0]); setImportResult(null); }}
                      className="absolute inset-0 opacity-0 cursor-pointer"
                    />
                    <p className="text-xs font-semibold" style={{ color: '#0f172a' }}>
                      {importFile ? importFile.name : 'Drag & drop CSV file or click to browse'}
                    </p>
                    <p className="text-[10px]" style={{ color: '#94a3b8' }}>.csv files only</p>
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={importing || !importFile}
                className="w-full flex items-center justify-center space-x-2 rounded-xl py-3.5 text-sm font-bold text-white"
                style={{ background: 'linear-gradient(135deg, #059669, #0891b2)', boxShadow: '0 4px 12px rgba(5,150,105,0.3)', opacity: (importing || !importFile) ? 0.5 : 1 }}
              >
                {importing ? <><Loader className="h-4 w-4 animate-spin" /><span>Importing & Deduplicating...</span></>
                  : <><ArrowUpCircle className="h-4 w-4" /><span>Import Leads into Database</span></>}
              </button>
            </form>

            {importResult && (
              <div className="rounded-2xl p-5 mt-4 flex items-start space-x-3" style={{ background: '#f0fdf4', border: '1px solid #a7f3d0' }}>
                <CheckCircle className="h-6 w-6 shrink-0 mt-0.5" style={{ color: '#059669' }} />
                <div>
                  <p className="text-sm font-bold" style={{ color: '#059669' }}>Import Successful!</p>
                  <p className="text-xs" style={{ color: '#64748b' }}>{importResult.message}</p>
                  <p className="text-xs mt-1" style={{ color: '#4f46e5' }}>
                    {importResult.totalImported} leads imported & deduplicated. Now visible in Search Leads.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── TAB: User Analytics ── */}
      {subTab === 'analytics' && (
        <div className="space-y-6">
          {loadingAnalytics || !analytics ? (
            <div className="rounded-2xl p-12 text-center" style={{ background: '#fff', border: '1px solid #e2e8f0' }}>
              <RefreshCw className="mx-auto h-8 w-8 animate-spin mb-2" style={{ color: '#4f46e5' }} />
              <p style={{ color: '#64748b' }}>Loading Analytics...</p>
            </div>
          ) : (
            <>
              {/* KPI Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                {[
                  { label: 'Total Carrier Leads', value: analytics.metrics.totalLeads, color: '#0f172a' },
                  { label: 'Registered Users', value: analytics.metrics.totalUsers, color: '#4f46e5' },
                  { label: 'Trial Users', value: analytics.metrics.activeTrialUsers, color: '#2563eb' },
                  { label: 'Premium Users', value: analytics.metrics.activePremiumUsers, color: '#059669' },
                  { label: 'Pending Activation', value: analytics.metrics.pendingUsers, color: '#d97706' },
                ].map(({ label, value, color }) => (
                  <div key={label} style={{ ...cardStyle, padding: '16px' }}>
                    <p className="text-xs font-medium" style={{ color: '#64748b' }}>{label}</p>
                    <p className="text-2xl font-bold font-mono mt-1" style={{ color }}>{value}</p>
                  </div>
                ))}
              </div>

              {/* Activity Logs */}
              <div className="space-y-3">
                <h2 className="text-base font-bold" style={{ color: '#0f172a' }}>User Activity Logs</h2>
                <div style={{ ...cardStyle, overflow: 'hidden' }}>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs" style={{ color: '#334155' }}>
                      <thead style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: '700' }}>
                        <tr>
                          <th className="p-3.5">User</th>
                          <th className="p-3.5">Action</th>
                          <th className="p-3.5">Details</th>
                          <th className="p-3.5 text-center">Volume</th>
                          <th className="p-3.5 text-right">Timestamp</th>
                        </tr>
                      </thead>
                      <tbody>
                        {analytics.activityLogs.map((log) => (
                          <tr key={log.id} style={{ borderTop: '1px solid #f1f5f9' }}>
                            <td className="p-3.5 font-semibold" style={{ color: '#0f172a' }}>
                              {log.user_name}
                              <span className="block text-[10px] font-normal" style={{ color: '#94a3b8' }}>{log.user_email}</span>
                            </td>
                            <td className="p-3.5">
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold" style={
                                log.action_type === 'EXPORT_CSV' ? { background: '#f0fdf4', color: '#059669' }
                                : log.action_type === 'PARSE_PDF' ? { background: '#f5f3ff', color: '#7c3aed' }
                                : log.action_type === 'IMPORT_LEADS' ? { background: '#eff6ff', color: '#2563eb' }
                                : log.action_type === 'DELETE_LEADS' ? { background: '#fef2f2', color: '#dc2626' }
                                : { background: '#f1f5f9', color: '#64748b' }
                              }>{log.action_type}</span>
                            </td>
                            <td className="p-3.5" style={{ color: '#475569' }}>{log.details}</td>
                            <td className="p-3.5 text-center font-mono font-bold" style={{ color: '#4f46e5' }}>{log.leads_count || 0}</td>
                            <td className="p-3.5 text-right" style={{ color: '#94a3b8' }}>{new Date(log.timestamp).toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}

    </div>
  );
}
