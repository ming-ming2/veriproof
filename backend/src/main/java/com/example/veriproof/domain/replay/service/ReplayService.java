package com.example.veriproof.domain.replay.service;

import com.example.veriproof.domain.event.entity.AnswerSnapshot;
import com.example.veriproof.domain.event.entity.EventLog;
import com.example.veriproof.domain.event.repository.AnswerSnapshotRepository;
import com.example.veriproof.domain.event.repository.EventLogRepository;
import com.example.veriproof.domain.exam.entity.Exam;
import com.example.veriproof.domain.exam.entity.ExamSession;
import com.example.veriproof.domain.exam.entity.Question;
import com.example.veriproof.domain.exam.repository.ExamRepository;
import com.example.veriproof.domain.exam.repository.ExamSessionRepository;
import com.example.veriproof.domain.replay.dto.ReplayResponse;
import com.example.veriproof.global.exception.CustomException;
import com.example.veriproof.global.exception.ErrorCode;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.Arrays;
import java.util.Comparator;
import java.util.List;
import java.util.Map;

/**
 * 종료된 시험 세션의 답안 재생 데이터 빌더 (백로그 15).
 * event_log timeline + answer_snapshot 시점 데이터를 startedAt 기준 상대 ms(`t`)로 변환해 반환한다.
 */
@Service
@RequiredArgsConstructor
public class ReplayService {

    private static final TypeReference<Map<String, Object>> PAYLOAD_TYPE = new TypeReference<>() {};

    private final ExamRepository examRepository;
    private final ExamSessionRepository examSessionRepository;
    private final EventLogRepository eventLogRepository;
    private final AnswerSnapshotRepository answerSnapshotRepository;
    private final ObjectMapper objectMapper;

    @Transactional(readOnly = true)
    public ReplayResponse getReplay(Long professorId, Long examId, Long sessionId) {
        Exam exam = examRepository.findById(examId)
                .orElseThrow(() -> new CustomException(ErrorCode.EXAM_NOT_FOUND));
        if (!exam.getProfessor().getId().equals(professorId)) {
            throw new CustomException(ErrorCode.FORBIDDEN);
        }

        ExamSession session = examSessionRepository.findById(sessionId)
                .orElseThrow(() -> new CustomException(ErrorCode.SESSION_NOT_FOUND));
        if (!session.getExam().getId().equals(examId)) {
            throw new CustomException(ErrorCode.SESSION_NOT_FOUND);
        }
        if (!session.isSubmitted()) {
            throw new CustomException(ErrorCode.SESSION_NOT_SUBMITTED);
        }

        OffsetDateTime startedAt = session.getStartedAt();

        List<ReplayResponse.QuestionMeta> questions = exam.getQuestions().stream()
                .sorted(Comparator.comparingInt(Question::getDisplayOrder))
                .map(q -> new ReplayResponse.QuestionMeta(
                        q.getId(),
                        q.getQuestionType().name(),
                        q.getBody(),
                        q.getDisplayOrder(),
                        q.getPoints(),
                        q.getChoices().isEmpty() ? null : q.getChoices().stream()
                                .sorted(Comparator.comparingInt(c -> c.getDisplayOrder()))
                                .map(c -> new ReplayResponse.ChoiceMeta(c.getId(), c.getBody(), c.getDisplayOrder()))
                                .toList()))
                .toList();

        List<ReplayResponse.TimelineItem> timeline = eventLogRepository
                .findAllByExamSessionIdOrderByOccurredAtAscIdAsc(sessionId).stream()
                .map(e -> new ReplayResponse.TimelineItem(
                        relativeMs(startedAt, e.getOccurredAt()),
                        e.getEventType(),
                        e.getQuestion() != null ? e.getQuestion().getId() : null,
                        e.getDurationMs(),
                        parsePayload(e.getPayload())))
                .toList();

        List<ReplayResponse.SnapshotItem> snapshots = answerSnapshotRepository
                .findAllByExamSessionIdOrderByCapturedAtAsc(sessionId).stream()
                .map(s -> new ReplayResponse.SnapshotItem(
                        relativeMs(startedAt, s.getCapturedAt()),
                        s.getQuestion().getId(),
                        s.getAnswerText(),
                        toList(s.getSelectedChoiceIds())))
                .toList();

        return new ReplayResponse(
                session.getId(),
                session.getStudentNumber(),
                session.getStudentName(),
                exam.getTitle(),
                startedAt,
                session.getSubmittedAt(),
                questions,
                timeline,
                snapshots);
    }

    /** startedAt 기준 상대 ms. 음수면 0으로 클램프 (클라이언트 시계 skew 대비). */
    private long relativeMs(OffsetDateTime start, OffsetDateTime t) {
        long ms = Duration.between(start, t).toMillis();
        return Math.max(0L, ms);
    }

    private List<Long> toList(Long[] arr) {
        return (arr == null || arr.length == 0) ? null : Arrays.asList(arr);
    }

    /** event_log.payload(JSONB → String)를 Map으로 파싱. 손상 시 빈 Map. */
    private Map<String, Object> parsePayload(String json) {
        if (json == null || json.isBlank()) return Map.of();
        try {
            return objectMapper.readValue(json, PAYLOAD_TYPE);
        } catch (JsonProcessingException e) {
            return Map.of();
        }
    }
}
