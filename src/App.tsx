import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { ResidentDashboard } from './components/ResidentDashboard';
import { UtilityAnalystDashboard } from './components/UtilityAnalystDashboard';
import { TestSuiteModal } from './components/TestSuiteModal';
import { SoaArchitectureModal } from './components/SoaArchitectureModal';
import { Bell, ShieldAlert, X } from 'lucide-react';

export default function App() {
  const [currentRole, setCurrentRole] = useState<'RESIDENT' | 'ANALYST'>('RESIDENT');
  const [isTestSuiteOpen, setIsTestSuiteOpen] = useState<boolean>(false);
  const [isArchitectureOpen, setIsArchitectureOpen] = useState<boolean>(false);
  const [isBackendConnected, setIsBackendConnected] = useState<boolean>(true);
  const [openCasesCount, setOpenCasesCount] = useState<number>(1);
  const [activeToast, setActiveToast] = useState<{
    id: string;
    title: string;
    message: string;
    caseId?: string;
  } | null>(null);

  // Check backend health and listen for real-time events
  useEffect(() => {
    fetch('/api/system/status')
      .then((res) => {
        if (res.ok) setIsBackendConnected(true);
      })
      .catch(() => {
        setIsBackendConnected(false);
      });

    // Check open cases count
    fetch('/api/leak-case/cases?status=OPEN')
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setOpenCasesCount(data.length);
      })
      .catch(() => {});

    // SSE connection for live notifications
    let eventSource: EventSource | null = null;
    try {
      eventSource = new EventSource('/api/events/stream');

      eventSource.addEventListener('case_created', (e: MessageEvent) => {
        try {
          const payload = JSON.parse(e.data);
          setOpenCasesCount((prev) => prev + 1);
          if (payload.case) {
            setActiveToast({
              id: payload.case.id,
              title: `Leak Alert: ${payload.case.propertyName}`,
              message: `Anomaly detected (+${payload.case.deviationPercent}%). Investigation case ${payload.case.id} created.`,
              caseId: payload.case.id,
            });
          }
        } catch {}
      });
    } catch {}

    return () => {
      if (eventSource) eventSource.close();
    };
  }, []);

  // Dismiss toast after 7 seconds
  useEffect(() => {
    if (activeToast) {
      const timer = setTimeout(() => setActiveToast(null), 7000);
      return () => clearTimeout(timer);
    }
  }, [activeToast]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      {/* Navigation Header with Role Switcher */}
      <Navbar
        currentRole={currentRole}
        onRoleChange={setCurrentRole}
        onOpenTestSuite={() => setIsTestSuiteOpen(true)}
        onOpenArchitecture={() => setIsArchitectureOpen(true)}
        isBackendConnected={isBackendConnected}
        openCasesCount={openCasesCount}
      />

      {/* Main Dashboard Workspace */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {currentRole === 'RESIDENT' ? (
          <ResidentDashboard
            onSwitchToAnalyst={() => setCurrentRole('ANALYST')}
          />
        ) : (
          <UtilityAnalystDashboard />
        )}
      </main>

      {/* Live Anomaly Notification Toast */}
      {activeToast && (
        <div className="fixed bottom-5 right-5 z-50 max-w-md w-full bg-slate-900 text-white rounded-xl shadow-2xl border border-slate-700 p-4 animate-in slide-in-from-bottom duration-200">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-rose-500/20 text-rose-400 flex items-center justify-center shrink-0 mt-0.5">
                <ShieldAlert className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <h4 className="font-bold text-xs text-white">{activeToast.title}</h4>
                <p className="text-[11px] text-slate-300 mt-0.5">{activeToast.message}</p>
                {currentRole === 'RESIDENT' && (
                  <button
                    type="button"
                    onClick={() => {
                      setCurrentRole('ANALYST');
                      setActiveToast(null);
                    }}
                    className="mt-2 text-[11px] font-semibold text-cyan-400 hover:text-cyan-300 underline cursor-pointer"
                  >
                    Switch to Analyst Dashboard &rarr;
                  </button>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={() => setActiveToast(null)}
              className="p-1 text-slate-400 hover:text-white rounded"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Test Suite Modal */}
      <TestSuiteModal
        isOpen={isTestSuiteOpen}
        onClose={() => setIsTestSuiteOpen(false)}
      />

      {/* SOA Architecture Modal */}
      <SoaArchitectureModal
        isOpen={isArchitectureOpen}
        onClose={() => setIsArchitectureOpen(false)}
      />

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-4 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>
            HydroWatch &copy; 2026 — Smart Water Leak Detection &amp; Automated Investigation System
          </span>
          <span className="font-mono text-[11px] text-slate-400">
            SOA S10.T02 • Kafka Topic: <span className="text-slate-600">soa.s10.t02.events</span>
          </span>
        </div>
      </footer>
    </div>
  );
}
