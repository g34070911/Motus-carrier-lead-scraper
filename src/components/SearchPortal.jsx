import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  Calendar,
  MapPin,
  Filter,
  Download,
  AlertCircle,
  Eye,
  Sparkles,
  CheckCircle2,
  ChevronDown,
  X,
  Trash2,
  Check,
  Hash,
  Edit2,
  Save,
  Loader
} from 'lucide-react';
import CalendarDatePicker from './CalendarDatePicker';

// Comprehensive USA States dictionary
const USA_STATES = [
  { code: 'AL', name: 'Alabama' }, { code: 'AK', name: 'Alaska' }, { code: 'AZ', name: 'Arizona' },
  { code: 'AR', name: 'Arkansas' }, { code: 'CA', name: 'California' }, { code: 'CO', name: 'Colorado' },
  { code: 'CT', name: 'Connecticut' }, { code: 'DE', name: 'Delaware' }, { code: 'FL', name: 'Florida' },
  { code: 'GA', name: 'Georgia' }, { code: 'HI', name: 'Hawaii' }, { code: 'ID', name: 'Idaho' },
  { code: 'IL', name: 'Illinois' }, { code: 'IN', name: 'Indiana' }, { code: 'IA', name: 'Iowa' },
  { code: 'KS', name: 'Kansas' }, { code: 'KY', name: 'Kentucky' }, { code: 'LA', name: 'Louisiana' },
  { code: 'ME', name: 'Maine' }, { code: 'MD', name: 'Maryland' }, { code: 'MA', name: 'Massachusetts' },
  { code: 'MI', name: 'Michigan' }, { code: 'MN', name: 'Minnesota' }, { code: 'MS', name: 'Mississippi' },
  { code: 'MO', name: 'Missouri' }, { code: 'MT', name: 'Montana' }, { code: 'NE', name: 'Nebraska' },
  { code: 'NV', name: 'Nevada' }, { code: 'NH', name: 'New Hampshire' }, { code: 'NJ', name: 'New Jersey' },
  { code: 'NM', name: 'New Mexico' }, { code: 'NY', name: 'New York' }, { code: 'NC', name: 'North Carolina' },
  { code: 'ND', name: 'North Dakota' }, { code: 'OH', name: 'Ohio' }, { code: 'OK', name: 'Oklahoma' },
  { code: 'OR', name: 'Oregon' }, { code: 'PA', name: 'Pennsylvania' }, { code: 'RI', name: 'Rhode Island' },
  { code: 'SC', name: 'South Carolina' }, { code: 'SD', name: 'South Dakota' }, { code: 'TN', name: 'Tennessee' },
  { code: 'TX', name: 'Texas' }, { code: 'UT', name: 'Utah' }, { code: 'VT', name: 'Vermont' },
  { code: 'VA', name: 'Virginia' }, { code: 'WA', name: 'Washington' }, { code: 'WV', name: 'West Virginia' },
  { code: 'WI', name: 'Wisconsin' }, { code: 'WY', name: 'Wyoming' }
];

// Major USA Cities and Metro Areas
const USA_MAJOR_CITIES = [
  'Houston, TX', 'Dallas, TX', 'Austin, TX', 'San Antonio, TX', 'Fort Worth, TX', 'Laredo, TX',
  'Los Angeles, CA', 'San Francisco, CA', 'San Diego, CA', 'Stockton, CA', 'Bakersfield, CA', 'Fontana, CA',
  'Miami, FL', 'Orlando, FL', 'Tampa, FL', 'Jacksonville, FL',
  'Chicago, IL', 'Palos Park, IL', 'Plainfield, IL',
  'Atlanta, GA', 'Savannah, GA', 'Lawrenceville, GA', 'Peachtree Corners, GA',
  'New York, NY', 'Schenectady, NY', 'Newark, NJ', 'Paramus, NJ',
  'Philadelphia, PA', 'Charlotte, NC', 'Raleigh, NC', 'Columbus, OH', 'Cleveland, OH',
  'Indianapolis, IN', 'Detroit, MI', 'Seattle, WA', 'Tacoma, WA', 'Denver, CO', 'Phoenix, AZ',
  'Kansas City, MO', 'Saint Louis, MO', 'Minneapolis, MN', 'Saint Paul, MN', 'Nashville, TN', 'Memphis, TN'
];

// USA Zip Code to City/State detection lookup dictionary
const USA_ZIP_LOOKUP = {
  '77002': { city: 'Houston', state: 'TX' },
  '75201': { city: 'Dallas', state: 'TX' },
  '78701': { city: 'Austin', state: 'TX' },
  '78201': { city: 'San Antonio', state: 'TX' },
  '78040': { city: 'Laredo', state: 'TX' },
  '75088': { city: 'Rowlett', state: 'TX' },
  '76227': { city: 'Aubrey', state: 'TX' },
  '77406': { city: 'Richmond', state: 'TX' },
  '77515': { city: 'Richwood', state: 'TX' },
  '90001': { city: 'Los Angeles', state: 'CA' },
  '90210': { city: 'Beverly Hills', state: 'CA' },
  '94102': { city: 'San Francisco', state: 'CA' },
  '92101': { city: 'San Diego', state: 'CA' },
  '95202': { city: 'Stockton', state: 'CA' },
  '93301': { city: 'Bakersfield', state: 'CA' },
  '92335': { city: 'Fontana', state: 'CA' },
  '92408': { city: 'San Bernardino', state: 'CA' },
  '93010': { city: 'Camarillo', state: 'CA' },
  '91910': { city: 'Chula Vista', state: 'CA' },
  '91780': { city: 'Temple City', state: 'CA' },
  '94587': { city: 'Union City', state: 'CA' },
  '33101': { city: 'Miami', state: 'FL' },
  '33177': { city: 'Miami', state: 'FL' },
  '32801': { city: 'Orlando', state: 'FL' },
  '33601': { city: 'Tampa', state: 'FL' },
  '32202': { city: 'Jacksonville', state: 'FL' },
  '33569': { city: 'Riverview', state: 'FL' },
  '60601': { city: 'Chicago', state: 'IL' },
  '60606': { city: 'Chicago', state: 'IL' },
  '60464': { city: 'Palos Park', state: 'IL' },
  '60544': { city: 'Plainfield', state: 'IL' },
  '60106': { city: 'Bensenville', state: 'IL' },
  '30301': { city: 'Atlanta', state: 'GA' },
  '31405': { city: 'Savannah', state: 'GA' },
  '30045': { city: 'Lawrenceville', state: 'GA' },
  '30092': { city: 'Peachtree Corners', state: 'GA' },
  '10001': { city: 'New York', state: 'NY' },
  '12304': { city: 'Schenectady', state: 'NY' },
  '07101': { city: 'Newark', state: 'NJ' },
  '07652': { city: 'Paramus', state: 'NJ' },
  '08852': { city: 'Monmouth Jct', state: 'NJ' },
  '07823': { city: 'Belvidere', state: 'NJ' },
  '19101': { city: 'Philadelphia', state: 'PA' },
  '18966': { city: 'Holland', state: 'PA' },
  '98101': { city: 'Seattle', state: 'WA' },
  '98401': { city: 'Tacoma', state: 'WA' },
  '98371': { city: 'Puyallup', state: 'WA' },
  '98223': { city: 'Arlington', state: 'WA' },
  '85001': { city: 'Phoenix', state: 'AZ' },
  '64101': { city: 'Kansas City', state: 'MO' },
  '63101': { city: 'Saint Louis', state: 'MO' },
  '55101': { city: 'Saint Paul', state: 'MN' },
  '55401': { city: 'Minneapolis', state: 'MN' },
  '43201': { city: 'Columbus', state: 'OH' },
  '45750': { city: 'Marietta', state: 'OH' },
  '44039': { city: 'North Ridgeville', state: 'OH' },
  '46201': { city: 'Indianapolis', state: 'IN' },
  '47116': { city: 'Eckerty', state: 'IN' },
  '42101': { city: 'Bowling Green', state: 'KY' },
  '28340': { city: 'Fairmont', state: 'NC' },
  '23661': { city: 'Hampton', state: 'VA' },
  '02852': { city: 'North Kingstown', state: 'RI' },
  '66720': { city: 'Chanute', state: 'KS' },
  '83835': { city: 'Hayden Lake', state: 'ID' },
  '50598': { city: 'Whittemore', state: 'IA' },
  '50317': { city: 'Des Moines', state: 'IA' },
  '68501': { city: 'Lincoln', state: 'NE' },
  '84054': { city: 'North Salt Lake', state: 'UT' },
  '82801': { city: 'Sheridan', state: 'WY' }
};

