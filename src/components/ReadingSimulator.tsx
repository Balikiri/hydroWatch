import React, { useState } from 'react';
import { EvaluationResult, PropertyMetadata } from '../types/hydrowatch';
import { Play, CheckCircle2, AlertOctagon, AlertTriangle, ArrowRight, Activity, Sliders, Radio } from 'lucide-react';

interface ReadingSimulatorProps {
  property: PropertyMetadata;
  thresholdPercent: number;
  onThresholdChange: (threshold: number) => void;
  onEvaluationComplete: (result: EvaluationResult) => void;
  onSwitchToAnalyst: () => void;
}

export const ReadingSimulator: React.FC<ReadingSimulatorProps> = ({
  property,
  thresholdPercent,
  onThresholdChange,
  onEvaluationComplete,
  onSwitchToAnalyst,
}) => {
  const [flowInput, setFlowInput] = useState<number>(property.currentFlow);
  const [evaluating, setEvaluating] = useState<boolean>(false);
  const [latestResult, setLatestResult] = useState<EvaluationResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Sync flowInput when selected property changes
  React.useEffect(() => {
    setFlowInput(property.currentFlow);
    setLatestResult(null);
    setErrorMessage(null);
  }, [property.id, property.currentFlow]);

  // Presets based on required test scenarios
  const applyPreset = (type: 'NORMAL' | 'POSSIBLE' | 'SEVERE') => {
    let presetFlow = property.baselineFlow;
    if (type === 'NORMAL') {
      // Test A for Home A: 8 L/h (-20%), or 35 L/h for Home B (+16.67%)
      presetFlow = property.id === 'HOME_B' ? 35 : Math.max(1, Math.round(property.baselineFlow * 0.8));
    } else if (type === 'POSSIBLE') {
      // Test B for Home A: 17 L/h (+70%)
      presetFlow = property.id === 'HOME_A' ? 17 : Math.round(property.baselineFlow * 1.7);
    } else if (type === 'SEVERE') {
      // Test C for Home A: 40 L/h (+300%)
      presetFlow = property.id === 'HOME_A' ? 40 : Math.round(property.baselineFlow * 3.5);
    }
    setFlowInput(presetFlow);
  };

  const handleSimulate = async () => {
    setEvaluating(true);
    setErrorMessage(null);

    try {
      // Attempt backend evaluation
      const response = await fetch('/api/baseline/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          propertyId: property.id,
          currentFlow: Number(flowInput),
          thresholdPercent: Number(thresholdPercent),
        }),
      });

      if (!response.ok) {
        throw new Error(`Backend evaluation failed with HTTP status ${response.status}: ${response.statusText}`);
      }

      const result: EvaluationResult = await response.json();
      setLatestResult(result);
      onEvaluationComplete(result);
    } catch (err: any) {
      console.error('Evaluation request error:', err);
      // Strictly follow rule: "Never show a successful result if the request failed."
      setErrorMessage(
        `Evaluation failed: ${err.message || 'Unable to communicate with Baseline Service'}. Please check network or backend status.`
      );
      setLatestResult(null);
    } finally {
      setEvaluating(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5">
      <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
            <Activity className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-900 text-base">Reading Simulator & Evaluation Engine</h3>
            <p className="text-xs text-slate-500">
              Submit simulated meter telemetry to test baseline anomaly detection and automated SOA event routing.
            </p>
          </div>
        </div>

        <span className="text-xs font-mono font-medium text-slate-500 bg-slate-100 px-2.5 py-1 rounded-md">
          {property.name.split(' ')[0]} {property.name.split(' ')[1]}
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Controls Column */}
        <div className="lg:col-span-7 space-y-4">
          {/* Preset Buttons */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
              Simulation Presets
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => applyPreset('NORMAL')}
                className="flex flex-col items-center justify-center p-2.5 rounded-lg border border-emerald-200 bg-emerald-50/60 hover:bg-emerald-100/70 text-emerald-900 transition text-center cursor-pointer"
              >
                <span className="text-xs font-semibold">Normal Flow</span>
                <span className="text-[11px] text-emerald-700 font-mono mt-0.5">
                  {property.id === 'HOME_B' ? '35 L/h (+16.7%)' : '8 L/h (-20%)'}
                </span>
                <span className="text-[10px] text-emerald-600 mt-1">Test A / Test D</span>
              </button>

              <button
                type="button"
                onClick={() => applyPreset('POSSIBLE')}
                className="flex flex-col items-center justify-center p-2.5 rounded-lg border border-amber-200 bg-amber-50/60 hover:bg-amber-100/70 text-amber-900 transition text-center cursor-pointer"
              >
                <span className="text-xs font-semibold">Possible Leak</span>
                <span className="text-[11px] text-amber-700 font-mono mt-0.5">
                  {property.id === 'HOME_A' ? '17 L/h (+70%)' : `${Math.round(property.baselineFlow * 1.7)} L/h`}
                </span>
                <span className="text-[10px] text-amber-600 mt-1">Test B</span>
              </button>

              <button
                type="button"
                onClick={() => applyPreset('SEVERE')}
                className="flex flex-col items-center justify-center p-2.5 rounded-lg border border-rose-200 bg-rose-50/60 hover:bg-rose-100/70 text-rose-900 transition text-center cursor-pointer"
              >
                <span className="text-xs font-semibold">Severe Leak</span>
                <span className="text-[11px] text-rose-700 font-mono mt-0.5">
                  {property.id === 'HOME_A' ? '40 L/h (+300%)' : `${Math.round(property.baselineFlow * 3.5)} L/h`}
                </span>
                <span className="text-[10px] text-rose-600 mt-1">Test C</span>
              </button>
            </div>
          </div>

          {/* Editable Flow Input */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Simulated Water Flow (L/hour)
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="0"
                  max="500"
                  step="0.5"
                  value={flowInput}
                  onChange={(e) => setFlowInput(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 font-mono text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
                <span className="text-xs font-semibold text-slate-500 font-mono">L/h</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Baseline reference: <strong className="text-slate-700 font-mono">{property.baselineFlow} L/h</strong>
              </p>
            </div>

            {/* Threshold Slider */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                  <Sliders className="w-3.5 h-3.5 text-slate-400" />
                  Anomaly Threshold
                </label>
                <span className="text-xs font-bold font-mono text-blue-700 bg-blue-50 px-2 py-0.5 rounded">
                  +{thresholdPercent}%
                </span>
              </div>
              <input
                type="range"
                min="10"
                max="150"
                step="5"
                value={thresholdPercent}
                onChange={(e) => onThresholdChange(parseInt(e.target.value, 10))}
                className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
              />
              <div className="flex justify-between text-[10px] text-slate-400 mt-1 font-mono">
                <span>+10% (Strict)</span>
                <span className="text-blue-600 font-medium">Default: +55%</span>
                <span>+150% (Lenient)</span>
              </div>
            </div>
          </div>

          {/* Action Button */}
          <button
            type="button"
            onClick={handleSimulate}
            disabled={evaluating}
            className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white font-medium py-2.5 px-4 rounded-lg transition shadow-xs cursor-pointer"
          >
            {evaluating ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>Evaluating via Baseline Service...</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-white" />
                <span>Simulate Reading &amp; Evaluate</span>
              </>
            )}
          </button>
        </div>

        {/* Live Evaluation Result Column */}
        <div className="lg:col-span-5 bg-slate-50 rounded-lg p-4 border border-slate-200/80 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-200">
              <span className="text-xs font-semibold text-slate-600 uppercase tracking-wider">
                Evaluation Output
              </span>
              <span className="text-[10px] font-mono text-slate-400">
                Rule: Dev &gt; Threshold
              </span>
            </div>

            {/* Error state */}
            {errorMessage && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 text-xs">
                <div className="flex items-center gap-1.5 font-semibold mb-1">
                  <AlertOctagon className="w-4 h-4 text-rose-600" />
                  Service Request Error
                </div>
                <p>{errorMessage}</p>
              </div>
            )}

            {/* Empty initial state */}
            {!errorMessage && !latestResult && (
              <div className="py-6 text-center text-slate-400 text-xs">
                <Activity className="w-8 h-8 mx-auto mb-2 text-slate-300 stroke-1" />
                Select a preset or enter a flow rate, then click <strong>Simulate Reading &amp; Evaluate</strong> to run the Baseline Service algorithm.
              </div>
            )}

            {/* Result display */}
            {latestResult && (
              <div className="space-y-3">
                {/* Status Header */}
                <div
                  className={`p-3 rounded-lg border ${
                    latestResult.status === 'INSUFFICIENT_BASELINE'
                      ? 'bg-slate-100 border-slate-300 text-slate-700'
                      : latestResult.isLeak
                      ? latestResult.severity === 'SEVERE'
                        ? 'bg-rose-50 border-rose-300 text-rose-900'
                        : 'bg-amber-50 border-amber-300 text-amber-900'
                      : 'bg-emerald-50 border-emerald-300 text-emerald-900'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {latestResult.status === 'INSUFFICIENT_BASELINE' ? (
                      <AlertTriangle className="w-5 h-5 text-slate-500" />
                    ) : latestResult.isLeak ? (
                      <AlertOctagon className="w-5 h-5 text-rose-600 animate-bounce" />
                    ) : (
                      <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    )}
                    <div>
                      <div className="font-bold text-sm">{latestResult.statusLabel}</div>
                      <div className="text-[11px] opacity-90">{latestResult.message}</div>
                    </div>
                  </div>
                </div>

                {/* Mathematical Formula Breakdown */}
                <div className="bg-white p-3 rounded-lg border border-slate-200 text-xs">
                  <div className="text-[11px] text-slate-500 font-medium mb-1">
                    Evaluated Mathematical Formula:
                  </div>
                  <div className="font-mono text-xs bg-slate-100 p-2 rounded text-slate-800 break-all font-semibold">
                    {latestResult.formulaString}
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] text-slate-600">
                    <div>
                      Baseline: <strong className="font-mono text-slate-900">{latestResult.baselineFlow} L/h</strong>
                    </div>
                    <div>
                      Observed: <strong className="font-mono text-slate-900">{latestResult.currentFlow} L/h</strong>
                    </div>
                    <div>
                      Deviation:{' '}
                      <strong className={`font-mono ${latestResult.isLeak ? 'text-rose-600' : 'text-emerald-600'}`}>
                        {latestResult.deviationPercent !== null ? `${latestResult.deviationPercent > 0 ? '+' : ''}${latestResult.deviationPercent}%` : 'N/A'}
                      </strong>
                    </div>
                    <div>
                      Threshold: <strong className="font-mono text-slate-900">+{latestResult.thresholdPercent}%</strong>
                    </div>
                  </div>
                </div>

                {/* Kafka & Case Notification info */}
                {latestResult.isLeak && (
                  <div className="bg-blue-50 border border-blue-200 p-2.5 rounded-lg text-xs space-y-1.5">
                    <div className="flex items-center gap-1.5 font-semibold text-blue-900 text-[11px]">
                      <Radio className="w-3.5 h-3.5 text-blue-600 animate-pulse" />
                      Kafka Event Dispatched: <code className="font-mono text-[10px] bg-blue-100 px-1 rounded">soa.s10.t02.events</code>
                    </div>
                    {latestResult.caseId && (
                      <div className="text-[11px] text-blue-800">
                        Investigation Case Created:{' '}
                        <span className="font-mono font-bold text-blue-900 bg-white px-1.5 py-0.5 rounded border border-blue-200">
                          {latestResult.caseId}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Quick link to switch to analyst if case was created */}
          {latestResult?.isLeak && latestResult.caseId && (
            <button
              type="button"
              onClick={onSwitchToAnalyst}
              className="mt-3 flex items-center justify-center gap-1.5 text-xs text-blue-700 hover:text-blue-900 font-semibold bg-blue-100/80 hover:bg-blue-200/80 py-2 px-3 rounded-lg transition cursor-pointer"
            >
              <span>View Case in Utility Analyst Dashboard</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
