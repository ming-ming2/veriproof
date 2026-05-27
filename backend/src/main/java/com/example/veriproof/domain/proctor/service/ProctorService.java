package com.example.veriproof.domain.proctor.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.example.veriproof.domain.event.entity.AnswerSnapshot;
import com.example.veriproof.domain.event.repository.AnswerSnapshotRepository;
import com.example.veriproof.domain.event.repository.EventLogRepository;
import com.example.veriproof.domain.exam.entity.Exam;
import com.example.veriproof.domain.exam.entity.ExamSession;
import com.example.veriproof.domain.exam.entity.Question;
import com.example.veriproof.domain.exam.repository.ExamRepository;
import com.example.veriproof.domain.exam.repository.ExamSessionRepository;
import com.example.veriproof.domain.exam.repository.QuestionRepository;
import com.example.veriproof.domain.proctor.dto.*;
import com.example.veriproof.global.exception.CustomException;
import com.example.veriproof.global.exception.ErrorCode;
import com.example.veriproof.infra.redis.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class ProctorService {

    private final ExamRepository examRepository;
    private final ExamSessionRepository examSessionRepository;
    private final EventLogRepository eventLogRepository;
    private final AnswerSnapshotRepository answerSnapshotRepository;
    private final QuestionRepository questionRepository;

    private final StringRedisTemplate stringRedisTemplate;
    private final ObjectMapper objectMapper;

    private final ActiveSessionStore activeSessionStore;
    private final AttentionStore attentionStore;

    /**
     * 메인 이벤트 피드에 노출할 부정행위 의심 이벤트만.
     * 일반 입력/내비게이션(KEYSTROKE/CHOICE_CHANGE/QUESTION_NAVIGATE)은 제외.
     */
    private static final Set<String> CHEATING_EVENT_TYPES = Set.of(
            "PASTE",
            "VISIBILITY_LOST", "VISIBILITY_RESTORED",
            "FULLSCREEN_EXIT", "FULLSCREEN_ENTER",
            "CAPTURE_SHORTCUT",
            "WINDOW_BLUR",
            "SUSPICIOUS_CHOICE_CHANGE"
    );

    /**
     * 학생 상세 패널의 최근 이벤트. 컨텍스트로 CHOICE_CHANGE/QUESTION_NAVIGATE는 함께 노출하고
     * 노이즈인 KEYSTROKE만 제외한다.
     */
    private static final Set<String> DETAIL_EVENT_TYPES = Set.of(
            "PASTE",
            "VISIBILITY_LOST", "VISIBILITY_RESTORED",
            "FULLSCREEN_EXIT", "FULLSCREEN_ENTER",
            "CAPTURE_SHORTCUT",
            "WINDOW_BLUR",
            "SUSPICIOUS_CHOICE_CHANGE",
            "CHOICE_CHANGE",
            "QUESTION_NAVIGATE"
    );

    /**
     * 백로그 16: 대시보드 메타 정보 조회
     */
    public ExamDashboardMetaResponse getDashboardMeta(UUID proctorToken) {
        Exam exam = examRepository.findByProctorToken(proctorToken)
                .orElseThrow(() -> new CustomException(ErrorCode.PROCTOR_TOKEN_INVALID));

        Map<Object, Object> activeSessions = activeSessionStore.getAllActiveSessions(exam.getId());

        return ExamDashboardMetaResponse.builder()
                .examId(exam.getId())
                .title(exam.getTitle())
                .startsAt(exam.getStartsAt())
                .endsAt(exam.getEndsAt())
                .rosterCount(exam.getRosters() != null ? exam.getRosters().size() : 0)
                .activeCount(activeSessions.size())
                .build();
    }

    /**
     * 백로그 16 & 17: 학생 카드 리스트 조회
     */
    public List<ProctorStudentCardResponse> getStudentCards(UUID proctorToken, String sortBy) {
        Exam exam = examRepository.findByProctorToken(proctorToken)
                .orElseThrow(() -> new CustomException(ErrorCode.PROCTOR_TOKEN_INVALID));

        List<ActiveSessionInfo> activeInfos = activeSessionStore.getActiveSessionInfos(exam.getId());
        List<ProctorStudentCardResponse> cards = new ArrayList<>();

        for (ActiveSessionInfo info : activeInfos) {
            UUID targetSessionUuid = UUID.fromString(info.sessionUuid());
            double score = attentionStore.getScore(exam.getId(), targetSessionUuid);
            String status = examSessionRepository.findBySessionUuid(targetSessionUuid)
                    .map(ExamSession::getStatus)
                    .orElse("IN_PROGRESS");

            cards.add(ProctorStudentCardResponse.builder()
                    .sessionUuid(targetSessionUuid)
                    .studentNumber(info.studentNumber())
                    .studentName(info.studentName())
                    .currentQuestionId(info.currentQuestionId())
                    .lastActivityAt(OffsetDateTime.parse(info.lastActivityAt()))
                    .attentionScore(score)
                    .attentionLevel(determineAttentionLevel(score))
                    .status(status)
                    .build());
        }

        if ("studentNumber".equalsIgnoreCase(sortBy)) {
            cards.sort(Comparator.comparing(ProctorStudentCardResponse::getStudentNumber));
        } else {
            cards.sort(Comparator.comparing(ProctorStudentCardResponse::getAttentionScore).reversed());
        }

        return cards;
    }

    /**
     * 백로그 17: 우측 학생 상세 패널 통합 조회
     */
    public ProctorStudentDetailResponse getStudentDetail(UUID proctorToken, UUID sessionUuid) {
        Exam exam = examRepository.findByProctorToken(proctorToken)
                .orElseThrow(() -> new CustomException(ErrorCode.PROCTOR_TOKEN_INVALID));

        ExamSession session = examSessionRepository.findBySessionUuid(sessionUuid)
                .orElseThrow(() -> new CustomException(ErrorCode.SESSION_NOT_FOUND));

        // 1. Redis에서 부정행위 시그널 카운트 조회 → 명세상 camelCase로 변환 (예: visibility_lost → visibilityLost)
        String signalKey = "session:" + sessionUuid + ":signals";
        Map<Object, Object> rawSignals = stringRedisTemplate.opsForHash().entries(signalKey);
        Map<String, Integer> signalCounts = rawSignals.entrySet().stream()
                .collect(Collectors.toMap(
                        e -> snakeToCamel(String.valueOf(e.getKey())),
                        e -> Integer.valueOf(String.valueOf(e.getValue())),
                        (a, b) -> a
                ));

        // 2. DB에서 평균 화면 이탈 지속시간 계산
        Double rawAvg = eventLogRepository.avgVisibilityDurationMs(session.getId());
        Long avgDuration = rawAvg != null ? rawAvg.longValue() : 0L;

        // 3. DB에서 최근 이벤트 조회 — KEYSTROKE만 제외하고 CHOICE_CHANGE/QUESTION_NAVIGATE 등 컨텍스트는 포함
        List<ProctorStudentDetailResponse.RecentEventItem> recentEvents = eventLogRepository
                .findCheatingEventsBySession(session.getId(), DETAIL_EVENT_TYPES, PageRequest.of(0, 20))
                .stream()
                .map(log -> ProctorStudentDetailResponse.RecentEventItem.builder()
                        .type(log.getEventType())
                        .questionId(log.getQuestion() != null ? log.getQuestion().getId() : null)
                        .questionDisplayOrder(log.getQuestion() != null ? log.getQuestion().getDisplayOrder() : null)
                        .occurredAt(log.getOccurredAt())
                        .durationMs(log.getDurationMs())
                        .build())
                .collect(Collectors.toList());

        // 4. 현재 답안 미리보기: 가장 최근 answer_snapshot 1건 (없으면 Redis draft 최신 1건으로 폴백)
        ProctorStudentDetailResponse.CurrentAnswerPreview currentAnswerPreview =
                answerSnapshotRepository.findFirstByExamSessionIdOrderByCapturedAtDesc(session.getId())
                        .map(snap -> ProctorStudentDetailResponse.CurrentAnswerPreview.builder()
                                .questionId(snap.getQuestion().getId())
                                .questionDisplayOrder(snap.getQuestion().getDisplayOrder())
                                .answerText(snap.getAnswerText())
                                .selectedChoiceIds(snap.getSelectedChoiceIds() != null
                                        ? new java.util.LinkedHashSet<>(java.util.Arrays.asList(snap.getSelectedChoiceIds()))
                                        : null)
                                .build())
                        .orElseGet(() -> latestDraftPreview(sessionUuid));

        double score = attentionStore.getScore(exam.getId(), sessionUuid);

        return ProctorStudentDetailResponse.builder()
                .studentNumber(session.getStudentNumber())
                .studentName(session.getStudentName())
                .attentionScore(score)
                .attentionLevel(determineAttentionLevel(score))
                .signals(signalCounts)
                .avgVisibilityDurationMs(avgDuration)
                .recentEvents(recentEvents)
                .currentAnswerPreview(currentAnswerPreview)
                .build();
    }

    /** snapshot 없을 때만 호출. Redis draft Hash에서 첫 항목을 currentAnswerPreview 형식으로 변환. */
    private ProctorStudentDetailResponse.CurrentAnswerPreview latestDraftPreview(UUID sessionUuid) {
        String draftKey = "session:" + sessionUuid + ":drafts";
        Map<Object, Object> rawDrafts = stringRedisTemplate.opsForHash().entries(draftKey);
        if (rawDrafts.isEmpty()) return null;

        Map.Entry<Object, Object> entry = rawDrafts.entrySet().iterator().next();
        Long qId = Long.valueOf(String.valueOf(entry.getKey()));
        Integer displayOrder = questionRepository.findById(qId).map(Question::getDisplayOrder).orElse(null);
        try {
            Map<String, Object> draftMap = objectMapper.readValue(String.valueOf(entry.getValue()), new TypeReference<>() {});
            String text = draftMap.get("answerText") != null ? String.valueOf(draftMap.get("answerText")) : null;
            return ProctorStudentDetailResponse.CurrentAnswerPreview.builder()
                    .questionId(qId)
                    .questionDisplayOrder(displayOrder)
                    .answerText(text)
                    .build();
        } catch (JsonProcessingException e) {
            log.warn("[Redis draft 역직렬화 실패] Session: {}, Error: {}", sessionUuid, e.getMessage());
            return null;
        }
    }

    /** signals Hash 키 변환: visibility_lost → visibilityLost */
    private static String snakeToCamel(String snake) {
        if (snake == null || snake.indexOf('_') < 0) return snake;
        StringBuilder sb = new StringBuilder(snake.length());
        boolean upper = false;
        for (int i = 0; i < snake.length(); i++) {
            char c = snake.charAt(i);
            if (c == '_') { upper = true; continue; }
            sb.append(upper ? Character.toUpperCase(c) : c);
            upper = false;
        }
        return sb.toString();
    }

    /**
     * 백로그 18: 전체 시험 이벤트 피드
     */
    public ExamEventFeedResponse getExamEventFeed(UUID proctorToken, OffsetDateTime since, int limit) {
        Exam exam = examRepository.findByProctorToken(proctorToken)
                .orElseThrow(() -> new CustomException(ErrorCode.PROCTOR_TOKEN_INVALID));

        List<EventFeedItemResponse> events = eventLogRepository
                .findCheatingEventsByExam(exam.getId(), since, CHEATING_EVENT_TYPES, PageRequest.of(0, limit))
                .stream()
                .map(log -> EventFeedItemResponse.builder()
                        .id(log.getId())
                        .sessionUuid(log.getExamSession().getSessionUuid())
                        .studentNumber(log.getExamSession().getStudentNumber())
                        .type(log.getEventType())
                        .questionId(log.getQuestion() != null ? log.getQuestion().getId() : null)
                        .questionDisplayOrder(log.getQuestion() != null ? log.getQuestion().getDisplayOrder() : null)
                        .occurredAt(log.getOccurredAt())
                        .durationMs(log.getDurationMs() != null ? Long.valueOf(log.getDurationMs()) : null)
                        .payload(log.getPayload())
                        .build())
                .collect(Collectors.toList());

        return ExamEventFeedResponse.builder()
                .events(events)
                .build();
    }

    /**
     * 감독관 토큰으로 Exam ID를 조회합니다. (SSE 구독용)
     */
    public Long getExamIdByToken(UUID proctorToken) {
        return examRepository.findByProctorToken(proctorToken)
                .map(Exam::getId)
                .orElseThrow(() -> new CustomException(ErrorCode.PROCTOR_TOKEN_INVALID));
    }

    private String determineAttentionLevel(double score) {
        if (score >= 4.0) return "HIGH";
        if (score >= 2.0) return "MID";
        if (score >= 1.0) return "LOW";
        return "NORMAL";
    }
}