export default function SearchPortal({ user, onSelectCarrier, onRequireUpgrade, onOpenAuth }) {
  // Date State - selected from dropdown or calendar picker (no typing)
  const [selectedDate, setSelectedDate] = useState('10/7/2026');
  const [availableDates, setAvailableDates] = useState(['10/7/2026', '09/15/2026', '03/10/2026']);
  const [isCalendarPickerOpen, setIsCalendarPickerOpen] = useState(false);

  // MC Range Filter State (< 8 digits)
  const [startMc, setStartMc] = useState('');
  const [endMc, setEndMc] = useState('');
  const [mcRangeError, setMcRangeError] = useState('');

  // General Search Keyword (USDOT, MC, Company Name)
  const [query, setQuery] = useState('');

  // Location State with USA suggestions and Zip auto-detection
  const [location, setLocation] = useState('');
  const [locationSuggestions, setLocationSuggestions] = useState([]);
  const [detectedArea, setDetectedArea] = useState(null);
  const [isLocationDropdownOpen, setIsLocationDropdownOpen] = useState(false);
  const locationContainerRef = useRef(null);

  // Authority Status Filter: 'all', 'active', 'pending'
  const [authorityStatus, setAuthorityStatus] = useState('all');
  const [authorityType, setAuthorityType] = useState('all');

  // Equipment Type Multi-Select State
  const equipmentOptions = ['Box Truck', 'Trailer', 'Big Equipment'];
  const [selectedEquipmentTypes, setSelectedEquipmentTypes] = useState([]);
  const [isEquipmentDropdownOpen, setIsEquipmentDropdownOpen] = useState(false);
  const equipmentDropdownRef = useRef(null);

  // Cargo Type Multi-Select State
  const cargoOptions = [
    'General Freight', 'Other Cargo', 'Building Material', 'Construction',
    'Logs/Poles/Lumber', 'Metal', 'Fresh Produce', 'Meat', 'Refrigerated Food',
    'Paper Products', 'Beverages', 'Intermodal Containers', 'Oilfield Equipment'
  ];
  const [selectedCargoTypes, setSelectedCargoTypes] = useState([]);
  const [isCargoDropdownOpen, setIsCargoDropdownOpen] = useState(false);
  const [cargoSearchText, setCargoSearchText] = useState('');
  const cargoDropdownRef = useRef(null);

  // Data & UI State
  const [carriers, setCarriers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [dateExists, setDateExists] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [selectedIds, setSelectedIds] = useState([]);
  const [exporting, setExporting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClickOutside(e) {
      if (locationContainerRef.current && !locationContainerRef.current.contains(e.target)) {
        setIsLocationDropdownOpen(false);
      }
      if (equipmentDropdownRef.current && !equipmentDropdownRef.current.contains(e.target)) {
        setIsEquipmentDropdownOpen(false);
      }
      if (cargoDropdownRef.current && !cargoDropdownRef.current.contains(e.target)) {
        setIsCargoDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch available dates on mount
  useEffect(() => {
    fetchAvailableDates();
  }, []);

  const fetchAvailableDates = async () => {
    try {
      const res = await fetch('/api/carriers/dates');
      if (res.ok) {
        const data = await res.json();
        if (data.dates && data.dates.length > 0) {
          const dateList = data.dates.map(d => d.date);
          setAvailableDates(dateList);
          // Default to latest available date if current date has no data
          setSelectedDate(prev => (prev === 'all' || dateList.includes(prev)) ? prev : dateList[0]);
        }
      }
    } catch (err) {
      console.error('Failed to fetch available dates:', err);
    }
  };

  // Trigger search on filter changes
  useEffect(() => {
    fetchCarriers();
  }, [
    selectedDate,
    authorityStatus,
    authorityType,
    selectedEquipmentTypes,
    selectedCargoTypes
  ]);

  // Main carrier fetch function
  const fetchCarriers = async () => {
    setLoading(true);
    setErrorMessage('');
    try {
      const params = new URLSearchParams();

      if (selectedDate && selectedDate !== 'all') {
        params.append('date', selectedDate);
      }

      // MC Range Validation (< 8 digits)
      if (startMc.trim()) params.append('start_mc', startMc.trim());
      if (endMc.trim()) params.append('end_mc', endMc.trim());

      if (query.trim()) params.append('query', query.trim());
      if (location.trim()) params.append('location', location.trim());

      if (authorityStatus !== 'all') params.append('authority_status', authorityStatus);
      if (authorityType !== 'all') params.append('authority_type', authorityType);

      // Multi-select Equipment Types
      if (selectedEquipmentTypes.length > 0) {
        params.append('equipment_type', selectedEquipmentTypes.join(','));
      }

      // Multi-select Cargo Types
      if (selectedCargoTypes.length > 0) {
        params.append('cargo_type', selectedCargoTypes.join(','));
      }

      const token = localStorage.getItem('motus_token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      const res = await fetch(`/api/carriers/search?${params.toString()}`, { headers });
      const data = await res.json();

      if (res.ok) {
        setCarriers(data.data || []);
        setDateExists(data.dateExists !== false);
        if (data.availableDates && data.availableDates.length > 0) {
          setAvailableDates(data.availableDates);
        }
        if (data.dateExists === false) {
          setErrorMessage(data.message || `No data found for selected date.`);
        }
      } else {
        setErrorMessage(data.error || 'Failed to search carriers');
      }
    } catch (err) {
      setErrorMessage('Network connection error. Is the server running?');
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchCarriers();
  };

  // Handle Date picker change (Native HTML5 Calendar picker)
  const handleCalendarDateSelect = (e) => {
    const rawValue = e.target.value; // format: "YYYY-MM-DD"
    if (!rawValue) return;
    const [y, m, d] = rawValue.split('-');
    // Convert to MM/DD/YYYY format matching database
    const formattedDate = `${parseInt(m, 10)}/${parseInt(d, 10)}/${y}`;
    setSelectedDate(formattedDate);
    if (!availableDates.includes(formattedDate)) {
      setAvailableDates(prev => [formattedDate, ...prev]);
    }
    setIsCalendarPickerOpen(false);
  };

  // Convert MM/DD/YYYY to YYYY-MM-DD for native input
  const getInputValueForCalendar = (dateStr) => {
    if (!dateStr || dateStr === 'all') return '';
    const parts = dateStr.split('/');
    if (parts.length === 3) {
      const [m, d, y] = parts;
      const mPad = m.padStart(2, '0');
      const dPad = d.padStart(2, '0');
      return `${y}-${mPad}-${dPad}`;
    }
    return '';
  };

  // MC Range Input Handlers (strictly < 8 digits)
  const handleStartMcChange = (e) => {
    const val = e.target.value.replace(/\D/g, ''); // digits only
    if (val.length >= 8) {
      setMcRangeError('MC number must be less than 8 digits (maximum 7 digits)');
      return;
    }
    setMcRangeError('');
    setStartMc(val);
  };

  const handleEndMcChange = (e) => {
    const val = e.target.value.replace(/\D/g, ''); // digits only
    if (val.length >= 8) {
      setMcRangeError('MC number must be less than 8 digits (maximum 7 digits)');
      return;
    }
    setMcRangeError('');
    setEndMc(val);
  };

  const handleClearMcRange = () => {
    setStartMc('');
    setEndMc('');
    setMcRangeError('');
  };

  // Location input handler with USA area suggestions and Zip Code auto-detection
  const handleLocationInputChange = (e) => {
    const val = e.target.value;
    setLocation(val);

    if (!val || val.trim().length === 0) {
      setLocationSuggestions([]);
      setDetectedArea(null);
      setIsLocationDropdownOpen(false);
      return;
    }

    const trimmed = val.trim();
    const suggestions = [];

    // 1. Check if user entered a 5-digit USA Zip Code
    const zipMatch = trimmed.match(/^\d{1,5}$/);
    if (zipMatch) {
      const zipCode = zipMatch[0];
      if (USA_ZIP_LOOKUP[zipCode]) {
        const detected = USA_ZIP_LOOKUP[zipCode];
        setDetectedArea(`${detected.city}, ${detected.state} ${zipCode}`);
        suggestions.push({
          type: 'zip',
          label: `${detected.city}, ${detected.state} (${zipCode})`,
          value: `${detected.city}, ${detected.state}`,
          detected: true
        });
      } else {
        setDetectedArea(null);
      }
    } else {
      setDetectedArea(null);
    }

    // 2. Match USA States by code or full name
    const lower = trimmed.toLowerCase();
    USA_STATES.forEach(st => {
      if (st.code.toLowerCase() === lower || st.name.toLowerCase().includes(lower)) {
        suggestions.push({
          type: 'state',
          label: `${st.name} (${st.code}, USA)`,
          value: st.code
        });
      }
    });

    // 3. Match Major Cities
    USA_MAJOR_CITIES.forEach(city => {
      if (city.toLowerCase().includes(lower)) {
        suggestions.push({
          type: 'city',
          label: `${city} (USA)`,
          value: city
        });
      }
    });

    // 4. Match unique locations in currently loaded carrier leads
    const carrierLocs = new Set();
    carriers.forEach(c => {
      if (c.city && c.state) carrierLocs.add(`${c.city}, ${c.state}`);
      else if (c.address) carrierLocs.add(c.address);
    });
    carrierLocs.forEach(loc => {
      if (loc.toLowerCase().includes(lower) && !suggestions.some(s => s.value === loc)) {
        suggestions.push({
          type: 'lead',
          label: `${loc} (In Leads)`,
          value: loc
        });
      }
    });

    setLocationSuggestions(suggestions.slice(0, 8));
    setIsLocationDropdownOpen(suggestions.length > 0);
  };

  const handleSelectLocationSuggestion = (suggestedValue) => {
    setLocation(suggestedValue);
    setIsLocationDropdownOpen(false);
    setDetectedArea(null);
  };

  // Toggle Equipment Type Multi-Selection
  const toggleEquipmentType = (type) => {
    if (selectedEquipmentTypes.includes(type)) {
      setSelectedEquipmentTypes(selectedEquipmentTypes.filter(t => t !== type));
    } else {
      setSelectedEquipmentTypes([...selectedEquipmentTypes, type]);
    }
  };

  const handleSelectAllEquipment = () => {
    setSelectedEquipmentTypes([...equipmentOptions]);
  };

  const handleClearEquipment = () => {
    setSelectedEquipmentTypes([]);
  };

  // Toggle Cargo Type Multi-Selection
  const toggleCargoType = (type) => {
    if (selectedCargoTypes.includes(type)) {
      setSelectedCargoTypes(selectedCargoTypes.filter(t => t !== type));
    } else {
      setSelectedCargoTypes([...selectedCargoTypes, type]);
    }
  };

  const handleSelectAllCargo = () => {
    setSelectedCargoTypes([...cargoOptions]);
  };

  const handleClearCargo = () => {
    setSelectedCargoTypes([]);
  };

  // Table selection by USDOT Primary Key
  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedIds(carriers.map(c => c.usdot));
    } else {
      setSelectedIds([]);
    }
  };

  const handleToggleSelect = (usdot) => {
    if (selectedIds.includes(usdot)) {
      setSelectedIds(selectedIds.filter(d => d !== usdot));
    } else {
      setSelectedIds([...selectedIds, usdot]);
    }
  };

  // CSV Export with renamed headers and filters
  const handleExportCsv = async () => {
    if (!user) {
      onOpenAuth();
      return;
    }

    if (user.plan === 'unassigned') {
      onRequireUpgrade('PLAN_UNASSIGNED');
      return;
    }

    setExporting(true);
    try {
      const token = localStorage.getItem('motus_token');
      const res = await fetch('/api/carriers/export', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          carrierIds: selectedIds.length > 0 ? selectedIds : carriers.map(c => c.usdot),
          carrierUsdots: selectedIds.length > 0 ? selectedIds : carriers.map(c => c.usdot),
          date: selectedDate,
          start_mc: startMc,
          end_mc: endMc,
          query,
          location,
          authority_status: authorityStatus,
          authority_type: authorityType,
          equipment_type: selectedEquipmentTypes.length > 0 ? selectedEquipmentTypes.join(',') : 'all',
          cargo_type: selectedCargoTypes.length > 0 ? selectedCargoTypes.join(',') : 'all'
        })
      });

      if (res.status === 429) {
        const errData = await res.json();
        onRequireUpgrade('TRIAL_LIMIT_EXCEEDED', errData);
        setExporting(false);
        return;
      }

      if (res.status === 403) {
        const errData = await res.json();
        onRequireUpgrade('PLAN_UNASSIGNED', errData);
        setExporting(false);
        return;
      }

      if (!res.ok) {
        const errData = await res.json();
        alert(errData.error || errData.message || 'Export failed');
        setExporting(false);
        return;
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `motus_carrier_leads_${selectedDate || 'all'}_${Date.now()}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);

    } catch (err) {
      alert('CSV export error: ' + err.message);
    } finally {
      setExporting(false);
    }
  };

  // Bulk Delete leads (Admin only)
  const handleDeleteSelected = async () => {
    if (!user || user.role !== 'admin') return;
    if (selectedIds.length === 0) {
      alert('Please select at least one lead to delete.');
      return;
    }

    const count = selectedIds.length;
    if (!window.confirm(`Admin Action: Are you sure you want to delete ${count} selected lead(s)?`)) {
      return;
    }

    setDeleting(true);
    try {
      const selectedDots = selectedIds;

      const token = localStorage.getItem('motus_token');
      const res = await fetch('/api/admin/delete-leads', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ usdots: selectedDots })
      });

      const data = await res.json();
      if (res.ok) {
        alert(data.message || `Successfully deleted ${count} lead(s).`);
        setSelectedIds([]);
        fetchCarriers();
      } else {
        alert(data.error || 'Failed to delete leads');
      }
    } catch (err) {
      alert('Error deleting leads: ' + err.message);
    } finally {
      setDeleting(false);
    }
  };

  const handleDeleteSingle = async (carrier) => {
    if (!user || user.role !== 'admin') return;
    if (!window.confirm(`Admin Action: Delete lead USDOT ${carrier.usdot} (${carrier.legal_name})?`)) {
      return;
    }

    try {
      const token = localStorage.getItem('motus_token');
      const res = await fetch(`/api/admin/leads/${carrier.usdot}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });

      const data = await res.json();
      if (res.ok) {
        setSelectedIds(prev => prev.filter(id => id !== carrier.id));
        fetchCarriers();
      } else {
        alert(data.error || 'Failed to delete lead');
      }
    } catch (err) {
      alert('Error deleting lead: ' + err.message);
    }
  };

  // Inline Manual Edit State for Leads
  const [editingUsdot, setEditingUsdot] = useState(null);
  const [editRowData, setEditRowData] = useState({});
  const [savingEdit, setSavingEdit] = useState(false);

  const handleStartEditRow = (carrier, e) => {
    if (e) e.stopPropagation();
    setEditingUsdot(carrier.usdot);
    setEditRowData({
      mc_number: carrier.mc_number || '',
      legal_name: carrier.legal_name || '',
      company_official: carrier.company_official || '',
      email: carrier.email || '',
      telephone: carrier.telephone || '',
      authority_status: carrier.authority_status || 'Active',
      address: carrier.address || '',
      equipment_type: carrier.equipment_type || 'Box Truck',
      total_trucks: carrier.total_trucks != null ? carrier.total_trucks : 1
    });
  };

  const handleCancelEditRow = (e) => {
    if (e) e.stopPropagation();
    setEditingUsdot(null);
    setEditRowData({});
  };

  const handleSaveEditRow = async (usdot, e) => {
    if (e) e.stopPropagation();
    setSavingEdit(true);
    try {
      const token = localStorage.getItem('motus_token');
      const cleanUsdot = String(usdot || '').replace(/\D/g, '').trim();
      const payload = { ...editRowData, usdot: cleanUsdot };

      let res = await fetch(`/api/admin/leads/${cleanUsdot}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      // Fallback routes if 404 (in case server routing differs)
      if (res.status === 404) {
        res = await fetch(`/api/carriers/leads/${cleanUsdot}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify(payload)
        });
      }

      if (res.status === 404) {
        res = await fetch(`/api/admin/update-lead`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify(payload)
        });
      }

      const data = await res.json();
      if (res.ok) {
        setCarriers(prev => prev.map(c => (
          String(c.usdot) === String(cleanUsdot) ? { ...c, ...data.carrier } : c
        )));
        setEditingUsdot(null);
        setEditRowData({});
      } else {
        alert(data.error || 'Failed to update lead. Please restart your server if you recently made updates.');
      }
    } catch (err) {
      alert('Error saving lead edit: ' + err.message);
    } finally {
      setSavingEdit(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-6" style={{ color: '#000000' }}>
      
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-3xl p-6 md:p-8" style={{ background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #4338ca 100%)', boxShadow: '0 8px 32px rgba(30, 27, 75, 0.25)' }}>
        <div className="absolute -top-24 -right-24 h-72 w-72 rounded-full opacity-20" style={{ background: 'rgba(255,255,255,0.3)', filter: 'blur(60px)' }}></div>
        <div className="relative z-10 max-w-3xl space-y-3">
          <div className="inline-flex items-center space-x-2 rounded-full px-3 py-1 text-xs font-semibold" style={{ background: 'rgba(255,255,255,0.15)', color: '#ffffff', border: '1px solid rgba(255,255,255,0.2)' }}>
            <Sparkles className="h-3.5 w-3.5 text-amber-300" />
            <span>MOTUS Motor Carrier Intelligence Engine</span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white md:text-4xl">
            Motor Carrier Lead Search &amp; Export
          </h1>
          <p className="text-sm font-medium" style={{ color: '#e0e7ff' }}>
            Filter leads by date selection, MC numeric range, USA location with auto zip-code detection, multi-select equipment &amp; cargo classifications.
          </p>
        </div>
      </div>

      {/* Primary Search Controls Card */}
      <div className="glass-card rounded-2xl p-5 md:p-6 space-y-5" style={{ background: '#ffffff', border: '1px solid #cbd5e1', boxShadow: '0 4px 20px rgba(0,0,0,0.06)' }}>
        <form onSubmit={handleSearchSubmit} className="space-y-4">
          
          {/* Top Search Controls Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            
            {/* Filter 1: Date Search with Calendar */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider flex items-center justify-between" style={{ color: '#000000' }}>
                <span className="flex items-center space-x-1.5">
                  <Calendar className="h-4 w-4" style={{ color: '#4338ca' }} />
                  <span>1. Date Search (Calendar)</span>
                </span>
                {selectedDate && selectedDate !== 'all' && (
                  <button
                    type="button"
                    onClick={() => setSelectedDate('all')}
                    className="text-[10px] text-indigo-700 hover:underline font-bold"
                  >
                    Show All Dates
                  </button>
                )}
              </label>

              <CalendarDatePicker
                value={selectedDate}
                onChange={setSelectedDate}
                allowClear={true}
                onClear={() => setSelectedDate('all')}
                placeholder="Pick date from calendar..."
              />

              {/* Quick Available Dates Selector */}
              {availableDates.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  <span className="text-[10px] font-bold" style={{ color: '#64748b' }}>Quick Select:</span>
                  <button
                    type="button"
                    onClick={() => setSelectedDate('all')}
                    className={`px-2 py-0.5 rounded-lg text-[10px] font-bold transition-all ${selectedDate === 'all' ? 'bg-indigo-700 text-white shadow-xs' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
                  >
                    All System Leads
                  </button>
                  {availableDates.slice(0, 5).map(d => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setSelectedDate(d)}
                      className={`px-2 py-0.5 rounded-lg text-[10px] font-bold transition-all ${selectedDate === d ? 'bg-indigo-700 text-white shadow-xs' : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100'}`}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Filter 2: MC Range for Carrier (< 8 Digits) */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider flex items-center justify-between" style={{ color: '#000000' }}>
                <span className="flex items-center space-x-1.5">
                  <Hash className="h-4 w-4" style={{ color: '#4338ca' }} />
                  <span>2. MC Range (&lt; 8 Digits)</span>
                </span>
                {(startMc || endMc) && (
                  <button
                    type="button"
                    onClick={handleClearMcRange}
                    className="text-[10px] text-red-600 hover:underline font-bold"
                  >
                    Clear MC
                  </button>
                )}
              </label>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <input
                    type="text"
                    value={startMc}
                    onChange={handleStartMcChange}
                    maxLength={7}
                    placeholder="Start MC (e.g. 1700000)"
                    className="glass-input w-full rounded-xl px-3 py-2 text-xs font-mono font-bold"
                    style={{ color: '#000000', border: '1.5px solid #94a3b8' }}
                  />
                </div>
                <div>
                  <input
                    type="text"
                    value={endMc}
                    onChange={handleEndMcChange}
                    maxLength={7}
                    placeholder="End MC (e.g. 1701000)"
                    className="glass-input w-full rounded-xl px-3 py-2 text-xs font-mono font-bold"
                    style={{ color: '#000000', border: '1.5px solid #94a3b8' }}
                  />
                </div>
              </div>

              {mcRangeError ? (
                <p className="text-[11px] text-red-600 font-bold">{mcRangeError}</p>
              ) : (
                <p className="text-[11px] font-medium" style={{ color: '#475569' }}>
                  Filter carriers strictly in range ({startMc || '0'} to {endMc || '9999999'})
                </p>
              )}
            </div>

            {/* Filter 3: Location Search with USA Suggestion & Zip Code Auto-detection */}
            <div className="space-y-1.5 relative" ref={locationContainerRef}>
              <label className="text-xs font-bold uppercase tracking-wider flex items-center justify-between" style={{ color: '#000000' }}>
                <span className="flex items-center space-x-1.5">
                  <MapPin className="h-4 w-4" style={{ color: '#4338ca' }} />
                  <span>3. Location (USA Area / Zip)</span>
                </span>
                {location && (
                  <button
                    type="button"
                    onClick={() => { setLocation(''); setDetectedArea(null); setIsLocationDropdownOpen(false); }}
                    className="text-[10px] text-red-600 hover:underline font-bold"
                  >
                    Clear
                  </button>
                )}
              </label>

              <div className="relative">
                <input
                  type="text"
                  value={location}
                  onChange={handleLocationInputChange}
                  onFocus={() => location.length > 0 && setIsLocationDropdownOpen(true)}
                  placeholder="Type city, state or 5-digit zip (e.g. 77002, TX)..."
                  className="glass-input w-full rounded-xl px-3.5 py-2 text-xs font-bold"
                  style={{ color: '#000000', border: '1.5px solid #94a3b8' }}
                />

                {/* Auto-detected Area Badge */}
                {detectedArea && (
                  <div className="mt-1 flex items-center space-x-1 rounded-md px-2 py-0.5 text-[11px] font-bold" style={{ background: '#ecfdf5', color: '#047857', border: '1px solid #a7f3d0' }}>
                    <CheckCircle2 className="h-3 w-3 shrink-0" />
                    <span>Auto-detected: {detectedArea} (USA)</span>
                  </div>
                )}

                {/* Location Suggestions Dropdown */}
                {isLocationDropdownOpen && locationSuggestions.length > 0 && (
                  <div
                    className="absolute z-50 left-0 right-0 mt-1 rounded-xl shadow-2xl overflow-hidden border max-h-64 overflow-y-auto"
                    style={{ background: '#ffffff', borderColor: '#cbd5e1' }}
                  >
                    <div className="p-2 border-b text-[10px] uppercase font-bold tracking-wider" style={{ background: '#f8fafc', color: '#475569' }}>
                      USA Location Suggestions (Click to Select)
                    </div>
                    {locationSuggestions.map((item, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => handleSelectLocationSuggestion(item.value)}
                        className="w-full text-left px-3.5 py-2.5 text-xs font-bold hover:bg-indigo-50 flex items-center justify-between border-b last:border-b-0 transition-colors"
                        style={{ color: '#000000' }}
                      >
                        <span className="flex items-center space-x-2">
                          <MapPin className="h-3.5 w-3.5 text-indigo-600 shrink-0" />
                          <span>{item.label}</span>
                        </span>
                        <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded" style={{ background: '#f1f5f9', color: '#475569' }}>
                          {item.type}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

          </div>

          {/* Secondary Controls & Filter Dropdowns Grid */}
          <div className="pt-3 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3" style={{ borderTop: '1px solid #e2e8f0' }}>
            
            {/* General Query (USDOT / Name) */}
            <div className="space-y-1">
              <label className="text-[11px] font-bold" style={{ color: '#000000' }}>USDOT / Company Name</label>
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="USDOT # or Legal Name..."
                className="glass-input w-full rounded-lg px-2.5 py-1.5 text-xs font-medium"
                style={{ color: '#000000', border: '1px solid #94a3b8' }}
              />
            </div>

            {/* Authority Status Filter: Active vs Pending */}
            <div className="space-y-1">
              <label className="text-[11px] font-bold" style={{ color: '#000000' }}>Operating Status</label>
              <select
                value={authorityStatus}
                onChange={(e) => setAuthorityStatus(e.target.value)}
                className="glass-input w-full rounded-lg px-2.5 py-1.5 text-xs font-bold cursor-pointer"
                style={{ color: '#000000', border: '1px solid #94a3b8' }}
              >
                <option value="all">All Statuses</option>
                <option value="active">Active</option>
                <option value="pending">Pending</option>
              </select>
            </div>

            {/* Authority Type Filter */}
            <div className="space-y-1">
              <label className="text-[11px] font-bold" style={{ color: '#000000' }}>Authority Type</label>
              <select
                value={authorityType}
                onChange={(e) => setAuthorityType(e.target.value)}
                className="glass-input w-full rounded-lg px-2.5 py-1.5 text-xs font-bold cursor-pointer"
                style={{ color: '#000000', border: '1px solid #94a3b8' }}
              >
                <option value="all">All Authority Types</option>
                <option value="Motor Carrier">Motor Carrier of Property</option>
                <option value="Broker">Broker of Property</option>
                <option value="Freight Forwarder">Freight Forwarder</option>
                <option value="Household Goods">Household Goods</option>
              </select>
            </div>

            {/* Multi-Select: Equipment Type */}
            <div className="space-y-1 relative" ref={equipmentDropdownRef}>
              <label className="text-[11px] font-bold flex items-center justify-between" style={{ color: '#000000' }}>
                <span>Equipment Type</span>
                {selectedEquipmentTypes.length > 0 && (
                  <span className="text-[10px] text-indigo-700 font-bold">
                    ({selectedEquipmentTypes.length} selected)
                  </span>
                )}
              </label>

              <button
                type="button"
                onClick={() => setIsEquipmentDropdownOpen(!isEquipmentDropdownOpen)}
                className="glass-input w-full rounded-lg px-2.5 py-1.5 text-xs font-bold flex items-center justify-between text-left"
                style={{ color: '#000000', border: '1px solid #94a3b8' }}
              >
                <span className="truncate">
                  {selectedEquipmentTypes.length === 0
                    ? 'All Equipment Types'
                    : selectedEquipmentTypes.join(', ')}
                </span>
                <ChevronDown className="h-3.5 w-3.5 shrink-0 ml-1 text-slate-600" />
              </button>

              {/* Equipment Multi-Select Dropdown Menu */}
              {isEquipmentDropdownOpen && (
                <div
                  className="absolute z-50 left-0 right-0 mt-1 rounded-xl shadow-2xl p-2.5 border"
                  style={{ background: '#ffffff', borderColor: '#cbd5e1' }}
                >
                  <div className="flex items-center justify-between pb-2 mb-2 border-b">
                    <span className="text-[10px] font-bold uppercase" style={{ color: '#475569' }}>Select Multiple</span>
                    <div className="space-x-2 text-[10px] font-bold">
                      <button type="button" onClick={handleSelectAllEquipment} className="text-indigo-600 hover:underline">Select All</button>
                      <button type="button" onClick={handleClearEquipment} className="text-red-600 hover:underline">Clear</button>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    {equipmentOptions.map(eq => {
                      const isSelected = selectedEquipmentTypes.includes(eq);
                      return (
                        <label
                          key={eq}
                          className="flex items-center space-x-2 p-1.5 rounded-lg cursor-pointer hover:bg-slate-100 text-xs font-bold"
                          style={{ color: '#000000' }}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleEquipmentType(eq)}
                            className="rounded h-4 w-4"
                            style={{ accentColor: '#4338ca' }}
                          />
                          <span>{eq}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Multi-Select: Cargo Types */}
            <div className="space-y-1 relative" ref={cargoDropdownRef}>
              <label className="text-[11px] font-bold flex items-center justify-between" style={{ color: '#000000' }}>
                <span>Cargo Type</span>
                {selectedCargoTypes.length > 0 && (
                  <span className="text-[10px] text-indigo-700 font-bold">
                    ({selectedCargoTypes.length} selected)
                  </span>
                )}
              </label>

              <button
                type="button"
                onClick={() => setIsCargoDropdownOpen(!isCargoDropdownOpen)}
                className="glass-input w-full rounded-lg px-2.5 py-1.5 text-xs font-bold flex items-center justify-between text-left"
                style={{ color: '#000000', border: '1px solid #94a3b8' }}
              >
                <span className="truncate">
                  {selectedCargoTypes.length === 0
                    ? 'All Cargo Types'
                    : `${selectedCargoTypes.length} selected`}
                </span>
                <ChevronDown className="h-3.5 w-3.5 shrink-0 ml-1 text-slate-600" />
              </button>

              {/* Cargo Multi-Select Dropdown Menu */}
              {isCargoDropdownOpen && (
                <div
                  className="absolute z-50 right-0 w-64 mt-1 rounded-xl shadow-2xl p-2.5 border"
                  style={{ background: '#ffffff', borderColor: '#cbd5e1' }}
                >
                  <div className="flex items-center justify-between pb-2 mb-2 border-b">
                    <span className="text-[10px] font-bold uppercase" style={{ color: '#475569' }}>Multiple Cargos</span>
                    <div className="space-x-2 text-[10px] font-bold">
                      <button type="button" onClick={handleSelectAllCargo} className="text-indigo-600 hover:underline">Select All</button>
                      <button type="button" onClick={handleClearCargo} className="text-red-600 hover:underline">Clear</button>
                    </div>
                  </div>

                  <input
                    type="text"
                    placeholder="Search cargo..."
                    value={cargoSearchText}
                    onChange={(e) => setCargoSearchText(e.target.value)}
                    className="w-full text-xs p-1.5 mb-2 rounded border"
                    style={{ borderColor: '#cbd5e1', color: '#000000' }}
                  />

                  <div className="space-y-1 max-h-48 overflow-y-auto">
                    {cargoOptions
                      .filter(cg => cg.toLowerCase().includes(cargoSearchText.toLowerCase()))
                      .map(cg => {
                        const isSelected = selectedCargoTypes.includes(cg);
                        return (
                          <label
                            key={cg}
                            className="flex items-center space-x-2 p-1 rounded-lg cursor-pointer hover:bg-slate-100 text-xs font-bold"
                            style={{ color: '#000000' }}
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleCargoType(cg)}
                              className="rounded h-4 w-4"
                              style={{ accentColor: '#4338ca' }}
                            />
                            <span className="truncate">{cg}</span>
                          </label>
                        );
                      })}
                  </div>
                </div>
              )}
            </div>

          </div>

          {/* Search Trigger Button */}
          <div className="flex justify-end pt-2">
            <button
              type="submit"
              className="flex items-center space-x-2 px-6 py-2.5 rounded-xl font-bold text-white transition-all active:scale-95 text-xs shadow-md"
              style={{ background: '#312e81' }}
            >
              <Search className="h-4 w-4" />
              <span>Apply Filters &amp; Search Leads</span>
            </button>
          </div>

        </form>
      </div>

      {/* Date Not Found Warning Card */}
      {!dateExists && (
        <div className="rounded-2xl p-5 flex items-start space-x-4" style={{ background: '#fffbeb', border: '1.5px solid #fde68a' }}>
          <AlertCircle className="h-6 w-6 shrink-0 mt-0.5" style={{ color: '#b45309' }} />
          <div className="space-y-1">
            <h3 className="text-base font-bold" style={{ color: '#000000' }}>Data Not Available for Selected Date</h3>
            <p className="text-sm font-medium" style={{ color: '#334155' }}>
              No carrier data available for date <span className="font-bold" style={{ color: '#000000' }}>{selectedDate}</span>.
              Please select an available date from the dropdown above: {availableDates.map(d => (
                <span
                  key={d}
                  onClick={() => setSelectedDate(d)}
                  className="underline cursor-pointer font-bold mx-1 text-indigo-700"
                >
                  {d}
                </span>
              ))}
            </p>
          </div>
        </div>
      )}

      {/* Results Controls Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 rounded-2xl p-4" style={{ background: '#ffffff', border: '1.5px solid #cbd5e1', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
        <div className="flex items-center space-x-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl font-extrabold text-base" style={{ background: '#e0e7ff', color: '#1e1b4b' }}>
            {carriers.length}
          </div>
          <div>
            <h2 className="text-base font-extrabold" style={{ color: '#000000' }}>Carrier Leads Found</h2>
            <p className="text-xs font-semibold" style={{ color: '#475569' }}>
              {selectedIds.length > 0 ? `${selectedIds.length} leads selected for export` : 'All matching filtered records'}
              {startMc && endMc ? ` • MC Range: ${startMc} - ${endMc}` : ''}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
          {/* Admin Bulk Delete Controls */}
          {user && user.role === 'admin' && selectedIds.length > 0 && (
            <button
              onClick={handleDeleteSelected}
              disabled={deleting}
              className="flex items-center justify-center space-x-1.5 rounded-xl px-4 py-2.5 text-xs font-bold transition-all active:scale-95 disabled:opacity-40"
              style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c' }}
              title="Delete selected leads (Admin Only)"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>{deleting ? 'Deleting...' : `Delete Selected (${selectedIds.length})`}</span>
            </button>
          )}

          {/* CSV Export Button (Renamed Headers: Legal name, Total Equipment, Equipment type) */}
          <button
            onClick={handleExportCsv}
            disabled={exporting || carriers.length === 0}
            className="flex-1 sm:flex-initial flex items-center justify-center space-x-2 rounded-xl px-5 py-2.5 text-sm font-bold text-white transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
            style={{ background: 'linear-gradient(135deg, #047857 0%, #0d9488 100%)' }}
          >
            <Download className="h-4 w-4" />
            <span>{exporting ? 'Generating Excel/CSV...' : `Export CSV / Excel (${selectedIds.length || carriers.length})`}</span>
          </button>
        </div>
      </div>

      {/* Main Carrier Leads Table with Renamed Headers */}
      <div className="rounded-2xl overflow-hidden" style={{ background: '#ffffff', border: '1.5px solid #cbd5e1', boxShadow: '0 4px 16px rgba(0,0,0,0.06)' }}>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs" style={{ color: '#000000' }}>
            <thead style={{ background: '#f1f5f9', borderBottom: '2px solid #cbd5e1', color: '#000000', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: '800' }}>
              <tr>
                <th className="p-3.5 text-center">
                  <input
                    type="checkbox"
                    checked={carriers.length > 0 && selectedIds.length === carriers.length}
                    onChange={handleSelectAll}
                    className="rounded h-4 w-4"
                    style={{ accentColor: '#4338ca' }}
                  />
                </th>
                <th className="p-3.5">USDOT</th>
                <th className="p-3.5">MC Number</th>
                <th className="p-3.5">Operating Status</th>
                <th className="p-3.5">Company Name</th>
                {/* Renamed Column Header 1: Official/ owner -> Legal name */}
                <th className="p-3.5">Legal name</th>
                <th className="p-3.5">Email</th>
                <th className="p-3.5">Address</th>
                {/* Renamed Column Header 2: no. of trucks -> Total Equipment */}
                <th className="p-3.5 text-center" style={{ color: '#047857' }}>Total Equipment</th>
                {/* Renamed Column Header 3: truck type -> Equipment type */}
                <th className="p-3.5">Equipment type</th>
                <th className="p-3.5">Cargo Types</th>
                <th className="p-3.5 text-center">Action</th>
              </tr>
            </thead>
            <tbody style={{ fontWeight: '600' }}>
              {loading ? (
                <tr>
                  <td colSpan="12" className="p-12 text-center" style={{ color: '#000000' }}>
                    <div className="flex flex-col items-center space-y-3">
                      <div className="h-8 w-8 animate-spin rounded-full border-4" style={{ borderColor: '#4338ca', borderTopColor: 'transparent' }}></div>
                      <p className="text-sm font-bold" style={{ color: '#000000' }}>Searching MOTUS Carrier Leads...</p>
                    </div>
                  </td>
                </tr>
              ) : carriers.length === 0 ? (
                <tr>
                  <td colSpan="12" className="p-12 text-center" style={{ color: '#000000' }}>
                    <div className="flex flex-col items-center space-y-2">
                      <AlertCircle className="h-8 w-8 text-slate-400" />
                      <p className="text-base font-extrabold" style={{ color: '#000000' }}>No Carrier Leads Found</p>
                      <p className="text-xs font-semibold" style={{ color: '#475569' }}>
                        Try adjusting your date selection, MC range, or search parameters.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                carriers.map((carrier) => {
                  const statusNormalized = (carrier.authority_status || 'Active').toLowerCase();
                  const isActive = statusNormalized.includes('active') || statusNormalized.includes('authorized');
                  const isEditingThisRow = editingUsdot === carrier.usdot;

                  if (isEditingThisRow) {
                    return (
                      <tr
                        key={carrier.usdot}
                        style={{ borderTop: '1px solid #c7d2fe', background: '#f5f3ff' }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <td className="p-3 text-center">
                          <input
                            type="checkbox"
                            checked={selectedIds.includes(carrier.usdot)}
                            onChange={() => handleToggleSelect(carrier.usdot)}
                            className="rounded h-4 w-4"
                            style={{ accentColor: '#4338ca' }}
                          />
                        </td>
                        <td className="p-3 font-mono font-extrabold" style={{ color: '#312e81' }}>
                          {carrier.usdot}
                        </td>
                        <td className="p-3">
                          <input
                            type="text"
                            value={editRowData.mc_number}
                            onChange={e => setEditRowData({ ...editRowData, mc_number: e.target.value })}
                            placeholder="MC-XXXXXX"
                            className="w-24 px-2 py-1 rounded border border-indigo-300 text-xs font-mono font-bold bg-white"
                          />
                        </td>
                        <td className="p-3">
                          <select
                            value={editRowData.authority_status}
                            onChange={e => setEditRowData({ ...editRowData, authority_status: e.target.value })}
                            className="px-2 py-1 rounded border border-indigo-300 text-xs font-bold bg-white"
                          >
                            <option value="Active">Active</option>
                            <option value="Pending">Pending</option>
                          </select>
                        </td>
                        <td className="p-3">
                          <input
                            type="text"
                            value={editRowData.legal_name}
                            onChange={e => setEditRowData({ ...editRowData, legal_name: e.target.value })}
                            placeholder="Company Name"
                            className="w-36 px-2 py-1 rounded border border-indigo-300 text-xs font-bold bg-white"
                          />
                        </td>
                        <td className="p-3">
                          <input
                            type="text"
                            value={editRowData.company_official}
                            onChange={e => setEditRowData({ ...editRowData, company_official: e.target.value })}
                            placeholder="Official / Owner"
                            className="w-32 px-2 py-1 rounded border border-indigo-300 text-xs bg-white"
                          />
                        </td>
                        <td className="p-3">
                          <input
                            type="text"
                            value={editRowData.email}
                            onChange={e => setEditRowData({ ...editRowData, email: e.target.value })}
                            placeholder="email@domain.com"
                            className="w-36 px-2 py-1 rounded border border-indigo-300 text-xs font-mono bg-white"
                          />
                        </td>
                        <td className="p-3">
                          <input
                            type="text"
                            value={editRowData.address}
                            onChange={e => setEditRowData({ ...editRowData, address: e.target.value })}
                            placeholder="Address"
                            className="w-36 px-2 py-1 rounded border border-indigo-300 text-xs bg-white"
                          />
                        </td>
                        <td className="p-3 text-center">
                          <input
                            type="number"
                            value={editRowData.total_trucks}
                            onChange={e => setEditRowData({ ...editRowData, total_trucks: parseInt(e.target.value, 10) || 1 })}
                            className="w-16 px-1.5 py-1 rounded border border-indigo-300 text-xs font-mono font-bold text-center bg-white"
                          />
                        </td>
                        <td className="p-3">
                          <select
                            value={editRowData.equipment_type}
                            onChange={e => setEditRowData({ ...editRowData, equipment_type: e.target.value })}
                            className="px-2 py-1 rounded border border-indigo-300 text-xs font-bold bg-white"
                          >
                            <option value="Box Truck">Box Truck</option>
                            <option value="Hotshot/Power Only">Hotshot/Power Only</option>
                            <option value="Fleet">Fleet</option>
                          </select>
                        </td>
                        <td className="p-3 text-xs text-slate-500">
                          Editing...
                        </td>
                        <td className="p-3 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center space-x-1">
                            <button
                              onClick={(e) => handleSaveEditRow(carrier.usdot, e)}
                              disabled={savingEdit}
                              className="rounded-lg p-1.5 transition-all text-emerald-700 hover:bg-emerald-100 font-bold"
                              title="Save Changes"
                            >
                              {savingEdit ? <Loader className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                            </button>
                            <button
                              onClick={(e) => handleCancelEditRow(e)}
                              className="rounded-lg p-1.5 transition-all text-slate-600 hover:bg-slate-200 font-bold"
                              title="Cancel Editing"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  }
                  
                  return (
                    <tr
                      key={carrier.usdot}
                      className="transition-colors cursor-pointer"
                      style={{ borderTop: '1px solid #e2e8f0', color: '#000000' }}
                      onMouseOver={e => e.currentTarget.style.background = '#f8fafc'}
                      onMouseOut={e => e.currentTarget.style.background = ''}
                      onClick={() => onSelectCarrier(carrier)}
                    >
                      {/* Checkbox */}
                      <td className="p-3.5 text-center" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(carrier.usdot)}
                          onChange={() => handleToggleSelect(carrier.usdot)}
                          className="rounded h-4 w-4"
                          style={{ accentColor: '#4338ca' }}
                        />
                      </td>

                      {/* 1. USDOT */}
                      <td className="p-3.5 font-mono font-extrabold whitespace-nowrap" style={{ color: '#312e81' }}>
                        {carrier.usdot}
                      </td>

                      {/* 2. MC Number */}
                      <td className="p-3.5 font-mono font-bold whitespace-nowrap" style={{ color: '#000000' }}>
                        {carrier.mc_number || 'N/A'}
                      </td>

                      {/* 3. Operating Status (Active vs Pending) */}
                      <td className="p-3.5 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-extrabold ${
                          isActive ? 'badge-active' : 'badge-pending'
                        }`}>
                          {isActive ? 'Active' : 'Pending'}
                        </span>
                      </td>

                      {/* 4. Company Name */}
                      <td className="p-3.5 font-extrabold max-w-[180px] truncate" style={{ color: '#000000' }} title={carrier.legal_name}>
                        {carrier.legal_name}
                      </td>

                      {/* 5. Legal name (was Official / Owner) */}
                      <td className="p-3.5 whitespace-nowrap font-bold" style={{ color: '#000000' }}>
                        {carrier.company_official || carrier.legal_name || 'N/A'}
                      </td>

                      {/* 6. Email */}
                      <td className="p-3.5 max-w-[150px] truncate font-semibold" style={{ color: '#1e1b4b' }} title={carrier.email}>
                        {carrier.email || 'N/A'}
                      </td>

                      {/* 7. Address */}
                      <td className="p-3.5 max-w-[200px] truncate font-medium" style={{ color: '#000000' }} title={carrier.address}>
                        {carrier.address || 'N/A'}
                      </td>

                      {/* 8. Total Equipment (was No of Trucks) */}
                      <td className="p-3.5 text-center font-mono font-extrabold text-sm" style={{ color: '#047857' }}>
                        {carrier.total_trucks != null ? carrier.total_trucks : 1}
                      </td>

                      {/* 9. Equipment type (was Type of Trucks) */}
                      <td className="p-3.5 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-extrabold ${
                          String(carrier.equipment_type).includes('Box')
                            ? 'badge-box-truck'
                            : String(carrier.equipment_type).includes('Trailer')
                            ? 'badge-trailer'
                            : 'badge-big-equipment'
                        }`}>
                          {carrier.equipment_type || 'Box Truck'}
                        </span>
                      </td>

                      {/* 10. Cargo Types */}
                      <td className="p-3.5 max-w-[160px]">
                        <div className="flex flex-wrap gap-1">
                          {(Array.isArray(carrier.cargo_classifications) ? carrier.cargo_classifications : [carrier.cargo_classifications])
                            .slice(0, 2)
                            .map((cg, idx) => (
                              <span key={idx} className="rounded px-1.5 py-0.5 text-[10px] font-bold" style={{ background: '#f1f5f9', color: '#000000', border: '1px solid #cbd5e1' }}>
                                {cg}
                              </span>
                            ))}
                          {Array.isArray(carrier.cargo_classifications) && carrier.cargo_classifications.length > 2 && (
                            <span className="text-[10px] font-extrabold" style={{ color: '#475569' }}>
                              +{carrier.cargo_classifications.length - 2}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Action */}
                      <td className="p-3.5 text-center whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-center space-x-1">
                          <button
                            onClick={() => onSelectCarrier(carrier)}
                            className="rounded-lg p-1.5 transition-all text-indigo-700 hover:bg-indigo-100"
                            title="View Full Profile & Vehicles"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          {user && user.role === 'admin' && (
                            <>
                              <button
                                onClick={(e) => handleStartEditRow(carrier, e)}
                                className="rounded-lg p-1.5 transition-all text-amber-600 hover:bg-amber-100"
                                title={`Edit USDOT ${carrier.usdot} (Admin Only)`}
                              >
                                <Edit2 className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteSingle(carrier)}
                                className="rounded-lg p-1.5 transition-all text-red-600 hover:bg-red-100"
                                title={`Delete USDOT ${carrier.usdot} (Admin Only)`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
