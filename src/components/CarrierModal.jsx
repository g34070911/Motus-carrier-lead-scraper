import React from 'react';
import { X, ExternalLink, Truck, ShieldCheck, MapPin, Phone, Mail, UserCheck, Tag, Layers } from 'lucide-react';

export default function CarrierModal({ carrier, onClose }) {
  if (!carrier) return null;

  const vehicles = carrier.vehicles || {
    straight_trucks: { owned: carrier.straight_trucks_owned || 0, leased: carrier.straight_trucks_leased || 0 },
    trailers: { owned: carrier.trailers_owned || 0, leased: carrier.trailers_leased || 0 },
    tractors: { owned: carrier.tractors_owned || 0, leased: carrier.tractors_leased || 0 },
    non_comm: { owned: carrier.non_comm_owned || 0, leased: carrier.non_comm_leased || 0 },
    placarded: { owned: carrier.placarded_owned || 0, leased: carrier.placarded_leased || 0 }
  };

  const cargos = Array.isArray(carrier.cargo_classifications) 
    ? carrier.cargo_classifications 
    : [carrier.cargo_classifications || 'General Freight'];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
      <div className="relative w-full max-w-3xl glass-card rounded-3xl p-6 md:p-8 space-y-6 border border-indigo-500/20 shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-xl bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800 transition-all"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Header Title */}
        <div className="space-y-2 pr-8">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-indigo-500/10 px-3 py-1 text-xs font-mono font-bold text-indigo-300 border border-indigo-500/30">
              USDOT #{carrier.usdot}
            </span>
            <span className="rounded-full bg-slate-800 px-3 py-1 text-xs font-mono text-slate-300 border border-slate-700">
              {carrier.mc_number || 'MC-Pending'}
            </span>
            <span className={`px-3 py-1 rounded-full text-xs font-bold ${
              (carrier.authority_status || '').toLowerCase().includes('authorized')
                ? 'badge-authorized'
                : 'badge-pending'
            }`}>
              {carrier.authority_status || 'Authorized'}
            </span>
            <span className={`px-3 py-1 rounded-full text-xs font-bold ${
              carrier.equipment_type === 'Box Truck' ? 'badge-box-truck' : carrier.equipment_type === 'Trailer' ? 'badge-trailer' : 'badge-big-equipment'
            }`}>
              {carrier.equipment_type || 'Box Truck'}
            </span>
          </div>

          <h2 className="text-2xl font-extrabold text-white font-outfit">{carrier.legal_name}</h2>
          <p className="text-xs text-slate-400">{carrier.authority_type || 'Motor Carrier of Property'}</p>
        </div>

        {/* Info Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          
          <div className="glass-card rounded-xl p-4 space-y-1 border border-slate-800">
            <div className="flex items-center space-x-2 text-xs font-bold text-slate-400">
              <UserCheck className="h-4 w-4 text-indigo-400" />
              <span>Legal name</span>
            </div>
            <p className="text-sm font-semibold text-white truncate">{carrier.company_official || carrier.legal_name || 'N/A'}</p>
          </div>

          <div className="glass-card rounded-xl p-4 space-y-1 border border-slate-800">
            <div className="flex items-center space-x-2 text-xs font-bold text-slate-400">
              <Truck className="h-4 w-4 text-emerald-400" />
              <span>Total Equipment</span>
            </div>
            <p className="text-sm font-bold text-emerald-300 font-mono">{carrier.total_trucks || 1} Total Fleet Units</p>
          </div>

          <div className="glass-card rounded-xl p-4 space-y-1 border border-slate-800">
            <div className="flex items-center space-x-2 text-xs font-bold text-slate-400">
              <Phone className="h-4 w-4 text-indigo-400" />
              <span>Telephone</span>
            </div>
            <p className="text-sm font-semibold text-indigo-300 font-mono">{carrier.telephone || 'N/A'}</p>
          </div>

          <div className="glass-card rounded-xl p-4 space-y-1 border border-slate-800 md:col-span-1">
            <div className="flex items-center space-x-2 text-xs font-bold text-slate-400">
              <Mail className="h-4 w-4 text-indigo-400" />
              <span>Email</span>
            </div>
            <p className="text-sm font-semibold text-slate-200 truncate">{carrier.email || 'N/A'}</p>
          </div>

          <div className="glass-card rounded-xl p-4 space-y-1 border border-slate-800 md:col-span-2">
            <div className="flex items-center space-x-2 text-xs font-bold text-slate-400">
              <MapPin className="h-4 w-4 text-indigo-400" />
              <span>Mailing & Physical Address</span>
            </div>
            <p className="text-sm font-semibold text-slate-200 truncate">{carrier.address || 'N/A'}</p>
          </div>

        </div>

        {/* Cargo Classifications */}
        <div className="space-y-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center space-x-1.5">
            <Tag className="h-4 w-4 text-indigo-400" />
            <span>Cargo Classifications</span>
          </h3>
          <div className="flex flex-wrap gap-2">
            {cargos.map((cg, idx) => (
              <span key={idx} className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-indigo-300 border border-slate-800 shadow-sm">
                {cg}
              </span>
            ))}
          </div>
        </div>

        {/* Vehicle Breakdown Table (Matches vehicle.png layout from prompt!) */}
        <div className="space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center space-x-1.5">
            <Layers className="h-4 w-4 text-indigo-400" />
            <span>Vehicle Equipment Metrics Breakdown</span>
          </h3>

          <div className="glass-card rounded-xl overflow-hidden border border-slate-800">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-900 text-slate-400 uppercase font-bold border-b border-slate-800">
                <tr>
                  <th className="p-3">Vehicle Type</th>
                  <th className="p-3 text-center">Owned</th>
                  <th className="p-3 text-center">Term Leased</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                <tr>
                  <td className="p-3 font-sans font-semibold text-white">Straight Trucks (Box Trucks)</td>
                  <td className="p-3 text-center text-indigo-300 font-bold">{vehicles.straight_trucks?.owned || 0}</td>
                  <td className="p-3 text-center text-indigo-300 font-bold">{vehicles.straight_trucks?.leased || 0}</td>
                </tr>
                <tr>
                  <td className="p-3 font-sans font-semibold text-white">Trailers</td>
                  <td className="p-3 text-center text-indigo-300 font-bold">{vehicles.trailers?.owned || 0}</td>
                  <td className="p-3 text-center text-indigo-300 font-bold">{vehicles.trailers?.leased || 0}</td>
                </tr>
                <tr>
                  <td className="p-3 font-sans font-semibold text-white">Truck Tractors</td>
                  <td className="p-3 text-center text-indigo-300 font-bold">{vehicles.tractors?.owned || 0}</td>
                  <td className="p-3 text-center text-indigo-300 font-bold">{vehicles.tractors?.leased || 0}</td>
                </tr>
                <tr>
                  <td className="p-3 font-sans font-semibold text-white">Non-commercial Motor Vehicles</td>
                  <td className="p-3 text-center text-indigo-300 font-bold">{vehicles.non_comm?.owned || 0}</td>
                  <td className="p-3 text-center text-indigo-300 font-bold">{vehicles.non_comm?.leased || 0}</td>
                </tr>
                <tr>
                  <td className="p-3 font-sans font-semibold text-white">Placarded Vehicles</td>
                  <td className="p-3 text-center text-indigo-300 font-bold">{vehicles.placarded?.owned || 0}</td>
                  <td className="p-3 text-center text-indigo-300 font-bold">{vehicles.placarded?.leased || 0}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* MOTUS Official URL Link */}
        <div className="pt-2 flex items-center justify-between border-t border-slate-800">
          <span className="text-xs text-slate-400">Scraped MOTUS Source:</span>
          <a
            href={carrier.motus_url || `https://motus.dot.gov/customer/${carrier.usdot}/account`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center space-x-1.5 text-xs font-semibold text-indigo-400 hover:text-indigo-300 underline"
          >
            <span>View MOTUS Page</span>
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>

      </div>
    </div>
  );
}
