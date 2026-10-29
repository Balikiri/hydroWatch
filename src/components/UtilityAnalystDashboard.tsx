import React, { useState, useEffect } from 'react';
import { InvestigationCase, PropertyMetadata, CaseStatus, CaseSeverity } from '../types/hydrowatch';
import { SAMPLE_PROPERTIES, INITIAL_INVESTIGATION_CASES } from '../utils/sampleData';
import {
  Building2,
  ShieldCheck,
  ShieldAlert,
  AlertCircle,
  Clock,
  Radio,
  Filter,
  Search,
  CheckCircle2,
  FileText,
  X,
  Send,
  RefreshCw,
  ExternalLink,
  ChevronRight,
  TrendingUp,
} from 'lucide-react';

interface UtilityAnalystDashboardProps {
  onRefresh?: () => void;
}

export const UtilityAnalystDashboard: React.FC<UtilityAnalystDashboardProps> = () => {
  const [properties, setProperties] = useState<PropertyMetadata[]>(SAMPLE_PROPERTIES);
  const [cases, setCases] = useState<InvestigationCase[]>(INITIAL_INVESTIGATION_CASES);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [severityFilter, setSeverityFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCase, setSelectedCase] = useState<InvestigationCase | null>(null);
  const [notesInput, setNotesInput] = useState<string>('');
  const [isUpdatingStatus, setIsUpdatingStatus] = useState<boolean>(false);
  const [liveEvents, setLiveEvents] = useState<any[]>([]);
  const [sseConnected, setSseConnected] = useState<boolean>(false);

  // Load properties and cases from backend
  const fetchData = async () => {
    try {
      const [propsRes, casesRes] = await Promise.all([
        fetch('/api/meter-series/properties'),
        fetch('/api/leak-case/cases'),
      ]);

      if (propsRes.ok) {
        const propsData = await propsRes.json();
        if (Array.isArray(propsData) && propsData.length > 0) {
          setProperties(propsData);
        }
      }

      if (casesRes.ok) {
        const casesData = await casesRes.json();
        if (Array.isArray(casesData) && casesData.length > 0) {
          setCases(casesData);
        }
      }
    } catch (err) {
      console.warn('Backend fetch fallback to cached state:', err);
    }
  };

  useEffect(() => {
    fetchData();

    // Connect to Server-Sent Events for real-time live push without manual page refresh
    let eventSource: EventSource | null = null;
    try {
      eventSource = new EventSource('/api/events/stream');

      eventSource.addEventListener('connected', () => {
        setSseConnected(true);
      });

      eventSource.addEventListener('case_created', (e: MessageEvent) => {
        try {
          const payload = JSON.parse(e.data);
          if (payload.case) {
            setCases((prev) => {
              // Deduplicate
              if (prev.some((c) => c.id === payload.case.id)) return prev;
              return [payload.case, ...prev];
            });
          }
          if (payload.event) {
            setLiveEvents((prev) => [payload.event, ...prev.slice(0, 9)]);
          }
        } catch (err) {
          console.error('Error parsing SSE case_created:', err);
        }
      });

      eventSource.addEventListener('anomaly_event', (e: MessageEvent) => {
        try {
          const event = JSON.parse(e.data);
          setLiveEvents((prev) => [event, ...prev.slice(0, 9)]);
        } catch (err) {
          console.error('Error parsing anomaly_event:', err);
        }
      });

      eventSource.addEventListener('case_updated', (e: MessageEvent) => {
        try {
          const updated = JSON.parse(e.data);
          setCases((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
          setSelectedCase((current) => (current && current.id === updated.id ? updated : current));
        } catch (err) {
          console.error('Error parsing case_updated:', err);
        }
      });

      eventSource.onerror = () => {
        setSseConnected(false);
      };
    } catch (e) {
      console.warn('SSE unsupported in this context, using polling:', e);
    }

    // Polling fallback every 8 seconds
    const interval = setInterval(fetchData, 8000);

    return () => {
      if (eventSource) eventSource.close();
      clearInterval(interval);
    };
  }, []);

  // Sync selected case notes
  useEffect(() => {
    if (selectedCase) {
      setNotesInput(selectedCase.notes || '');
    }
  }, [selectedCase]);

  // Update case status and notes
  const handleUpdateCase = async (newStatus: CaseStatus) => {
    if (!selectedCase) return;
    setIsUpdatingStatus(true);

    try {
      const res = await fetch(`/api/leak-case/cases/${selectedCase.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: newStatus,
          notes: notesInput,
        }),
      });

      if (res.ok) {
        const updated: InvestigationCase = await res.json();
        setCases((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
        setSelectedCase(updated);
      } else {
        // Fallback local update
        const updated: InvestigationCase = {
          ...selectedCase,
          status: newStatus,
          notes: notesInput,
          updatedAt: new Date().toISOString(),
          auditTrail: [
            ...selectedCase.auditTrail,
            {
              timestamp: new Date().toISOString(),
              action: `Status marked ${newStatus} by Utility Analyst`,
              notes: notesInput,
            },
          ],
        };
        setCases((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
        setSelectedCase(updated);
      }
    } catch {
      // Local fallback
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  // Filter cases
  const filteredCases = cases.filter((c) => {
    if (statusFilter !== 'ALL' && c.status !== statusFilter) return false;
    if (severityFilter !== 'ALL' && c.severity !== severityFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        c.id.toLowerCase().includes(q) ||
        c.propertyName.toLowerCase().includes(q) ||
        (c.notes && c.notes.toLowerCase().includes(q))
      );
    }
    return true;
  });

  // Calculate summary metrics
  const totalProperties = properties.length;
  const suspectedLeaks = properties.filter((p) => p.status === 'POSSIBLE_LEAK' || p.status === 'SEVERE_LEAK').length;
  const normalProperties = totalProperties - suspectedLeaks;
  const openCases = cases.filter((c) => c.status === 'OPEN').length;

  return (
    <div className="space-y-6 pb-12">
      {/* Header Banner */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-slate-900">Utility Operations &amp; Anomaly Analyst</h2>
            <span className="flex items-center gap-1 text-[11px] font-mono bg-blue-50 text-blue-700 px-2 py-0.5 rounded border border-blue-200">
              <Radio className="w-3 h-3 animate-pulse text-blue-600" />
              Live SSE Push: {sseConnected ? 'Connected' : 'Active (Polling)'}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Real-time multi-household water telemetry, Kafka anomaly event stream, and investigation case lifecycle management.
          </p>
        </div>

        <button
          type="button"
          onClick={fetchData}
          className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 border border-slate-200 px-3.5 py-2 rounded-lg transition self-start md:self-auto cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5 text-blue-600" />
          <span>Refresh Telemetry</span>
        </button>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-4">
          <div className="flex items-center justify-between text-slate-500 text-xs mb-2">
            <span className="font-medium">Total Monitored Properties</span>
            <Building2 className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-bold font-mono text-slate-900">{totalProperties}</div>
          <div className="text-[11px] text-slate-400 mt-2 font-mono">Home A, Home B, Home C</div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-4">
          <div className="flex items-center justify-between text-slate-500 text-xs mb-2">
            <span className="font-medium">Normal Flow Properties</span>
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold font-mono text-emerald-600">{normalProperties}</div>
          <div className="text-[11px] text-slate-400 mt-2">Flows within baseline bounds</div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-4">
          <div className="flex items-center justify-between text-slate-500 text-xs mb-2">
            <span className="font-medium">Suspected Leaks</span>
            <ShieldAlert className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-bold font-mono text-amber-600">{suspectedLeaks}</div>
          <div className="text-[11px] text-slate-400 mt-2">Breached baseline threshold</div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-4">
          <div className="flex items-center justify-between text-slate-500 text-xs mb-2">
            <span className="font-medium">Open Investigation Cases</span>
            <AlertCircle className="w-4 h-4 text-rose-600" />
          </div>
          <div className="text-2xl font-bold font-mono text-rose-600">{openCases}</div>
          <div className="text-[11px] text-slate-400 mt-2 font-mono">Awaiting analyst triage</div>
        </div>
      </div>

      {/* Multi-Property Grid Overview */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5">
        <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center justify-between">
          <span>Active Monitored Households Overview</span>
          <span className="text-xs font-normal text-slate-500 font-mono">District 10 - Sub-district 02</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {properties.map((p) => {
            const dev = p.baselineFlow > 0 ? Math.round(((p.currentFlow - p.baselineFlow) / p.baselineFlow) * 100 * 100) / 100 : null;
            const isLeak = dev !== null && dev > 55;

            return (
              <div
                key={p.id}
                className={`p-4 rounded-xl border transition ${
                  isLeak ? 'border-rose-300 bg-rose-50/40' : 'border-slate-200 bg-slate-50/50'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-sm text-slate-900">{p.name.split('(')[0].trim()}</span>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      isLeak ? 'bg-rose-100 text-rose-800 border border-rose-300' : 'bg-emerald-100 text-emerald-800'
                    }`}
                  >
                    {isLeak ? 'Suspected Leak' : 'Normal Flow'}
                  </span>
                </div>
                <div className="text-[11px] text-slate-500 mb-3 truncate">{p.address}</div>

                <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-slate-200/80">
                  <div>
                    <span className="text-slate-400 text-[10px] block">Baseline:</span>
                    <span className="font-mono font-semibold text-slate-800">{p.baselineFlow} L/h</span>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[10px] block">Current Flow:</span>
                    <span className="font-mono font-semibold text-slate-800">{p.currentFlow} L/h</span>
                  </div>
                  <div className="col-span-2 flex items-center justify-between pt-1">
                    <span className="text-slate-500 text-[11px]">Deviation:</span>
                    <span className={`font-mono font-bold text-xs ${isLeak ? 'text-rose-600' : 'text-emerald-600'}`}>
                      {dev !== null ? `${dev > 0 ? '+' : ''}${dev}%` : 'N/A'}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Real-Time Kafka Stream Ticker */}
      <div className="bg-slate-900 text-white rounded-xl shadow-xs p-4 border border-slate-800">
        <div className="flex items-center justify-between pb-2 mb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Radio className="w-4 h-4 text-cyan-400 animate-pulse" />
            <span className="text-xs font-semibold tracking-wider uppercase font-mono text-cyan-400">
              Kafka Live Ingestion Feed
            </span>
            <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded font-mono">
              topic: soa.s10.t02.events
            </span>
          </div>
          <span className="text-[10px] text-slate-400">Events stream automatically from Baseline Service</span>
        </div>

        {liveEvents.length === 0 ? (
          <div className="text-xs text-slate-400 font-mono py-2">
            [Awaiting incoming events] Trigger a simulated leak in the Resident Dashboard to watch Kafka events stream live here.
          </div>
        ) : (
          <div className="space-y-1.5 max-h-32 overflow-y-auto font-mono text-[11px]">
            {liveEvents.map((evt, idx) => (
              <div
                key={evt.eventId || idx}
                className="flex flex-wrap items-center justify-between gap-2 bg-slate-800/80 p-2 rounded border border-slate-700/60"
              >
                <div className="flex items-center gap-2">
                  <span className="text-amber-400 font-bold">[{evt.eventType || 'NightFlowAnomalyDetected'}]</span>
                  <span className="text-white">{evt.propertyName || evt.propertyId}</span>
                  <span className="text-rose-400 font-bold">
                    Flow: {evt.observedFlow} L/h (Dev: +{evt.deviationPercent}%)
                  </span>
                </div>
                <div className="text-slate-400 text-[10px]">
                  {new Date(evt.timestamp).toLocaleTimeString()} • ID: {evt.eventId}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Investigation Cases Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        {/* Table Controls */}
        <div className="p-4 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-50/60">
          <div>
            <h3 className="font-bold text-slate-900 text-sm">Investigation Cases Registry</h3>
            <p className="text-xs text-slate-500">
              Persisted leak cases consumed from Kafka topic by LeakCase service with idempotent deduplication.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Search */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search cases..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 pr-3 py-1.5 text-xs border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 w-44"
              />
            </div>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white text-slate-700 outline-none"
            >
              <option value="ALL">All Statuses</option>
              <option value="OPEN">Open</option>
              <option value="UNDER_INVESTIGATION">Under Investigation</option>
              <option value="RESOLVED">Resolved</option>
            </select>

            {/* Severity Filter */}
            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              className="text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white text-slate-700 outline-none"
            >
              <option value="ALL">All Severities</option>
              <option value="MODERATE">Moderate</option>
              <option value="SEVERE">Severe</option>
            </select>
          </div>
        </div>

        {/* Table Content */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100/80 text-slate-600 font-semibold border-b border-slate-200">
                <th className="py-3 px-4">Case ID</th>
                <th className="py-3 px-4">Property</th>
                <th className="py-3 px-4">Flow vs Baseline</th>
                <th className="py-3 px-4">Deviation</th>
                <th className="py-3 px-4">Severity</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Detected At</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredCases.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">
                    No investigation cases match the selected filters.
                  </td>
                </tr>
              ) : (
                filteredCases.map((c) => {
                  return (
                    <tr
                      key={c.id}
                      onClick={() => setSelectedCase(c)}
                      className={`hover:bg-blue-50/50 cursor-pointer transition ${
                        selectedCase?.id === c.id ? 'bg-blue-50/70' : ''
                      }`}
                    >
                      <td className="py-3 px-4 font-mono font-bold text-blue-700">
                        {c.id}
                      </td>
                      <td className="py-3 px-4 font-medium text-slate-900">
                        {c.propertyName}
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-700">
                        {c.observedFlow} L/h vs {c.baselineFlow} L/h
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-mono font-bold text-rose-600">
                          +{c.deviationPercent}%
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                            c.severity === 'SEVERE'
                              ? 'bg-rose-100 text-rose-800 border border-rose-300'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {c.severity}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded ${
                            c.status === 'OPEN'
                              ? 'bg-rose-50 text-rose-700 border border-rose-200'
                              : c.status === 'UNDER_INVESTIGATION'
                              ? 'bg-amber-50 text-amber-700 border border-amber-200'
                              : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          }`}
                        >
                          {c.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-500 font-mono text-[11px]">
                        {new Date(c.createdAt).toLocaleDateString()} {new Date(c.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedCase(c);
                          }}
                          className="text-xs font-semibold text-blue-600 hover:text-blue-800 bg-white hover:bg-slate-50 border border-slate-200 px-2.5 py-1 rounded transition"
                        >
                          Inspect
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Case Details Drawer / Modal */}
      {selectedCase && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-5 animate-in fade-in duration-150">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold bg-blue-100 text-blue-800 px-2 py-0.5 rounded">
                    {selectedCase.id}
                  </span>
                  <span
                    className={`text-xs font-semibold px-2 py-0.5 rounded ${
                      selectedCase.status === 'OPEN'
                        ? 'bg-rose-100 text-rose-800'
                        : selectedCase.status === 'UNDER_INVESTIGATION'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-emerald-100 text-emerald-800'
                    }`}
                  >
                    {selectedCase.status.replace('_', ' ')}
                  </span>
                </div>
                <h3 className="text-base font-bold text-slate-900 mt-1">{selectedCase.propertyName}</h3>
              </div>

              <button
                type="button"
                onClick={() => setSelectedCase(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Case Telemetry Details */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-3.5 rounded-lg border border-slate-200/80 text-xs">
              <div>
                <span className="text-slate-400 text-[10px] block">Night Baseline</span>
                <span className="font-mono font-bold text-slate-800">{selectedCase.baselineFlow} L/h</span>
              </div>
              <div>
                <span className="text-slate-400 text-[10px] block">Observed Flow</span>
                <span className="font-mono font-bold text-slate-800">{selectedCase.observedFlow} L/h</span>
              </div>
              <div>
                <span className="text-slate-400 text-[10px] block">Calculated Deviation</span>
                <span className="font-mono font-bold text-rose-600">+{selectedCase.deviationPercent}%</span>
              </div>
              <div>
                <span className="text-slate-400 text-[10px] block">Kafka Event ID</span>
                <span className="font-mono text-[10px] text-slate-600 truncate block">{selectedCase.eventId}</span>
              </div>
            </div>

            {/* Status Management Actions */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-2">
                Workflow Actions (Status Transition)
              </label>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={isUpdatingStatus || selectedCase.status === 'UNDER_INVESTIGATION'}
                  onClick={() => handleUpdateCase('UNDER_INVESTIGATION')}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white transition cursor-pointer"
                >
                  Mark Under Investigation
                </button>

                <button
                  type="button"
                  disabled={isUpdatingStatus || selectedCase.status === 'RESOLVED'}
                  onClick={() => handleUpdateCase('RESOLVED')}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white transition cursor-pointer"
                >
                  Mark as Resolved
                </button>

                <button
                  type="button"
                  disabled={isUpdatingStatus || selectedCase.status === 'OPEN'}
                  onClick={() => handleUpdateCase('OPEN')}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-200 hover:bg-slate-300 disabled:opacity-50 text-slate-800 transition cursor-pointer"
                >
                  Reopen Case
                </button>
              </div>
            </div>

            {/* Investigation Notes Form */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Investigation Notes &amp; Findings
              </label>
              <textarea
                rows={3}
                value={notesInput}
                onChange={(e) => setNotesInput(e.target.value)}
                placeholder="Document diagnostic findings, technician dispatch, leak repair confirmation, etc."
                className="w-full text-xs p-3 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 font-sans"
              />
              <button
                type="button"
                onClick={() => handleUpdateCase(selectedCase.status)}
                disabled={isUpdatingStatus}
                className="mt-2 flex items-center gap-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg transition cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Save Notes</span>
              </button>
            </div>

            {/* Audit Trail Log */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-2">
                Audit Trail &amp; Event History
              </label>
              <div className="space-y-2 border-l-2 border-slate-200 pl-3">
                {selectedCase.auditTrail.map((trail, index) => (
                  <div key={index} className="text-xs">
                    <div className="font-semibold text-slate-800">{trail.action}</div>
                    <div className="text-[10px] text-slate-400 font-mono">
                      {new Date(trail.timestamp).toLocaleString()}
                    </div>
                    {trail.notes && (
                      <div className="text-[11px] text-slate-600 mt-0.5 bg-slate-50 p-1.5 rounded border border-slate-200/60">
                        {trail.notes}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
