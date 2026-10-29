import React, { useState, useEffect } from 'react';
import { PropertyId, PropertyMetadata, HourlyReading, EvaluationResult } from '../types/hydrowatch';
import { SAMPLE_PROPERTIES, generate24HourReadings } from '../utils/sampleData';
import { FlowChart24h } from './FlowChart24h';
import { ReadingSimulator } from './ReadingSimulator';
import { Droplet, Gauge, AlertTriangle, CheckCircle2, ShieldAlert, Sparkles, Building, Info, RefreshCw } from 'lucide-react';

interface ResidentDashboardProps {
  onSwitchToAnalyst: () => void;
  onRefreshData?: () => void;
}

export const ResidentDashboard: React.FC<ResidentDashboardProps> = ({
  onSwitchToAnalyst,
}) => {
  const [properties, setProperties] = useState<PropertyMetadata[]>(SAMPLE_PROPERTIES);
  const [selectedPropertyId, setSelectedPropertyId] = useState<PropertyId>('HOME_A');
  const [thresholdPercent, setThresholdPercent] = useState<number>(55);
  const [readings, setReadings] = useState<HourlyReading[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [lastEvaluatedResult, setLastEvaluatedResult] = useState<EvaluationResult | null>(null);

  const currentProperty = properties.find((p) => p.id === selectedPropertyId) || properties[0];

  // Fetch properties from backend if available, otherwise sample data
  const loadProperties = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/meter-series/properties');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          setProperties(data);
        }
      }
    } catch {
      // Use client sample data fallback
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadProperties();
  }, []);

  // Update 24h readings when property or threshold changes
  useEffect(() => {
    const generated = generate24HourReadings(
      currentProperty.baselineFlow,
      currentProperty.currentFlow,
      thresholdPercent
    );
    setReadings(generated);
  }, [currentProperty.id, currentProperty.baselineFlow, currentProperty.currentFlow, thresholdPercent]);

  // Calculate current deviation
  const calculateDeviation = (flow: number, baseline: number) => {
    if (baseline <= 0) return null;
    return Math.round(((flow - baseline) / baseline) * 100 * 100) / 100;
  };

  const currentDeviation = calculateDeviation(currentProperty.currentFlow, currentProperty.baselineFlow);
  const isCurrentlyLeak = currentDeviation !== null && currentDeviation > thresholdPercent;
  const isSevereLeak = currentDeviation !== null && currentDeviation >= 150;

  const handleEvaluationComplete = (result: EvaluationResult) => {
    setLastEvaluatedResult(result);
    // Update local property state
    setProperties((prev) =>
      prev.map((p) => {
        if (p.id === result.propertyId) {
          return {
            ...p,
            currentFlow: result.currentFlow,
            status: result.status === 'INSUFFICIENT_BASELINE'
              ? 'INSUFFICIENT_BASELINE'
              : result.isLeak
              ? result.severity === 'SEVERE'
                ? 'SEVERE_LEAK'
                : 'POSSIBLE_LEAK'
              : 'NORMAL',
            lastUpdated: 'Just now',
          };
        }
        return p;
      })
    );
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Property Selector Bar */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
            <Building className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-slate-500 font-medium">Select Monitored Household</div>
            <div className="text-sm font-bold text-slate-900">{currentProperty.name}</div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {properties.map((prop) => {
            const isSelected = prop.id === selectedPropertyId;
            return (
              <button
                key={prop.id}
                type="button"
                onClick={() => setSelectedPropertyId(prop.id)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition cursor-pointer border ${
                  isSelected
                    ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <span>{prop.name.split(' ')[0]} {prop.name.split(' ')[1]}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
                    isSelected ? 'bg-blue-700 text-blue-100' : 'bg-slate-200 text-slate-600'
                  }`}
                >
                  {prop.baselineFlow} L/h
                </span>
              </button>
            );
          })}

          <button
            type="button"
            onClick={loadProperties}
            disabled={isLoading}
            title="Refresh Property Telemetry"
            className="p-2 text-slate-500 hover:text-slate-800 border border-slate-200 rounded-lg hover:bg-slate-50 transition cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* KPI Status Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Baseline Card */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-4">
          <div className="flex items-center justify-between text-slate-500 text-xs mb-2">
            <span className="font-medium">Nighttime Baseline</span>
            <Droplet className="w-4 h-4 text-cyan-600" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-bold font-mono text-slate-900">
              {currentProperty.baselineFlow}
            </span>
            <span className="text-xs text-slate-500 font-mono">L/hour</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-2 flex items-center gap-1">
            <Info className="w-3 h-3 text-cyan-500" />
            <span>Monitored 01:00 - 05:00 baseline</span>
          </div>
        </div>

        {/* Current Flow Card */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-4">
          <div className="flex items-center justify-between text-slate-500 text-xs mb-2">
            <span className="font-medium">Current Water Flow</span>
            <Gauge className="w-4 h-4 text-blue-600" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-bold font-mono text-slate-900">
              {currentProperty.currentFlow}
            </span>
            <span className="text-xs text-slate-500 font-mono">L/hour</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-2 font-mono">
            Meter ID: {currentProperty.meterSerial}
          </div>
        </div>

        {/* Deviation Card */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-4">
          <div className="flex items-center justify-between text-slate-500 text-xs mb-2">
            <span className="font-medium">Flow Deviation</span>
            <span className="text-[10px] font-mono text-slate-400">vs Baseline</span>
          </div>
          <div className="flex items-baseline gap-1.5">
            {currentDeviation === null ? (
              <span className="text-lg font-bold text-slate-500">N/A</span>
            ) : (
              <span
                className={`text-2xl font-bold font-mono ${
                  isCurrentlyLeak
                    ? isSevereLeak
                      ? 'text-rose-600'
                      : 'text-amber-600'
                    : 'text-emerald-600'
                }`}
              >
                {currentDeviation > 0 ? `+${currentDeviation}%` : `${currentDeviation}%`}
              </span>
            )}
          </div>
          <div className="text-[11px] text-slate-500 mt-2">
            Threshold: <span className="font-mono font-semibold text-slate-700">+{thresholdPercent}%</span>
          </div>
        </div>

        {/* Current Leak Status Card */}
        <div
          className={`rounded-xl border shadow-xs p-4 ${
            currentProperty.baselineFlow <= 0
              ? 'bg-slate-50 border-slate-200'
              : isCurrentlyLeak
              ? isSevereLeak
                ? 'bg-rose-50 border-rose-200'
                : 'bg-amber-50 border-amber-200'
              : 'bg-emerald-50 border-emerald-200'
          }`}
        >
          <div className="flex items-center justify-between text-xs mb-2">
            <span className="font-semibold text-slate-700">Leak Status</span>
            {currentProperty.baselineFlow <= 0 ? (
              <AlertTriangle className="w-4 h-4 text-slate-500" />
            ) : isCurrentlyLeak ? (
              <ShieldAlert className="w-4 h-4 text-rose-600 animate-pulse" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            )}
          </div>

          <div className="font-bold text-sm">
            {currentProperty.baselineFlow <= 0 ? (
              <span className="text-slate-700">Insufficient Baseline</span>
            ) : isCurrentlyLeak ? (
              <span className={isSevereLeak ? 'text-rose-700' : 'text-amber-700'}>
                {isSevereLeak ? 'Possible Leak (Severe)' : 'Possible Leak Detected'}
              </span>
            ) : (
              <span className="text-emerald-700">Normal Flow</span>
            )}
          </div>

          <div className="text-[11px] text-slate-600 mt-2 line-clamp-1">
            {isCurrentlyLeak ? 'NightFlowAnomaly event published' : 'Within normal bounds'}
          </div>
        </div>
      </div>

      {/* 24-Hour Water Flow Chart */}
      <FlowChart24h
        readings={readings}
        baseline={currentProperty.baselineFlow}
        thresholdPercent={thresholdPercent}
        currentFlow={currentProperty.currentFlow}
      />

      {/* Reading Simulator */}
      <ReadingSimulator
        property={currentProperty}
        thresholdPercent={thresholdPercent}
        onThresholdChange={setThresholdPercent}
        onEvaluationComplete={handleEvaluationComplete}
        onSwitchToAnalyst={onSwitchToAnalyst}
      />
    </div>
  );
};
