/**
 * HydroWatch Automated Leak Detection Logic Tests
 * 
 * Verifies:
 * - Test A (Home A: 10 L/h, current 8 L/h -> -20% -> Normal Flow)
 * - Test B (Home A: 10 L/h, current 17 L/h -> +70% -> Possible Leak Detected)
 * - Test C (Home A: 10 L/h, current 40 L/h -> +300% -> Possible Leak Detected)
 * - Test D (Home B: 30 L/h, current 35 L/h -> +16.67% -> Normal Flow)
 * - Edge Case: Zero / missing baseline -> "Insufficient Baseline Data"
 * - Custom threshold testing
 */

import { evaluateLeakCondition } from '../src/utils/leakDetection.ts';

function runTests() {
  console.log('=====================================================');
  console.log(' HydroWatch Leak Detection - Automated Test Suite');
  console.log('=====================================================\n');

  let passed = 0;
  let total = 0;

  function assert(condition: boolean, testName: string, details?: string) {
    total++;
    if (condition) {
      console.log(`✓ [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`✗ [FAIL] ${testName}`);
      if (details) console.error(`  Details: ${details}`);
    }
  }

  // Test A: Home A baseline 10, current flow 8, threshold 55%
  const resA = evaluateLeakCondition({
    propertyId: 'HOME_A',
    propertyName: 'Home A',
    currentFlow: 8,
    baselineFlow: 10,
    thresholdPercent: 55,
  });
  assert(
    resA.deviationPercent === -20 && resA.status === 'NORMAL_FLOW' && !resA.isLeak,
    'Test A: Home A (10 L/h baseline, 8 L/h flow, +55% threshold)',
    `Expected -20% and NORMAL_FLOW, got ${resA.deviationPercent}% and ${resA.status}`
  );

  // Test B: Home A baseline 10, current flow 17, threshold 55%
  const resB = evaluateLeakCondition({
    propertyId: 'HOME_A',
    propertyName: 'Home A',
    currentFlow: 17,
    baselineFlow: 10,
    thresholdPercent: 55,
  });
  assert(
    resB.deviationPercent === 70 && resB.status === 'POSSIBLE_LEAK' && resB.isLeak,
    'Test B: Home A (10 L/h baseline, 17 L/h flow, +55% threshold)',
    `Expected +70% and POSSIBLE_LEAK, got ${resB.deviationPercent}% and ${resB.status}`
  );

  // Test C: Home A baseline 10, current flow 40, threshold 55%
  const resC = evaluateLeakCondition({
    propertyId: 'HOME_A',
    propertyName: 'Home A',
    currentFlow: 40,
    baselineFlow: 10,
    thresholdPercent: 55,
  });
  assert(
    resC.deviationPercent === 300 && (resC.status === 'POSSIBLE_LEAK' || resC.status === 'SEVERE_LEAK') && resC.isLeak,
    'Test C: Home A (10 L/h baseline, 40 L/h flow, +55% threshold)',
    `Expected +300% and leak detected, got ${resC.deviationPercent}% and ${resC.status}`
  );

  // Test D: Home B baseline 30, current flow 35, threshold 55%
  const resD = evaluateLeakCondition({
    propertyId: 'HOME_B',
    propertyName: 'Home B',
    currentFlow: 35,
    baselineFlow: 30,
    thresholdPercent: 55,
  });
  const devD = resD.deviationPercent !== null ? Math.round(resD.deviationPercent * 100) / 100 : 0;
  assert(
    Math.abs(devD - 16.67) < 0.1 && resD.status === 'NORMAL_FLOW' && !resD.isLeak,
    'Test D: Home B (30 L/h baseline, 35 L/h flow, +55% threshold)',
    `Expected approx +16.67% and NORMAL_FLOW, got ${devD}% and ${resD.status}`
  );

  // Edge Case 1: Zero Baseline
  const resZero = evaluateLeakCondition({
    propertyId: 'HOME_A',
    currentFlow: 15,
    baselineFlow: 0,
    thresholdPercent: 55,
  });
  assert(
    resZero.status === 'INSUFFICIENT_BASELINE' && resZero.statusLabel === 'Insufficient Baseline Data' && resZero.deviationPercent === null,
    'Edge Case: Zero Baseline (0 L/h) avoids division by zero',
    `Expected INSUFFICIENT_BASELINE with null deviation, got ${resZero.status} and ${resZero.deviationPercent}`
  );

  // Edge Case 2: Negative Baseline
  const resNeg = evaluateLeakCondition({
    propertyId: 'HOME_A',
    currentFlow: 15,
    baselineFlow: -5,
    thresholdPercent: 55,
  });
  assert(
    resNeg.status === 'INSUFFICIENT_BASELINE' && resNeg.statusLabel === 'Insufficient Baseline Data',
    'Edge Case: Negative Baseline treats as Insufficient Baseline Data'
  );

  // Edge Case 3: Threshold sensitivity (e.g. at 10% threshold, 35 L/h on 30 baseline triggers leak)
  const resSens = evaluateLeakCondition({
    propertyId: 'HOME_B',
    currentFlow: 35,
    baselineFlow: 30,
    thresholdPercent: 10,
  });
  assert(
    resSens.isLeak === true && resSens.status === 'POSSIBLE_LEAK',
    'Configurable Threshold: Home B at 10% threshold correctly triggers leak (+16.67% > +10%)'
  );

  console.log('\n-----------------------------------------------------');
  console.log(`Results: ${passed}/${total} tests passed (${Math.round((passed / total) * 100)}%)`);
  console.log('-----------------------------------------------------\n');

  if (passed !== total) {
    process.exit(1);
  }
}

runTests();
