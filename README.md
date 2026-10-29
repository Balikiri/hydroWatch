# HydroWatch — Smart Water Leak Detection & Automated Investigation System

> **"Monitor Water. Detect Leaks. Save Every Drop."**

HydroWatch is a Service-Oriented Architecture (SOA) water leak detection and automated investigation workflow application. It monitors nighttime water consumption baselines, evaluates anomalous flow deviations, emits event-driven alerts through Apache Kafka, and empowers municipal utility operations with real-time case triage and lifecycle management.

---

## 1. Quick Start & Demonstration Mode

HydroWatch runs in **Direct Demonstration Mode**:
- **No Login Screen**: Opens directly to the HydroWatch operations console. No email, password, demo credentials, or authentication obstacles.
- **Header Role Switcher**: Seamless toggle between:
  - 🏡 **Resident Dashboard**: Property-level telemetry, 24-hour hourly flow chart, and real-time reading simulator.
  - 🏢 **Utility Analyst Dashboard**: District-wide overview, multi-property telemetry matrix, live Kafka event stream ticker, and investigation case management.
- **Synthetic Sample Properties**: Home A, Home B, and Home C with distinct nighttime baselines and telemetry patterns.

---

## 2. Core Leak Detection Logic

HydroWatch uses standardized nighttime baseline deviation analysis to isolate continuous background pipe loss from ordinary diurnal water use:

### Mathematical Formula
When $\text{Baseline} > 0$:

$$\text{Deviation (\%)} = \left(\frac{\text{Current Flow} - \text{Baseline}}{\text{Baseline}}\right) \times 100$$

### Decision Rules
- If $\text{Deviation (\%)} > \text{Configured Threshold (\%)} \rightarrow$ **Suspected Leak** (`Possible Leak Detected` or `Severe Leak Detected`)
- If $\text{Deviation (\%)} \le \text{Configured Threshold (\%)} \rightarrow$ **Normal Flow**
- If $\text{Baseline} \le 0$ or missing $\rightarrow$ **"Insufficient Baseline Data"** (avoids division by zero)

### Standard Test Cases Verification (Default +55% Threshold)

| Test Case | Property | Baseline | Current Flow | Evaluated Deviation | Expected Status | Result |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Test A** | Home A | $10\text{ L/h}$ | $8\text{ L/h}$ | $-20.00\%$ | **Normal Flow** | **PASSED** |
| **Test B** | Home A | $10\text{ L/h}$ | $17\text{ L/h}$ | $+70.00\%$ | **Possible Leak Detected** | **PASSED** |
| **Test C** | Home A | $10\text{ L/h}$ | $40\text{ L/h}$ | $+300.00\%$ | **Possible Leak (Severe)** | **PASSED** |
| **Test D** | Home B | $30\text{ L/h}$ | $35\text{ L/h}$ | $+16.67\%$ | **Normal Flow** | **PASSED** |
| **Edge 1** | Home A | $0\text{ L/h}$ | $15\text{ L/h}$ | $\text{N/A}$ | **Insufficient Baseline Data** | **PASSED** |

---

## 3. SOA Architecture & Event Pipeline

The system is designed around event-driven microservices:

```
+-----------------------------------------------------------------------------------+
|                              HydroWatch SOA Topology                              |
+-----------------------------------------------------------------------------------+

[Smart Water Meter] 
        │ 
        ▼ HTTP POST
┌──────────────────────┐       JPA Store
│  MeterSeries Service │ ────► [Readings DB]
└──────────────────────┘
        │
        ▼ Telemetry Stream
┌──────────────────────┐
│   Baseline Service   │ ── Evaluates: Deviation > +55%?
└──────────────────────┘
        │
        │ YES: Publishes NightFlowAnomalyDetected
        ▼
╔════════════════════════════════════════════════════╗
║    Apache Kafka Topic: soa.s10.t02.events          ║
╚════════════════════════════════════════════════════╝
        │
        ▼ Consumes (Consumer Group: hydrowatch-leakcase-group)
┌──────────────────────┐
│   LeakCase Service   │ ── Idempotent Deduplication (eventId check)
└──────────────────────┘
        │
        ├─► Persists to Investigation Case Store (CASE-2026-XXX)
        │
        ▼ Server-Sent Events (SSE) Push
┌────────────────────────────────────────────────────┐
│ Utility Analyst Dashboard (Real-Time Live Updates) │
└────────────────────────────────────────────────────┘
```

1. **MeterSeries Service (`:8081`)**: Accepts and validates telemetry, persisting time-series readings with JPA.
2. **Baseline Service (`:8082`)**: Calculates night baseline and evaluates threshold anomalies. Publishes `NightFlowAnomalyDetected` events.
3. **Kafka Broker (`:9092`)**: Distributes events across topic `soa.s10.t02.events`.
4. **LeakCase Service (`:8083`)**: Consumes events, enforces idempotent deduplication, creates and stores investigation cases.
5. **Spring Cloud Eureka (`:8761`) & Gateway (`:8080`)**: Dynamic service discovery and routing.

---

## 4. Local Execution & Testing

### Running the Full-Stack Application

```bash
# 1. Install dependencies
npm install

# 2. Run automated leak detection unit test suite
npm test

# 3. Start development server (Full-stack Express + Vite)
npm run dev
```

Visit `http://localhost:3000` to access the HydroWatch console directly.

### Running Automated Test Suite
HydroWatch provides two test runners:
1. **CLI Test Runner**:
   ```bash
   npm test
   ```
   Runs assertions on Test Cases A, B, C, D, edge cases, zero baseline safety, and threshold sensitivities.
2. **Interactive In-App Test Runner**: Click the **"Test Suite"** button in the header to execute all scenarios live in the browser with visual formula confirmation.

### Running Java Spring Boot Microservices with Docker Compose

```bash
cd soa-microservices
docker-compose up -d
```

This starts Eureka, Kafka, Zookeeper, MeterSeries, Baseline, and LeakCase microservices.

---

## 5. Deployment Guide (Vercel / Cloud Run)

### Environment Variables
- `PORT`: Web server port (defaults to `3000`).
- `VITE_API_BASE_URL`: Optional public API base URL when deploying the frontend separately from microservices.
- `SPRING_KAFKA_BOOTSTRAP_SERVERS`: Kafka broker host (default: `localhost:9092`).
- `KAFKA_TOPIC_ANOMALY`: Kafka topic name (default: `soa.s10.t02.events`).

### Build Command
```bash
npm run build
npm start
```

---

## 6. Implemented Features Summary

- [x] **No Login Screen**: Zero authentication forms, direct access to dashboard.
- [x] **Dual Role Switcher**: Resident Dashboard and Utility Analyst Dashboard.
- [x] **Interactive 24-Hour Chart**: SVG curve with baseline, anomaly threshold, peak markers, and hover inspection.
- [x] **Reading Simulator**: Normal, Possible Leak, and Severe Leak presets with live evaluation.
- [x] **Exact Anomaly Formula**: Implemented with precision rounding and zero-baseline guard.
- [x] **All 4 Test Cases Verified**: Test A, B, C, and D passing with 100% assertions.
- [x] **Kafka Event Pipeline**: Emits `NightFlowAnomalyDetected` to topic `soa.s10.t02.events`.
- [x] **LeakCase Management**: Automatic case generation, status triage, and notes audit trail.
- [x] **Real-Time Live Updates**: Server-Sent Events (SSE) push alerts without page refresh.
