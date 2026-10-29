/**
 * Sample Data for HydroWatch demonstration
 * Clearly identified synthetic data for Home A, Home B, and Home C
 */

import { HourlyReading, InvestigationCase, PropertyMetadata } from '../types/hydrowatch';

export const SAMPLE_PROPERTIES: PropertyMetadata[] = [
  {
    id: 'HOME_A',
    name: 'Home A (24 Elmwood Crescent)',
    address: '24 Elmwood Crescent, Maple District',
    baselineFlow: 10, // 10 L/hour nighttime baseline
    currentFlow: 8,   // 8 L/hour (matches Test A: Normal Flow, -20%)
    meterSerial: 'MTR-ELM-9021',
    status: 'NORMAL',
    lastUpdated: 'Just now',
  },
  {
    id: 'HOME_B',
    name: 'Home B (88 Willow Valley Lane)',
    address: '88 Willow Valley Lane, Riverview',
    baselineFlow: 30, // 30 L/hour baseline
    currentFlow: 35,  // 35 L/hour (matches Test D: Normal Flow, +16.67%)
    meterSerial: 'MTR-WLV-4412',
    status: 'NORMAL',
    lastUpdated: '1 min ago',
  },
  {
    id: 'HOME_C',
    name: 'Home C (102 Clearwater Blvd)',
    address: '102 Clearwater Blvd, Lakefront Heights',
    baselineFlow: 15, // 15 L/hour baseline
    currentFlow: 22,  // 22 L/hour (+46.7%, within +55% threshold)
    meterSerial: 'MTR-CLW-8830',
    status: 'NORMAL',
    lastUpdated: '3 mins ago',
  },
];

/**
 * Generate 24-hour flow history (00:00 to 23:00)
 * Baseline is shown as reference line, threshold is shown as upper limit line (+55% default)
 */
export function generate24HourReadings(
  baseline: number,
  currentFlow: number,
  thresholdPercent: number = 55
): HourlyReading[] {
  const thresholdFactor = 1 + thresholdPercent / 100;
  const thresholdFlow = Math.round(baseline * thresholdFactor * 10) / 10;
  const currentHour = new Date().getHours();

  const pattern = [
    // 00:00 - 05:00 Nighttime baseline window
    0.9, 0.8, 0.85, 0.8, 0.95, 1.1,
    // 06:00 - 09:00 Morning peak (showers, breakfast, watering)
    2.4, 4.8, 5.2, 3.1,
    // 10:00 - 16:00 Daytime lull / low usage
    1.4, 1.2, 1.8, 1.3, 1.1, 1.5, 1.7,
    // 17:00 - 21:00 Evening peak (dinner, dishwasher, laundry)
    3.2, 5.6, 4.9, 3.8, 2.2,
    // 22:00 - 23:00 Night settling
    1.4, 1.0,
  ];

  return pattern.map((mult, h) => {
    const isCurrent = h === currentHour;
    // For current hour, use actual currentFlow
    let flow = isCurrent ? currentFlow : Math.round(baseline * mult * 10) / 10;
    
    // Distinguish historical peaks (e.g. morning 08:00 and evening 18:00)
    const isPeak = !isCurrent && (h === 7 || h === 8 || h === 18);
    // Is anomaly if during baseline monitoring window (e.g., 01:00 - 05:00) it breached threshold, or if current breaches threshold
    const isAnomaly = flow > thresholdFlow;

    return {
      hour: h,
      timeLabel: `${h.toString().padStart(2, '0')}:00`,
      flowRate: flow,
      baseline,
      thresholdFlow,
      isPeak,
      isCurrent,
      isAnomaly,
    };
  });
}

export const INITIAL_INVESTIGATION_CASES: InvestigationCase[] = [
  {
    id: 'CASE-2026-089',
    propertyId: 'HOME_A',
    propertyName: 'Home A (24 Elmwood Crescent)',
    baselineFlow: 10,
    observedFlow: 24,
    deviationPercent: 140.0,
    thresholdPercent: 55,
    severity: 'MODERATE',
    status: 'RESOLVED',
    createdAt: new Date(Date.now() - 3600000 * 26).toISOString(),
    updatedAt: new Date(Date.now() - 3600000 * 4).toISOString(),
    notes: 'Resident inspected outdoor garden spigot valve. Valve re-seated; night baseline restored to 10 L/h.',
    eventId: 'EVT-9021-089',
    auditTrail: [
      {
        timestamp: new Date(Date.now() - 3600000 * 26).toISOString(),
        action: 'Case Created by Kafka Consumer (NightFlowAnomalyDetected)',
      },
      {
        timestamp: new Date(Date.now() - 3600000 * 18).toISOString(),
        action: 'Status changed to UNDER_INVESTIGATION by Utility Ops',
        notes: 'Dispatched automated resident SMS alert',
      },
      {
        timestamp: new Date(Date.now() - 3600000 * 4).toISOString(),
        action: 'Status marked RESOLVED by Utility Ops',
        notes: 'Resident confirmed faulty hose connector fixed',
      },
    ],
  },
  {
    id: 'CASE-2026-092',
    propertyId: 'HOME_B',
    propertyName: 'Home B (88 Willow Valley Lane)',
    baselineFlow: 30,
    observedFlow: 68,
    deviationPercent: 126.67,
    thresholdPercent: 55,
    severity: 'MODERATE',
    status: 'UNDER_INVESTIGATION',
    createdAt: new Date(Date.now() - 3600000 * 6).toISOString(),
    updatedAt: new Date(Date.now() - 3600000 * 2).toISOString(),
    notes: 'Acoustic leak sensor detected possible flapper valve continuous trickle on second floor.',
    eventId: 'EVT-4412-092',
    auditTrail: [
      {
        timestamp: new Date(Date.now() - 3600000 * 6).toISOString(),
        action: 'Case Created by Kafka Consumer (NightFlowAnomalyDetected)',
      },
      {
        timestamp: new Date(Date.now() - 3600000 * 2).toISOString(),
        action: 'Status changed to UNDER_INVESTIGATION by Utility Ops',
        notes: 'Acoustic survey requested',
      },
    ],
  },
];
