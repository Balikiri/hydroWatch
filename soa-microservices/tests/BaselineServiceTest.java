package com.hydrowatch.baseline.service;

import com.hydrowatch.baseline.dto.EvaluationResultDto;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.kafka.core.KafkaTemplate;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

/**
 * JUnit 5 + AssertJ Test Suite for Baseline Leak Detection Engine
 * 
 * Verifies all required test cases:
 * - Test A: Home A baseline 10 L/h, current 8 L/h -> -20% -> Normal Flow
 * - Test B: Home A baseline 10 L/h, current 17 L/h -> +70% -> Possible Leak Detected
 * - Test C: Home A baseline 10 L/h, current 40 L/h -> +300% -> Possible Leak Detected (Severe)
 * - Test D: Home B baseline 30 L/h, current 35 L/h -> +16.67% -> Normal Flow
 * - Edge Case 1: Missing / zero baseline -> "Insufficient Baseline Data"
 * - Edge Case 2: Kafka event publication and threshold evaluation
 */
@ExtendWith(MockitoExtension.class)
public class BaselineServiceTest {

    @Mock
    private KafkaTemplate<String, Object> kafkaTemplate;

    private BaselineService baselineService;

    @BeforeEach
    void setUp() {
        baselineService = new BaselineService(kafkaTemplate);
    }

    @Test
    @DisplayName("Test A: Home A baseline 10 L/h, current 8 L/h (+55% threshold) -> Normal Flow (-20%)")
    void testA_NormalFlowUnderBaseline() {
        EvaluationResultDto result = baselineService.evaluateReading(
                "HOME_A", "Home A", 8.0, 10.0, 55.0);

        assertThat(result.getDeviationPercent()).isEqualTo(-20.0);
        assertThat(result.getStatus()).isEqualTo("NORMAL_FLOW");
        assertThat(result.getStatusLabel()).isEqualTo("Normal Flow");
        assertThat(result.isLeak()).isFalse();
        assertThat(result.isEventPublished()).isFalse();

        // Verify Kafka is NOT triggered for normal flow
        verify(kafkaTemplate, never()).send(any(), any(), any());
    }

    @Test
    @DisplayName("Test B: Home A baseline 10 L/h, current 17 L/h (+55% threshold) -> Possible Leak Detected (+70%)")
    void testB_PossibleLeakDetected() {
        EvaluationResultDto result = baselineService.evaluateReading(
                "HOME_A", "Home A", 17.0, 10.0, 55.0);

        assertThat(result.getDeviationPercent()).isEqualTo(70.0);
        assertThat(result.getStatus()).isEqualTo("POSSIBLE_LEAK");
        assertThat(result.getStatusLabel()).isEqualTo("Possible Leak Detected");
        assertThat(result.isLeak()).isTrue();
        assertThat(result.getSeverity()).isEqualTo("MODERATE");
        assertThat(result.isEventPublished()).isTrue();

        // Verify Kafka event was dispatched to topic soa.s10.t02.events
        verify(kafkaTemplate, times(1)).send(eq("soa.s10.t02.events"), eq("HOME_A"), any());
    }

    @Test
    @DisplayName("Test C: Home A baseline 10 L/h, current 40 L/h (+55% threshold) -> Severe Leak Detected (+300%)")
    void testC_SevereLeakDetected() {
        EvaluationResultDto result = baselineService.evaluateReading(
                "HOME_A", "Home A", 40.0, 10.0, 55.0);

        assertThat(result.getDeviationPercent()).isEqualTo(300.0);
        assertThat(result.getStatus()).isEqualTo("SEVERE_LEAK");
        assertThat(result.getStatusLabel()).isEqualTo("Possible Leak Detected (Severe)");
        assertThat(result.isLeak()).isTrue();
        assertThat(result.getSeverity()).isEqualTo("SEVERE");
        assertThat(result.isEventPublished()).isTrue();

        verify(kafkaTemplate, times(1)).send(eq("soa.s10.t02.events"), eq("HOME_A"), any());
    }

    @Test
    @DisplayName("Test D: Home B baseline 30 L/h, current 35 L/h (+55% threshold) -> Normal Flow (+16.67%)")
    void testD_NormalFlowAboveBaselineBelowThreshold() {
        EvaluationResultDto result = baselineService.evaluateReading(
                "HOME_B", "Home B", 35.0, 30.0, 55.0);

        assertThat(result.getDeviationPercent()).isCloseTo(16.67, within(0.01));
        assertThat(result.getStatus()).isEqualTo("NORMAL_FLOW");
        assertThat(result.getStatusLabel()).isEqualTo("Normal Flow");
        assertThat(result.isLeak()).isFalse();
        assertThat(result.isEventPublished()).isFalse();

        verify(kafkaTemplate, never()).send(any(), any(), any());
    }

    @Test
    @DisplayName("Edge Case: Missing or Zero Baseline -> Insufficient Baseline Data")
    void testEdgeCase_ZeroBaselineDivisionByZeroPrevention() {
        EvaluationResultDto resultZero = baselineService.evaluateReading(
                "HOME_A", "Home A", 15.0, 0.0, 55.0);

        assertThat(resultZero.getStatus()).isEqualTo("INSUFFICIENT_BASELINE");
        assertThat(resultZero.getStatusLabel()).isEqualTo("Insufficient Baseline Data");
        assertThat(resultZero.getDeviationPercent()).isNull();
        assertThat(resultZero.isLeak()).isFalse();

        EvaluationResultDto resultNull = baselineService.evaluateReading(
                "HOME_A", "Home A", 15.0, null, 55.0);

        assertThat(resultNull.getStatus()).isEqualTo("INSUFFICIENT_BASELINE");
        assertThat(resultNull.getStatusLabel()).isEqualTo("Insufficient Baseline Data");
        assertThat(resultNull.getDeviationPercent()).isNull();
    }
}
