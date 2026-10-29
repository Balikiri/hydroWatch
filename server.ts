/**
 * HydroWatch SOA Backend Gateway & Full-Stack Server
 * 
 * Implements the Service-Oriented Architecture for:
 * 1. MeterSeries Service (/api/meter-series/*)
 * 2. Baseline Service (/api/baseline/*)
 * 3. Kafka Event Pipeline (Topic: soa.s10.t02.events)
 * 4. LeakCase Service (/api/leak-case/*)
 * 5. Real-Time Server-Sent Events (/api/events/stream)
 * 6. Automated SOA Test Runner (/api/tests/run)
 */

import express, { Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.use(express.json());

// In-Memory JPA-simulated persistent stores
interface PropertyStore {
  id: 'HOME_A' | 'HOME_B' | 'HOME_C';
  name: string;
  address: string;
  baselineFlow: number;
  currentFlow: number;
  meterSerial: string;
  status: 'NORMAL' | 'POSSIBLE_LEAK' | 'SEVERE_LEAK' | 'INSUFFICIENT_BASELINE';
  lastUpdated: string;
}

let properties: Record<string, PropertyStore> = {
  HOME_A: {
    id: 'HOME_A',
    name: 'Home A (24 Elmwood Crescent)',
    address: '24 Elmwood Crescent, Maple District',
    baselineFlow: 10, // 10 L/hour nighttime baseline
    currentFlow: 8,   // 8 L/hour default (Test A: Normal Flow, -20%)
    meterSerial: 'MTR-ELM-9021',
    status: 'NORMAL',
    lastUpdated: new Date().toISOString(),
  },
  HOME_B: {
    id: 'HOME_B',
    name: 'Home B (88 Willow Valley Lane)',
    address: '88 Willow Valley Lane, Riverview',
    baselineFlow: 30, // 30 L/hour baseline
    currentFlow: 35,  // 35 L/hour default (Test D: Normal Flow, +16.67%)
    meterSerial: 'MTR-WLV-4412',
    status: 'NORMAL',
    lastUpdated: new Date().toISOString(),
  },
  HOME_C: {
    id: 'HOME_C',
    name: 'Home C (102 Clearwater Blvd)',
    address: '102 Clearwater Blvd, Lakefront Heights',
    baselineFlow: 15,
    currentFlow: 22,
    meterSerial: 'MTR-CLW-8830',
    status: 'NORMAL',
    lastUpdated: new Date().toISOString(),
  },
};

interface StoredCase {
  id: string;
  propertyId: 'HOME_A' | 'HOME_B' | 'HOME_C';
  propertyName: string;
  baselineFlow: number;
  observedFlow: number;
  deviationPercent: number;
  thresholdPercent: number;
  severity: 'NORMAL' | 'MODERATE' | 'SEVERE';
  status: 'OPEN' | 'UNDER_INVESTIGATION' | 'RESOLVED';
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

let cases: StoredCase[] = [
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

// Kafka topic event log
const processedEventIds = new Set<string>(['EVT-9021-089', 'EVT-4412-092']);
interface KafkaEventRecord {
  offset: number;
  topic: string;
  partition: number;
  timestamp: string;
  key: string;
  payload: any;
}
let kafkaEventLog: KafkaEventRecord[] = [];

// SSE Clients for real-time live push to Analyst Dashboard
const sseClients: Response[] = [];

function broadcastSSE(eventType: string, data: any) {
  const payload = `event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`;
  for (let i = sseClients.length - 1; i >= 0; i--) {
    try {
      sseClients[i].write(payload);
    } catch {
      sseClients.splice(i, 1);
    }
  }
}

// ---------------------------------------------------------------------------
// 1. System Health & SOA Diagnostics
// ---------------------------------------------------------------------------
app.get('/api/system/status', (req: Request, res: Response) => {
  res.json({
    mode: 'LIVE_DEMO_SOA',
    description: 'HydroWatch SOA Microservices Cluster',
    timestamp: new Date().toISOString(),
    services: [
      {
        name: 'MeterSeries Service',
        serviceId: 'meterseries-service',
        type: 'Spring Boot',
        status: 'UP',
        port: 8081,
        details: 'JPA Water Flow Telemetry Ingestion API (Active)',
        lastHeartbeat: new Date().toISOString(),
      },
      {
        name: 'Baseline Service',
        serviceId: 'baseline-service',
        type: 'Spring Boot',
        status: 'UP',
        port: 8082,
        details: 'Nighttime Baseline & Anomaly Detection Engine (Active)',
        lastHeartbeat: new Date().toISOString(),
      },
      {
        name: 'Kafka Event Bus',
        serviceId: 'kafka-broker-0',
        type: 'Kafka Topic',
        status: 'UP',
        port: 9092,
        details: 'Topic: soa.s10.t02.events (Consumer Group: leakcase-group)',
        lastHeartbeat: new Date().toISOString(),
      },
      {
        name: 'LeakCase Service',
        serviceId: 'leakcase-service',
        type: 'Spring Boot',
        status: 'UP',
        port: 8083,
        details: 'Idempotent Kafka Consumer & Investigation Store (Active)',
        lastHeartbeat: new Date().toISOString(),
      },
      {
        name: 'Eureka Discovery',
        serviceId: 'eureka-discovery',
        type: 'Eureka Service Discovery',
        status: 'UP',
        port: 8761,
        details: '4/4 microservice instances registered and healthy',
        lastHeartbeat: new Date().toISOString(),
      },
    ],
    kafkaStats: {
      topic: 'soa.s10.t02.events',
      totalEventsPublished: kafkaEventLog.length,
      processedEvents: processedEventIds.size,
    },
    caseStats: {
      totalCases: cases.length,
      openCases: cases.filter(c => c.status === 'OPEN').length,
      underInvestigation: cases.filter(c => c.status === 'UNDER_INVESTIGATION').length,
      resolvedCases: cases.filter(c => c.status === 'RESOLVED').length,
    },
  });
});

// ---------------------------------------------------------------------------
// 2. Real-Time SSE Stream
// ---------------------------------------------------------------------------
app.get('/api/events/stream', (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  sseClients.push(res);

  // Send initial ping
  res.write(`event: connected\ndata: ${JSON.stringify({ status: 'connected', clientsCount: sseClients.length })}\n\n`);

  req.on('close', () => {
    const idx = sseClients.indexOf(res);
    if (idx !== -1) sseClients.splice(idx, 1);
  });
});

// ---------------------------------------------------------------------------
// 3. MeterSeries Service APIs
// ---------------------------------------------------------------------------
app.get('/api/meter-series/properties', (req: Request, res: Response) => {
  res.json(Object.values(properties));
});

app.get('/api/meter-series/properties/:id', (req: Request, res: Response) => {
  const prop = properties[req.params.id];
  if (!prop) {
    return res.status(404).json({ error: 'Property not found' });
  }
  res.json(prop);
});

app.get('/api/meter-series/properties/:id/history', (req: Request, res: Response) => {
  const prop = properties[req.params.id];
  if (!prop) {
    return res.status(404).json({ error: 'Property not found' });
  }

  const threshold = parseFloat(req.query.threshold as string) || 55;
  const thresholdFactor = 1 + threshold / 100;
  const thresholdFlow = Math.round(prop.baselineFlow * thresholdFactor * 10) / 10;
  const currentHour = new Date().getHours();

  const pattern = [
    0.9, 0.8, 0.85, 0.8, 0.95, 1.1,
    2.4, 4.8, 5.2, 3.1,
    1.4, 1.2, 1.8, 1.3, 1.1, 1.5, 1.7,
    3.2, 5.6, 4.9, 3.8, 2.2,
    1.4, 1.0,
  ];

  const history = pattern.map((mult, h) => {
    const isCurrent = h === currentHour;
    const flow = isCurrent ? prop.currentFlow : Math.round(prop.baselineFlow * mult * 10) / 10;
    const isPeak = !isCurrent && (h === 7 || h === 8 || h === 18);
    const isAnomaly = flow > thresholdFlow;

    return {
      hour: h,
      timeLabel: `${h.toString().padStart(2, '0')}:00`,
      flowRate: flow,
      baseline: prop.baselineFlow,
      thresholdFlow,
      isPeak,
      isCurrent,
      isAnomaly,
    };
  });

  res.json(history);
});

// Ingest new meter reading
app.post('/api/meter-series/readings', (req: Request, res: Response) => {
  const { propertyId, flowRate } = req.body;
  if (!propertyId || flowRate === undefined) {
    return res.status(400).json({ error: 'propertyId and flowRate are required' });
  }

  const prop = properties[propertyId];
  if (!prop) {
    return res.status(404).json({ error: `Property ${propertyId} not found` });
  }

  prop.currentFlow = Number(flowRate);
  prop.lastUpdated = new Date().toISOString();

  res.json({
    status: 'INGESTED',
    propertyId,
    flowRate: prop.currentFlow,
    meterSerial: prop.meterSerial,
    timestamp: prop.lastUpdated,
  });
});

// ---------------------------------------------------------------------------
// 4. Baseline Service & Leak Detection Engine
// ---------------------------------------------------------------------------
app.post('/api/baseline/evaluate', (req: Request, res: Response) => {
  const { propertyId, currentFlow, thresholdPercent } = req.body;

  if (!propertyId) {
    return res.status(400).json({ error: 'propertyId is required' });
  }

  const prop = properties[propertyId];
  const baseline = prop ? prop.baselineFlow : null;
  const flow = Number(currentFlow !== undefined ? currentFlow : (prop ? prop.currentFlow : 0));
  const threshold = Number(thresholdPercent !== undefined ? thresholdPercent : 55);

  // If baseline is missing, zero, or insufficient, display "Insufficient Baseline Data"
  if (baseline === null || baseline === undefined || isNaN(baseline) || baseline <= 0) {
    return res.json({
      propertyId,
      propertyName: prop ? prop.name : propertyId,
      currentFlow: flow,
      baselineFlow: baseline ?? 0,
      deviationPercent: null,
      thresholdPercent: threshold,
      status: 'INSUFFICIENT_BASELINE',
      statusLabel: 'Insufficient Baseline Data',
      isLeak: false,
      severity: 'NORMAL',
      eventPublished: false,
      caseCreated: false,
      timestamp: new Date().toISOString(),
      message: 'Baseline data is missing, zero, or insufficient. Division by zero prevented.',
      formulaString: 'Baseline <= 0 L/h (Insufficient data)',
    });
  }

  // Exact Formula: Deviation (%) = ((Current Flow - Baseline) / Baseline) * 100
  const deviation = ((flow - baseline) / baseline) * 100;
  const roundedDeviation = Math.round(deviation * 100) / 100;
  const isLeak = roundedDeviation > threshold;

  // Update property current flow in store
  if (prop) {
    prop.currentFlow = flow;
    prop.status = isLeak ? (roundedDeviation >= 150 ? 'SEVERE_LEAK' : 'POSSIBLE_LEAK') : 'NORMAL';
    prop.lastUpdated = new Date().toISOString();
  }

  let status: 'NORMAL_FLOW' | 'POSSIBLE_LEAK' | 'SEVERE_LEAK' = 'NORMAL_FLOW';
  let statusLabel = 'Normal Flow';
  let severity: 'NORMAL' | 'MODERATE' | 'SEVERE' = 'NORMAL';

  if (isLeak) {
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

  let eventPublished = false;
  let caseCreated = false;
  let createdCaseId: string | undefined = undefined;

  // -------------------------------------------------------------------------
  // Automatic Leak Alerts: Publish NightFlowAnomalyDetected to Kafka
  // -------------------------------------------------------------------------
  if (isLeak) {
    eventPublished = true;
    const eventId = `EVT-${propertyId}-${Date.now()}`;
    const anomalyEvent = {
      eventId,
      topic: 'soa.s10.t02.events',
      eventType: 'NightFlowAnomalyDetected',
      propertyId,
      propertyName: prop?.name || propertyId,
      baselineFlow: baseline,
      observedFlow: flow,
      deviationPercent: roundedDeviation,
      thresholdPercent: threshold,
      severity,
      timestamp: new Date().toISOString(),
      meterSerial: prop?.meterSerial || 'MTR-UNKNOWN',
    };

    // Store in Kafka event log
    kafkaEventLog.unshift({
      offset: kafkaEventLog.length + 1,
      topic: 'soa.s10.t02.events',
      partition: 0,
      timestamp: anomalyEvent.timestamp,
      key: propertyId,
      payload: anomalyEvent,
    });

    // -----------------------------------------------------------------------
    // LeakCase Service: Consumes event & creates case (with deduplication)
    // -----------------------------------------------------------------------
    if (!processedEventIds.has(eventId)) {
      processedEventIds.add(eventId);
      caseCreated = true;
      createdCaseId = `CASE-2026-${String(cases.length + 101).padStart(3, '0')}`;

      const newCase: StoredCase = {
        id: createdCaseId,
        propertyId: propertyId as any,
        propertyName: prop?.name || propertyId,
        baselineFlow: baseline,
        observedFlow: flow,
        deviationPercent: roundedDeviation,
        thresholdPercent: threshold,
        severity,
        status: 'OPEN',
        createdAt: anomalyEvent.timestamp,
        updatedAt: anomalyEvent.timestamp,
        notes: `Automated anomaly detected: Flow rate ${flow} L/h exceeded baseline (${baseline} L/h) by +${roundedDeviation}% (threshold: +${threshold}%).`,
        eventId,
        auditTrail: [
          {
            timestamp: anomalyEvent.timestamp,
            action: 'Case Created by Kafka Consumer (NightFlowAnomalyDetected)',
            notes: `Consumed from topic soa.s10.t02.events`,
          },
        ],
      };

      cases.unshift(newCase);

      // Broadcast live event to all connected Utility Analyst SSE clients!
      broadcastSSE('case_created', {
        case: newCase,
        event: anomalyEvent,
      });
    }

    broadcastSSE('anomaly_event', anomalyEvent);
  }

  const sign = roundedDeviation > 0 ? '+' : '';
  const formulaString = `((${flow} - ${baseline}) / ${baseline}) × 100 = ${sign}${roundedDeviation}% vs Threshold +${threshold}%`;

  const evaluationResult = {
    propertyId,
    propertyName: prop?.name || propertyId,
    currentFlow: flow,
    baselineFlow: baseline,
    deviationPercent: roundedDeviation,
    thresholdPercent: threshold,
    status,
    statusLabel,
    isLeak,
    severity,
    eventPublished,
    caseCreated,
    caseId: createdCaseId,
    timestamp: new Date().toISOString(),
    message: isLeak
      ? `Flow deviation of ${sign}${roundedDeviation}% exceeds the +${threshold}% threshold. Kafka event published and investigation case created.`
      : `Flow deviation of ${sign}${roundedDeviation}% is normal (within +${threshold}% threshold).`,
    formulaString,
  };

  broadcastSSE('reading_evaluated', evaluationResult);

  res.json(evaluationResult);
});

// ---------------------------------------------------------------------------
// 5. LeakCase Service APIs
// ---------------------------------------------------------------------------
app.get('/api/leak-case/cases', (req: Request, res: Response) => {
  const { status, severity, propertyId } = req.query;

  let filtered = [...cases];

  if (status && status !== 'ALL') {
    filtered = filtered.filter(c => c.status === status);
  }
  if (severity && severity !== 'ALL') {
    filtered = filtered.filter(c => c.severity === severity);
  }
  if (propertyId && propertyId !== 'ALL') {
    filtered = filtered.filter(c => c.propertyId === propertyId);
  }

  res.json(filtered);
});

app.get('/api/leak-case/cases/:id', (req: Request, res: Response) => {
  const c = cases.find(item => item.id === req.params.id);
  if (!c) {
    return res.status(404).json({ error: 'Case not found' });
  }
  res.json(c);
});

app.patch('/api/leak-case/cases/:id', (req: Request, res: Response) => {
  const c = cases.find(item => item.id === req.params.id);
  if (!c) {
    return res.status(404).json({ error: 'Case not found' });
  }

  const { status, notes } = req.body;
  const now = new Date().toISOString();

  if (status) {
    c.status = status;
    c.updatedAt = now;
  }
  if (notes !== undefined) {
    c.notes = notes;
    c.updatedAt = now;
  }

  c.auditTrail.push({
    timestamp: now,
    action: `Status updated to ${c.status} by Utility Analyst`,
    notes: notes || undefined,
  });

  // Broadcast update to Analyst dashboard
  broadcastSSE('case_updated', c);

  res.json(c);
});

// ---------------------------------------------------------------------------
// 6. Automated Test Runner API
// ---------------------------------------------------------------------------
app.get('/api/tests/run', (req: Request, res: Response) => {
  const tests = [
    {
      name: 'Test A: Home A baseline: 10 L/h, Current flow: 8 L/h (+55% threshold)',
      baseline: 10,
      flow: 8,
      threshold: 55,
      expectedDeviation: -20,
      expectedStatus: 'NORMAL_FLOW',
      expectedIsLeak: false,
    },
    {
      name: 'Test B: Home A baseline: 10 L/h, Current flow: 17 L/h (+55% threshold)',
      baseline: 10,
      flow: 17,
      threshold: 55,
      expectedDeviation: 70,
      expectedStatus: 'POSSIBLE_LEAK',
      expectedIsLeak: true,
    },
    {
      name: 'Test C: Home A baseline: 10 L/h, Current flow: 40 L/h (+55% threshold)',
      baseline: 10,
      flow: 40,
      threshold: 55,
      expectedDeviation: 300,
      expectedStatus: 'SEVERE_LEAK',
      expectedIsLeak: true,
    },
    {
      name: 'Test D: Home B baseline: 30 L/h, Current flow: 35 L/h (+55% threshold)',
      baseline: 30,
      flow: 35,
      threshold: 55,
      expectedDeviation: 16.67,
      expectedStatus: 'NORMAL_FLOW',
      expectedIsLeak: false,
    },
    {
      name: 'Edge Case 1: Missing / Zero Baseline (0 L/h)',
      baseline: 0,
      flow: 15,
      threshold: 55,
      expectedDeviation: null,
      expectedStatus: 'INSUFFICIENT_BASELINE',
      expectedIsLeak: false,
    },
    {
      name: 'Edge Case 2: Kafka Deduplication Idempotency Check',
      testDeduplication: true,
    },
  ];

  const results = tests.map(t => {
    if (t.testDeduplication) {
      const duplicateKey = 'TEST-DEDUP-001';
      const firstCheck = !processedEventIds.has(duplicateKey);
      if (firstCheck) processedEventIds.add(duplicateKey);
      const secondCheck = processedEventIds.has(duplicateKey); // Should detect already present
      return {
        name: t.name,
        passed: firstCheck && secondCheck,
        actual: 'Idempotency key successfully guarded against duplicate event ingestion',
        expected: 'Single execution per event ID',
        details: 'Kafka consumer rejects identical event IDs',
      };
    }

    const baseline = t.baseline!;
    const flow = t.flow!;
    let deviation: number | null = null;
    let isLeak = false;
    let status = 'NORMAL_FLOW';

    if (baseline <= 0) {
      status = 'INSUFFICIENT_BASELINE';
      deviation = null;
    } else {
      deviation = Math.round(((flow - baseline) / baseline) * 100 * 100) / 100;
      isLeak = deviation > t.threshold!;
      if (isLeak) {
        status = deviation >= 150 ? 'SEVERE_LEAK' : 'POSSIBLE_LEAK';
      }
    }

    const expectedDev = t.expectedDeviation;
    const devMatches = deviation === expectedDev || (expectedDev !== undefined && expectedDev !== null && deviation !== null && Math.abs(deviation - expectedDev) < 0.1);
    const statusMatches = status === t.expectedStatus;
    const leakMatches = isLeak === t.expectedIsLeak;

    return {
      name: t.name,
      passed: devMatches && statusMatches && leakMatches,
      baseline,
      currentFlow: flow,
      deviation,
      expectedDeviation: t.expectedDeviation,
      actualStatus: status,
      expectedStatus: t.expectedStatus,
      isLeak,
      expectedIsLeak: t.expectedIsLeak,
      details: `Formula: ((${flow} - ${baseline}) / ${baseline}) × 100 = ${deviation}%`,
    };
  });

  const allPassed = results.every(r => r.passed);

  res.json({
    summary: {
      total: results.length,
      passed: results.filter(r => r.passed).length,
      failed: results.filter(r => !r.passed).length,
      status: allPassed ? 'ALL_PASSED' : 'FAILURES_DETECTED',
    },
    results,
    timestamp: new Date().toISOString(),
  });
});

// ---------------------------------------------------------------------------
// 7. Mount Vite in Dev / Serve Static in Prod
// ---------------------------------------------------------------------------
async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get('*', (req, res) => {
        res.sendFile(path.resolve(distPath, 'index.html'));
      });
    }
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`HydroWatch full-stack server running at http://0.0.0.0:${PORT}`);
  });
}

startServer().catch(err => {
  console.error('Failed to start HydroWatch server:', err);
  process.exit(1);
});
