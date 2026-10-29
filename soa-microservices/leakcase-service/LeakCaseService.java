package com.hydrowatch.leakcase.service;

import com.hydrowatch.leakcase.entity.InvestigationCaseEntity;
import com.hydrowatch.leakcase.repository.InvestigationCaseRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

/**
 * HydroWatch LeakCase Microservice
 * 
 * Consumes NightFlowAnomalyDetected events from Kafka topic soa.s10.t02.events.
 * Enforces idempotent deduplication to prevent duplicate investigation cases.
 * Manages case status transitions (OPEN -> UNDER_INVESTIGATION -> RESOLVED).
 */
@Service
public class LeakCaseService {

    private static final Logger log = LoggerFactory.getLogger(LeakCaseService.class);

    private final InvestigationCaseRepository caseRepository;
    private final ConcurrentHashMap<String, Boolean> processedEventCache = new ConcurrentHashMap<>();

    public LeakCaseService(InvestigationCaseRepository caseRepository) {
        this.caseRepository = caseRepository;
    }

    @KafkaListener(topics = "${kafka.topic.anomaly:soa.s10.t02.events}", groupId = "hydrowatch-leakcase-group")
    @Transactional
    public void consumeAnomalyEvent(NightFlowAnomalyPayload payload) {
        log.info("Received Kafka Anomaly Event from topic soa.s10.t02.events: eventId={}", payload.getEventId());

        // Idempotent deduplication check
        if (payload.getEventId() != null && processedEventCache.putIfAbsent(payload.getEventId(), true) != null) {
            log.warn("Duplicate Kafka event detected and discarded: eventId={}", payload.getEventId());
            return;
        }

        // Check if case already exists by event ID in database
        if (payload.getEventId() != null && caseRepository.existsByEventId(payload.getEventId())) {
            log.warn("Case already persisted for eventId={}. Discarding duplicate.", payload.getEventId());
            return;
        }

        long caseCount = caseRepository.count() + 101;
        String caseId = "CASE-2026-" + String.format("%03d", caseCount);

        InvestigationCaseEntity entity = InvestigationCaseEntity.builder()
                .id(caseId)
                .propertyId(payload.getPropertyId())
                .propertyName(payload.getPropertyName())
                .baselineFlow(payload.getBaselineFlow())
                .observedFlow(payload.getObservedFlow())
                .deviationPercent(payload.getDeviationPercent())
                .thresholdPercent(payload.getThresholdPercent())
                .severity(payload.getSeverity())
                .status("OPEN")
                .createdAt(Instant.now())
                .updatedAt(Instant.now())
                .eventId(payload.getEventId())
                .notes(String.format("Auto-generated: Water flow %.1f L/h exceeded baseline %.1f L/h by +%.2f%%.",
                        payload.getObservedFlow(), payload.getBaselineFlow(), payload.getDeviationPercent()))
                .build();

        caseRepository.save(entity);
        log.info("Successfully created and persisted investigation case: caseId={}", caseId);
    }

    @Transactional(readOnly = true)
    public List<InvestigationCaseEntity> getAllCases(String status, String severity) {
        if (status != null && !status.equalsIgnoreCase("ALL")) {
            return caseRepository.findByStatus(status.toUpperCase());
        }
        return caseRepository.findAllByOrderByCreatedAtDesc();
    }

    @Transactional
    public InvestigationCaseEntity updateCaseStatus(String caseId, String newStatus, String notes) {
        Optional<InvestigationCaseEntity> opt = caseRepository.findById(caseId);
        if (opt.isEmpty()) {
            throw new IllegalArgumentException("Investigation case not found: " + caseId);
        }
        InvestigationCaseEntity entity = opt.get();
        if (newStatus != null) {
            entity.setStatus(newStatus.toUpperCase());
        }
        if (notes != null && !notes.isBlank()) {
            entity.setNotes((entity.getNotes() != null ? entity.getNotes() + "\n" : "") + "[" + Instant.now() + "] " + notes);
        }
        entity.setUpdatedAt(Instant.now());
        return caseRepository.save(entity);
    }
}
