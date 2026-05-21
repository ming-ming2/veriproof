package com.example.veriproof.domain.event.service;

import com.example.veriproof.domain.event.dto.EventBatchRequest;
import com.example.veriproof.domain.event.dto.EventRequest;
import com.example.veriproof.domain.event.dto.SseEvent;
import com.example.veriproof.domain.event.entity.AnswerSnapshot;
import com.example.veriproof.domain.event.entity.EventLog;
import com.example.veriproof.domain.event.repository.AnswerSnapshotRepository;
import com.example.veriproof.domain.event.repository.EventLogRepository;
import com.example.veriproof.domain.exam.entity.Exam;
import com.example.veriproof.domain.exam.entity.ExamSession;
import com.example.veriproof.domain.exam.entity.Question;
import com.example.veriproof.domain.exam.repository.ExamSessionRepository;
import com.example.veriproof.domain.exam.repository.QuestionRepository;
import com.example.veriproof.global.exception.CustomException;
import com.example.veriproof.global.exception.ErrorCode;
import com.example.veriproof.infra.redis.AttentionStore;
import com.example.veriproof.infra.redis.SignalCounterStore;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * 학생 즉시 이벤트 ingest 파이프라인 (백로그 13).
 *
 * 단계:
 *  1. 세션/시간 검증
 *  2. 이벤트별 event_type 검증 + event_log INSERT
 *  3. VISIBILITY_RESTORED / FULLSCREEN_ENTER 페어링 → duration_ms 채움
 *  4. 점수 부여 대상이면 AttentionStore + SignalCounterStore +1
 *  5. EventBroadcaster.publish(student-event + 필요 시 attention-update)
 *
 * 점수 정책: 모든 의심 시그널 +1 균등. VISIBILITY 페어는 RESTORED 도착 시점에 1점.
 * 레벨 임계: HIGH≥4, MID≥2, LOW≥1, NORMAL=0.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class EventIngestService {

    // 즉시 이벤트 (백로그 13) 허용 타입.
    static final Set<String> ALLOWED_IMMEDIATE_TYPES = Set.of(
            "PASTE",
            "VISIBILITY_LOST", "VISIBILITY_RESTORED",
            "FULLSCREEN_EXIT", "FULLSCREEN_ENTER",
            "CAPTURE_SHORTCUT",
            "WINDOW_BLUR"
    );

    // 배치 이벤트 (백로그 14) 허용 타입. 점수 부여 X (재생용).
    static final Set<String> ALLOWED_BATCH_TYPES = Set.of(
            "KEYSTROKE", "CHOICE_CHANGE", "QUESTION_NAVIGATE"
    );

    // 점수 +1 부여 대상 (즉시 이벤트 중).
    private static final Set<String> SCORE_AWARDING_TYPES = Set.of(
            "PASTE",
            "VISIBILITY_RESTORED",  // 페어 단위로 점수
            "FULLSCREEN_ENTER",     // 페어 단위로 점수
            "CAPTURE_SHORTCUT",
            "WINDOW_BLUR"
    );

    /** SUSPICIOUS_CHOICE_CHANGE 트리거 임계: RESTORED/ENTER 후 5초 이내 CHOICE_CHANGE. */
    private static final long SUSPICIOUS_WINDOW_MS = 5_000L;

    private final ExamSessionRepository examSessionRepository;
    private final QuestionRepository questionRepository;
    private final EventLogRepository eventLogRepository;
    private final AnswerSnapshotRepository answerSnapshotRepository;
    private final AttentionStore attentionStore;
    private final SignalCounterStore signalCounterStore;
    private final EventBroadcaster broadcaster;
    private final ObjectMapper objectMapper;

    @Transactional
    public void ingest(UUID sessionUuid, EventRequest request) {
        ExamSession session = validateActiveSession(sessionUuid);
        Exam exam = session.getExam();
        for (EventRequest.EventItem item : request.events()) {
            ingestOne(session, exam, item);
        }
    }

    /** 배치 이벤트 + 답안 스냅샷 일괄 처리 (백로그 14). */
    @Transactional
    public void ingestBatch(UUID sessionUuid, EventBatchRequest request) {
        ExamSession session = validateActiveSession(sessionUuid);
        Exam exam = session.getExam();

        if (request.batchPeriodStart() == null
                || request.batchPeriodEnd() == null
                || !request.batchPeriodStart().isBefore(request.batchPeriodEnd())) {
            throw new CustomException(ErrorCode.BATCH_PERIOD_INVALID);
        }

        if (request.events() != null) {
            for (EventBatchRequest.EventItem item : request.events()) {
                ingestBatchOne(session, exam, item);
            }
        }

        if (request.snapshots() != null) {
            for (EventBatchRequest.SnapshotItem snap : request.snapshots()) {
                saveSnapshot(session, exam, snap);
            }
        }
    }

    private ExamSession validateActiveSession(UUID sessionUuid) {
        ExamSession session = examSessionRepository.findBySessionUuid(sessionUuid)
                .orElseThrow(() -> new CustomException(ErrorCode.SESSION_NOT_FOUND));
        if (session.isSubmitted()) {
            throw new CustomException(ErrorCode.SESSION_ALREADY_SUBMITTED);
        }
        if (OffsetDateTime.now().isAfter(session.getExam().getEndsAt())) {
            throw new CustomException(ErrorCode.EXAM_ENDED);
        }
        return session;
    }

    private void ingestOne(ExamSession session, Exam exam, EventRequest.EventItem item) {
        String type = item.type();
        if (!ALLOWED_IMMEDIATE_TYPES.contains(type)) {
            throw new CustomException(ErrorCode.EVENT_TYPE_INVALID);
        }

        Question question = resolveQuestion(exam.getId(), item.questionId());
        String payloadJson = toJson(item.payload());

        EventLog saved = eventLogRepository.save(EventLog.builder()
                .examSession(session)
                .exam(exam)
                .eventType(type)
                .question(question)
                .occurredAt(item.occurredAt())
                .payload(payloadJson)
                .build());

        // 페어링: RESTORED/ENTER이면 가장 가까운 LOST/EXIT을 찾아 duration_ms를 RESTORED/ENTER row에 기록.
        Integer durationMs = null;
        if ("VISIBILITY_RESTORED".equals(type)) {
            durationMs = recordPair(session.getId(), "VISIBILITY_LOST", saved);
        } else if ("FULLSCREEN_ENTER".equals(type)) {
            durationMs = recordPair(session.getId(), "FULLSCREEN_EXIT", saved);
        }

        // 점수 갱신
        Double newScore = null;
        if (SCORE_AWARDING_TYPES.contains(type)) {
            String signalType = toSignalType(type);
            signalCounterStore.increment(session.getSessionUuid(), signalType, exam.getEndsAt());
            newScore = attentionStore.increment(exam.getId(), session.getSessionUuid(), exam.getEndsAt());
        }

        // SSE broadcast
        broadcaster.publish(exam.getId(), SseEvent.studentEvent(buildStudentEventData(session, saved, durationMs)));
        if (newScore != null) {
            broadcaster.publish(exam.getId(), SseEvent.attentionUpdate(Map.of(
                    "sessionUuid", session.getSessionUuid().toString(),
                    "score", newScore.intValue(),
                    "level", computeLevel(newScore),
                    "delta", 1
            )));
        }
    }

    private void ingestBatchOne(ExamSession session, Exam exam, EventBatchRequest.EventItem item) {
        String type = item.type();
        if (!ALLOWED_BATCH_TYPES.contains(type)) {
            throw new CustomException(ErrorCode.EVENT_TYPE_INVALID);
        }

        Question question = resolveQuestion(exam.getId(), item.questionId());
        EventLog saved = eventLogRepository.save(EventLog.builder()
                .examSession(session)
                .exam(exam)
                .eventType(type)
                .question(question)
                .occurredAt(item.occurredAt())
                .payload(toJson(item.payload()))
                .build());

        // CHOICE_CHANGE 도착 시 직전 5초 내 VISIBILITY_RESTORED/FULLSCREEN_ENTER 있으면 SUSPICIOUS 파생.
        if ("CHOICE_CHANGE".equals(type)) {
            deriveSuspiciousIfApplicable(session, exam, saved);
        }
    }

    private void deriveSuspiciousIfApplicable(ExamSession session, Exam exam, EventLog choiceChange) {
        List<EventLog> candidates = eventLogRepository.findLatestReturnBefore(
                session.getId(), choiceChange.getOccurredAt(), PageRequest.of(0, 1));
        if (candidates.isEmpty()) {
            return;
        }
        EventLog ret = candidates.get(0);
        long deltaMs = java.time.Duration.between(ret.getOccurredAt(), choiceChange.getOccurredAt()).toMillis();
        if (deltaMs < 0 || deltaMs > SUSPICIOUS_WINDOW_MS) {
            return;
        }

        Map<String, Object> payload = new HashMap<>();
        payload.put("originalChoiceChangeId", choiceChange.getId());
        payload.put("restoredAt", ret.getOccurredAt().toString());
        payload.put("deltaMs", deltaMs);
        String payloadJson;
        try {
            payloadJson = objectMapper.writeValueAsString(payload);
        } catch (JsonProcessingException e) {
            throw new CustomException(ErrorCode.INTERNAL_SERVER_ERROR);
        }

        EventLog suspicious = eventLogRepository.save(EventLog.builder()
                .examSession(session)
                .exam(exam)
                .eventType("SUSPICIOUS_CHOICE_CHANGE")
                .question(choiceChange.getQuestion())
                .occurredAt(choiceChange.getOccurredAt())
                .payload(payloadJson)
                .build());

        signalCounterStore.increment(session.getSessionUuid(), "suspicious_choice_change", exam.getEndsAt());
        double newScore = attentionStore.increment(exam.getId(), session.getSessionUuid(), exam.getEndsAt());

        broadcaster.publish(exam.getId(), SseEvent.studentEvent(buildStudentEventData(session, suspicious, null)));
        broadcaster.publish(exam.getId(), SseEvent.attentionUpdate(Map.of(
                "sessionUuid", session.getSessionUuid().toString(),
                "score", (int) newScore,
                "level", computeLevel(newScore),
                "delta", 1
        )));
    }

    private void saveSnapshot(ExamSession session, Exam exam, EventBatchRequest.SnapshotItem snap) {
        Question question = questionRepository.findByIdAndExamId(snap.questionId(), exam.getId())
                .orElseThrow(() -> new CustomException(ErrorCode.QUESTION_NOT_IN_EXAM));

        Long[] choiceIds = (snap.selectedChoiceIds() == null || snap.selectedChoiceIds().isEmpty())
                ? null
                : snap.selectedChoiceIds().toArray(new Long[0]);

        answerSnapshotRepository.save(AnswerSnapshot.builder()
                .examSession(session)
                .question(question)
                .capturedAt(snap.capturedAt())
                .answerText(snap.answerText())
                .selectedChoiceIds(choiceIds)
                .build());
    }

    private Question resolveQuestion(Long examId, Long questionId) {
        if (questionId == null) {
            return null;
        }
        // 위조 방지: 해당 문항이 시험에 속해야 함. 아니면 무시(null로 저장)하지 말고 400.
        return questionRepository.findByIdAndExamId(questionId, examId)
                .orElseThrow(() -> new CustomException(ErrorCode.QUESTION_NOT_IN_EXAM));
    }

    private Integer recordPair(Long sessionId, String startType, EventLog endEvent) {
        List<EventLog> candidates = eventLogRepository.findLatestStartBefore(
                sessionId, startType, endEvent.getOccurredAt(), PageRequest.of(0, 1));
        if (candidates.isEmpty()) {
            return null; // 페어 누락 (브라우저 강제 종료 등). duration NULL 유지.
        }
        EventLog start = candidates.get(0);
        long ms = java.time.Duration.between(start.getOccurredAt(), endEvent.getOccurredAt()).toMillis();
        int clamped = (int) Math.max(0L, Math.min((long) Integer.MAX_VALUE, ms));
        endEvent.recordPairedDuration(clamped);
        return clamped;
    }

    private String toJson(JsonNode payload) {
        if (payload == null || payload.isNull()) {
            return "{}";
        }
        try {
            return objectMapper.writeValueAsString(payload);
        } catch (JsonProcessingException e) {
            throw new CustomException(ErrorCode.INTERNAL_SERVER_ERROR);
        }
    }

    private Map<String, Object> buildStudentEventData(ExamSession session, EventLog log, Integer durationMs) {
        Map<String, Object> data = new HashMap<>();
        data.put("id", log.getId());
        data.put("sessionUuid", session.getSessionUuid().toString());
        data.put("studentNumber", session.getStudentNumber());
        data.put("type", log.getEventType());
        data.put("questionId", log.getQuestion() != null ? log.getQuestion().getId() : null);
        data.put("questionDisplayOrder", log.getQuestion() != null ? log.getQuestion().getDisplayOrder() : null);
        data.put("occurredAt", log.getOccurredAt().toString());
        if (durationMs != null) {
            data.put("durationMs", durationMs);
        }
        data.put("payload", log.getPayload());
        return data;
    }

    /** event_type → signals hash field. RESTORED/ENTER 시점 점수를 LOST/EXIT 카운트로 누적한다. */
    private String toSignalType(String eventType) {
        return switch (eventType) {
            case "PASTE"                -> "paste";
            case "VISIBILITY_RESTORED"  -> "visibility_lost";
            case "FULLSCREEN_ENTER"     -> "fullscreen_exit";
            case "CAPTURE_SHORTCUT"     -> "capture_shortcut";
            case "WINDOW_BLUR"          -> "window_blur";
            default                     -> eventType.toLowerCase();
        };
    }

    /** 누적 점수 → 레벨. */
    public static String computeLevel(double score) {
        if (score >= 4.0) return "HIGH";
        if (score >= 2.0) return "MID";
        if (score >= 1.0) return "LOW";
        return "NORMAL";
    }
}
