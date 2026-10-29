package com.hydrowatch.baseline.service;

import com.hydrowatch.baseline.dto.EvaluationResultDto;
import com.hydrowatch.baseline.event.NightFlowAnomalyDetectedEvent;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.UUID;

/**
 * HydroWatch Baseline Service
 * 
 * Formula:
 * When baseline > 0:
 *   Deviation (%) = ((Current Flow - Baseline) / Baseline) * 100
 * 
 * If deviation > threshold:
 *   Publish NightFlowAnomalyDetected event to Kafka topic soa.s10.t02.events
 */
@Service
public class BaselineService {

    private static final Logger log = LoggerFactory.getLogger(BaselineService.class);

    @Value("${kafka.topic.anomaly:soa.s10.t02.events}")
    private String anomalyTopic;

    private final KafkaTemplate<String, Object> kafkaTemplate;

    public BaselineService(KafkaTemplate<String, Object> kafkaTemplate) {
        this.kafkaTemplate = kafkaTemplate;
    }

    public EvaluationResultDto evaluateReading(String propertyId, String propertyName, double currentFlow, Double baselineFlow, double thresholdPercent) {
        String timestamp = Instant.now().toString();

        // Safe check for missing or zero baseline (prevent division by zero)
        if (baselineFlow == null || baselineFlow <= 0.0) {
            log.warn("Property {} has insufficient baseline: {}", propertyId, baselineFlow);
            return EvaluationResultDto.builder()
                    .propertyId(propertyId)
                    .propertyName(propertyName != null ? propertyName : propertyId)
                    .currentFlow(currentFlow)
                    .baselineFlow(baselineFlow != null ? baselineFlow : 0.0)
                    .deviationPercent(null)
                    .thresholdPercent(thresholdPercent)
                    .status("INSUFFICIENT_BASELINE")
                    .statusLabel("Insufficient Baseline Data")
                    .isLeak(false)
                    .severity("NORMAL")
                    .eventPublished(false)
                    .timestamp(timestamp)
                    .message("Insufficient baseline data. Division by zero prevented.")
                    .build();
        }

        // Exact Formula: Deviation (%) = ((Current Flow - Baseline) / Baseline) * 100
        double deviation = ((currentFlow - baselineFlow) / baselineFlow) * 100.0;
        double roundedDeviation = Math.round(deviation * 100.0) / 100.0;

        boolean isLeak = roundedDeviation > thresholdPercent;
        String status = isLeak ? (roundedDeviation >= 150.0 ? "SEVERE_LEAK" : "POSSIBLE_LEAK") : "NORMAL_FLOW";
        String statusLabel = isLeak ? (roundedDeviation >= 150.0 ? "Possible Leak Detected (Severe)" : "Possible Leak Detected") : "Normal Flow";
        String severity = isLeak ? (roundedDeviation >= 150.0 ? "SEVERE" : "MODERATE") : "NORMAL";

        boolean eventPublished = false;

        if (isLeak) {
            String eventId = "EVT-" + propertyId + "-" + UUID.randomUUID().toString().substring(0, 8);
            NightFlowAnomalyDetectedEvent event = NightFlowAnomalyDetectedEvent.builder()
                    .eventId(eventId)
                    .topic(anomalyTopic)
                    .eventType("NightFlowAnomalyDetected")
                    .propertyId(propertyId)
                    .propertyName(propertyName != null ? propertyName : propertyId)
                    .baselineFlow(baselineFlow)
                    .observedFlow(currentFlow)
                    .deviationPercent(roundedDeviation)
                    .thresholdPercent(thresholdPercent)
                    .severity(severity)
                    .timestamp(timestamp)
                    .build();

            log.info("Publishing NightFlowAnomalyDetected to Kafka topic [{}]: {}", anomalyTopic, event);
            try {
                kafkaTemplate.send(anomalyTopic, propertyId, event);
                eventPublished = true;
            } catch (Exception ex) {
                log.error("Failed to publish Kafka event to topic {}", anomalyTopic, ex);
            }
        }

        return EvaluationResultDto.builder()
                .propertyId(propertyId)
                .propertyName(propertyName != null ? propertyName : propertyId)
                .currentFlow(currentFlow)
                .baselineFlow(baselineFlow)
                .deviationPercent(roundedDeviation)
                .thresholdPercent(thresholdPercent)
                .status(status)
                .statusLabel(statusLabel)
                .isLeak(isLeak)
                .severity(severity)
                .eventPublished(eventPublished)
                .timestamp(timestamp)
                .message(isLeak
                        ? String.format("Flow deviation of +%.2f%% exceeds the +%.1f%% anomaly threshold.", roundedDeviation, thresholdPercent)
                        : String.format("Flow deviation of %.2f%% is within acceptable baseline parameters.", roundedDeviation))
                .build();
    }
}
