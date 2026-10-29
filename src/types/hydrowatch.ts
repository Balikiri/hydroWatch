/**
 * HydroWatch Core Data Types & SOA Contracts
 */

export type PropertyId = 'HOME_A' | 'HOME_B' | 'HOME_C';

export interface PropertyMetadata {
  id: PropertyId;
  name: string;
  address: string;
  baselineFlow: number; // L/hour nighttime baseline
  currentFlow: number;  // L/hour current flow reading
  meterSerial: string;
  status: 'NORMAL' | 'POSSIBLE_LEAK' | 'SEVERE_LEAK' | 'INSUFFICIENT_BASELINE';
  lastUpdated: string;
}

export interface HourlyReading {
  hour: number;        // 0 to 23
  timeLabel: string;   // "00:00", "01:00", etc.
  flowRate: number;    // L/hour
  baseline: number;    // L/hour
  thresholdFlow: number; // baseline * (1 + threshold/100)
  isPeak?: boolean;
  isCurrent?: boolean;
  isAnomaly?: boolean;
}

export type CaseStatus = 'OPEN' | 'UNDER_INVESTIGATION' | 'RESOLVED';
export type CaseSeverity = 'NORMAL' | 'MODERATE' | 'SEVERE';

export interface InvestigationCase {
  id: string;              // e.g. "CASE-2026-001"
  propertyId: PropertyId;
  propertyName: string;
  baselineFlow: number;
  observedFlow: number;
  deviationPercent: number;
  thresholdPercent: number;
  severity: CaseSeverity;
  status: CaseStatus;
  createdAt: string;
  updatedAt: string;
  notes?: string;
  eventId: string;
  auditTrail: {
    timestamp: string;
    action: string;
    notes?: string;
  }[];
}

export interface NightFlowAnomalyEvent {
  eventId: string;
  topic: 'soa.s10.t02.events';
  eventType: 'NightFlowAnomalyDetected';
  propertyId: PropertyId;
  propertyName: string;
  baselineFlow: number;
  observedFlow: number;
  deviationPercent: number;
  thresholdPercent: number;
  severity: CaseSeverity;
  timestamp: string;
  meterSerial: string;
}

export interface EvaluationResult {
  propertyId: PropertyId;
  propertyName: string;
  currentFlow: number;
  baselineFlow: number;
  deviationPercent: number | null;
  thresholdPercent: number;
  status: 'NORMAL_FLOW' | 'POSSIBLE_LEAK' | 'SEVERE_LEAK' | 'INSUFFICIENT_BASELINE';
  statusLabel: string;
  isLeak: boolean;
  severity: CaseSeverity;
  eventPublished: boolean;
  caseCreated: boolean;
  caseId?: string;
  timestamp: string;
  message: string;
  formulaString: string;
}

export interface SystemServiceStatus {
  name: string;
  serviceId: string;
  type: 'Spring Boot' | 'Kafka Topic' | 'Eureka Service Discovery' | 'JPA Persistence' | 'Express Gateway';
  status: 'UP' | 'DOWN' | 'DEGRADED';
  port?: number;
  details: string;
  lastHeartbeat: string;
}
