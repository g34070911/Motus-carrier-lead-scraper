import React from 'react';
import { X, AlertTriangle, ShieldCheck, Sparkles, Check, ArrowRight } from 'lucide-react';

export default function PlanUpgradeModal({ isOpen, onClose, errorData }) {
  if (!isOpen) return null;

  const isUnassigned = errorData?.code === 'PLAN_UNASSIGNED';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
      <div className="relative w-full max-w-lg glass-card rounded-3xl p-6 md:p-8 space-y-6 border border-amber-500/30 shadow-2xl">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-xl bg-slate-900 text-slate-400 hover:text-white transition-all"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Header Icon */}
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30 shadow-lg shadow-amber-500/10">
          <AlertTriangle className="h-7 w-7" />
        </div>

        {/* Title */}
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-bold text-white font-outfit">
            {isUnassigned ? 'Service Pending Activation' : 'Daily Trial Limit Reached'}
          </h2>
          <p className="text-xs text-slate-300 leading-relaxed">
            {errorData?.message || 
              (isUnassigned 
                ? 'Your registered account is awaiting plan activation by the site administrator.'
                : 'Trial plan allows maximum 1,000 carrier leads per day.')
            }
          </p>
        </div>

        {/* Plan Comparison Card */}
        <div className="grid grid-cols-2 gap-3 pt-2">
          
          {/* Trial Box */}
          <div className="glass-card rounded-xl p-4 space-y-2 border border-slate-800 text-left">
            <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400">Trial Plan</span>
            <p className="text-lg font-bold text-white">1,000 Leads</p>
            <p className="text-[11px] text-slate-400">Daily limit for trial lead generation & CSV export.</p>
          </div>

          {/* Premium Box */}
          <div className="glass-card rounded-xl p-4 space-y-2 border border-emerald-500/30 bg-emerald-950/20 text-left relative overflow-hidden">
            <div className="absolute top-0 right-0 bg-emerald-500 text-slate-950 px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wider rounded-bl">RECOMMENDED</div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">Premium Plan</span>
            <p className="text-lg font-bold text-white">UNLIMITED</p>
            <p className="text-[11px] text-slate-300">Unlimited carrier lead searches, PDF scraping & CSV exports.</p>
          </div>

        </div>

        {/* Call to action */}
        <div className="rounded-xl bg-slate-900/80 p-4 border border-slate-800 text-xs text-slate-300 space-y-2">
          <p className="font-semibold text-white flex items-center space-x-1.5">
            <ShieldCheck className="h-4 w-4 text-purple-400" />
            <span>How to activate or upgrade your plan?</span>
          </p>
          <p className="text-slate-400">
            Contact your system admin or login with the <span className="font-mono text-purple-300 font-bold">Admin Owner</span> account (<code className="text-white">admin@motus.com</code>) to assign a plan to this user account in the Admin Console.
          </p>
        </div>

        <button
          onClick={onClose}
          className="w-full flex items-center justify-center space-x-2 rounded-xl bg-indigo-600 py-3 text-sm font-bold text-white shadow-lg shadow-indigo-600/30 hover:bg-indigo-500 transition-all"
        >
          <span>Understood</span>
        </button>

      </div>
    </div>
  );
}
