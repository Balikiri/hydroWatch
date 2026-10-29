/**
 * HydroWatch Leak Detection Engine
 * 
 * Formula:
 * When Baseline > 0:
 *   Deviation (%) = ((Current Flow - Baseline) / Baseline) * 100
 * 
 * Anomaly Rule:
 *   If Deviation (%) > Threshold (%):
 *     Suspected Leak (Possible Leak Detected or Severe Leak Detected)
 *   Else:
 *     Normal Flow
 * 
 * Edge Case:
 *   If Baseline is missing, zero, or <= 0:
 *     "Insufficient Baseline Data" (prevent division by zero)
 */

import { CaseSeverity, EvaluationResult, PropertyId } from '../types/hydrowatch';

export interface EvaluateInput {
  propertyId: PropertyId;
  propertyName?: string;
  currentFlow: number;
  baselineFlow: number | null | undefined;
  thresholdPercent?: number; // Defaults to 55%
}

export function evaluateLeakCondition(input: EvaluateInput): EvaluationResult {
  const threshold = input.thresholdPercent ?? 55;
  const currentFlow = Number(input.currentFlow);
  const baseline = input.baselineFlow != null ? Number(input.baselineFlow) : null;
  const propertyName = input.propertyName || input.propertyId;
  const timestamp = new Date().toISOString();

  // Validate baseline data (avoid division by zero or NaN)
  if (baseline === null || isNaN(baseline) || baseline <= 0) {
    return {
      propertyId: input.propertyId,
      propertyName,
      currentFlow,
      baselineFlow: baseline ?? 0,
      deviationPercent: null,
      thresholdPercent: threshold,
      status: 'INSUFFICIENT_BASELINE',
      statusLabel: 'Insufficient Baseline Data',
      isLeak: false,
      severity: 'NORMAL',
      eventPublished: false,
      caseCreated: false,
      timestamp,
      message: 'Baseline data is missing, zero, or insufficient. Nighttime meter readings required to establish baseline.',
      formulaString: 'Baseline <= 0 L/h (Division by zero prevented)',
    };
  }

  // Calculate percentage deviation
  const deviation = ((currentFlow - baseline) / baseline) * 100;
  // Round to 2 decimal places for precision
  const roundedDeviation = Math.round(deviation * 100) / 100;

  const isLeak = roundedDeviation > threshold;

  let status: 'NORMAL_FLOW' | 'POSSIBLE_LEAK' | 'SEVERE_LEAK' = 'NORMAL_FLOW';
  let statusLabel = 'Normal Flow';
  let severity: CaseSeverity = 'NORMAL';

  if (isLeak) {
    // If deviation exceeds 150%, flag as severe leak
    if (roundedDeviation >= 150) {
      status = 'SEVERE_LEAK';
      statusLabel = 'Possible Leak Detected (Severe)';
      severity = 'SEVERE';
    } else {
      status = 'POSSIBLE_LEAK';
      statusLabel = 'Possible Leak Detected';
      severity = 'MODERATE';
    }
  }

  const sign = roundedDeviation > 0 ? '+' : '';
  const formulaString = `((${currentFlow} - ${baseline}) / ${baseline}) × 100 = ${sign}${roundedDeviation}% vs Threshold ${threshold}%`;

  return {
    propertyId: input.propertyId,
    propertyName,
    currentFlow,
    baselineFlow: baseline,
    deviationPercent: roundedDeviation,
    thresholdPercent: threshold,
    status,
    statusLabel,
    isLeak,
    severity,
    eventPublished: isLeak,
    caseCreated: isLeak,
    timestamp,
    message: isLeak
      ? `Flow deviation of ${sign}${roundedDeviation}% exceeds the +${threshold}% anomaly threshold.`
      : `Flow deviation of ${sign}${roundedDeviation}% is within acceptable nighttime parameters (<= +${threshold}%).`,
    formulaString,
  };
}
