import React from 'react';
import { Droplets, ShieldCheck, Building2, Home, CheckCircle2, Cpu, Wrench } from 'lucide-react';

interface NavbarProps {
  currentRole: 'RESIDENT' | 'ANALYST';
  onRoleChange: (role: 'RESIDENT' | 'ANALYST') => void;
  onOpenTestSuite: () => void;
  onOpenArchitecture: () => void;
  isBackendConnected: boolean;
  openCasesCount: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentRole,
  onRoleChange,
  onOpenTestSuite,
  onOpenArchitecture,
  isBackendConnected,
  openCasesCount,
}) => {
  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-xs">
      {/* Top Demo Bar */}
      <div className="bg-slate-900 text-slate-300 text-[11px] px-4 py-1.5 flex flex-wrap items-center justify-between gap-2 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <span className="flex h-2 w-2 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500"></span>
          </span>
          <span className="font-semibold text-white tracking-wide uppercase text-[10px]">
            DEMONSTRATION SYSTEM
          </span>
          <span className="text-slate-400 hidden sm:inline">•</span>
          <span className="text-slate-300 hidden sm:inline">
            Direct access enabled — No authentication required
          </span>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-[10px] font-mono">
            {isBackendConnected ? (
              <span className="flex items-center gap-1 text-emerald-400 font-medium">
                <CheckCircle2 className="w-3 h-3 text-emerald-400" /> SOA Gateway Connected
              </span>
            ) : (
              <span className="flex items-center gap-1 text-amber-400 font-medium">
                <span className="w-2 h-2 rounded-full bg-amber-400"></span> Client-Engine Active
              </span>
            )}
          </div>
          <span className="text-slate-600 hidden md:inline">|</span>
          <span className="text-slate-400 text-[10px] hidden md:inline font-mono">
            Topic: soa.s10.t02.events
          </span>
        </div>
      </div>

      {/* Main Navbar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">
          {/* Logo & Tagline */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
              <Droplets className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-lg text-slate-900 tracking-tight">
                  Hydro<span className="text-blue-600">Watch</span>
                </span>
                <span className="text-[10px] font-bold tracking-wider uppercase bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded border border-blue-200">
                  SOA S10
                </span>
              </div>
              <p className="text-xs text-slate-500 hidden sm:block font-medium">
                Monitor Water. Detect Leaks. Save Every Drop.
              </p>
            </div>
          </div>

          {/* Central Role Switcher */}
          <div className="bg-slate-100 p-1 rounded-xl flex items-center border border-slate-200/80">
            <button
              type="button"
              onClick={() => onRoleChange('RESIDENT')}
              className={`flex items-center gap-1.5 px-3 sm:px-4 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                currentRole === 'RESIDENT'
                  ? 'bg-white text-blue-700 shadow-xs border border-slate-200/60'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Home className="w-3.5 h-3.5" />
              <span>Resident Dashboard</span>
            </button>

            <button
              type="button"
              onClick={() => onRoleChange('ANALYST')}
              className={`flex items-center gap-1.5 px-3 sm:px-4 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer relative ${
                currentRole === 'ANALYST'
                  ? 'bg-white text-blue-700 shadow-xs border border-slate-200/60'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>Utility Analyst Dashboard</span>
              {openCasesCount > 0 && (
                <span className="ml-1 bg-rose-500 text-white text-[10px] font-bold px-1.5 py-0.2 rounded-full">
                  {openCasesCount}
                </span>
              )}
            </button>
          </div>

          {/* Utility Tools: Test Cases & SOA Architecture */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onOpenTestSuite}
              title="Run Automated Tests (Test A, B, C, D)"
              className="flex items-center gap-1.5 text-xs font-medium text-slate-700 hover:text-blue-600 bg-slate-50 hover:bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-lg transition cursor-pointer"
            >
              <Wrench className="w-3.5 h-3.5 text-blue-600" />
              <span className="hidden md:inline">Test Suite</span>
            </button>

            <button
              type="button"
              onClick={onOpenArchitecture}
              title="Inspect SOA Architecture & Microservices"
              className="flex items-center gap-1.5 text-xs font-medium text-slate-700 hover:text-blue-600 bg-slate-50 hover:bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-lg transition cursor-pointer"
            >
              <Cpu className="w-3.5 h-3.5 text-cyan-600" />
              <span className="hidden md:inline">SOA Services</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
