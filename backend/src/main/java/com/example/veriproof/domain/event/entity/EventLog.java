package com.example.veriproof.domain.event.entity;

import com.example.veriproof.domain.exam.entity.Exam;
import com.example.veriproof.domain.exam.entity.ExamSession;
import com.example.veriproof.domain.exam.entity.Question;
import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.OffsetDateTime;

/**
 * 학생 응시 중 발생한 실시간 이벤트 로그 (V4, 백로그 13·14).
 *
 * 즉시 이벤트(PASTE, VISIBILITY_*, FULLSCREEN_*, CAPTURE_SHORTCUT, WINDOW_BLUR),
 * 배치 이벤트(KEYSTROKE, CHOICE_CHANGE, QUESTION_NAVIGATE),
 * 서버 파생 이벤트(SUSPICIOUS_CHOICE_CHANGE)를 한 테이블에 누적 저장한다.
 *
 * 페어링 (VISIBILITY_LOST/RESTORED, FULLSCREEN_EXIT/ENTER): 서비스 계층에서
 * 가장 가까운 미페어링 row를 찾아 RESTORED/ENTER 측의 {@code duration_ms}를 채운다.
 *
 * {@code exam_id}는 {@code exam_session.exam_id}로 도달 가능하지만, 감독관 이벤트 피드와
 * 사후 집계 쿼리에서 JOIN을 회피하기 위해 비정규화했다.
 */
@Entity
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
// 인덱스 정의는 V4 마이그레이션이 단일 출처(idx_event_session_time, idx_event_exam_time DESC, idx_event_type).
// @Index columnList에 DESC 키워드를 표현할 수 없어 엔티티에 중복 선언하지 않는다.
@Table(name = "event_log")
public class EventLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "exam_session_id", nullable = false)
    private ExamSession examSession;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "exam_id", nullable = false)
    private Exam exam;

    @Column(name = "event_type", nullable = false, length = 40)
    private String eventType;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "question_id")
    private Question question;

    @Column(name = "occurred_at", nullable = false)
    private OffsetDateTime occurredAt;

    @Column(name = "received_at", nullable = false, updatable = false)
    private OffsetDateTime receivedAt;

    @Column(name = "duration_ms")
    private Integer durationMs;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "payload", nullable = false, columnDefinition = "jsonb")
    private String payload;

    @Builder
    public EventLog(ExamSession examSession,
                    Exam exam,
                    String eventType,
                    Question question,
                    OffsetDateTime occurredAt,
                    Integer durationMs,
                    String payload) {
        this.examSession = examSession;
        this.exam = exam;
        this.eventType = eventType;
        this.question = question;
        this.occurredAt = occurredAt;
        this.receivedAt = OffsetDateTime.now();
        this.durationMs = durationMs;
        this.payload = payload != null ? payload : "{}";
    }

    /**
     * 페어링된 LOST/EXIT row의 시각으로부터 계산한 지속시간을 RESTORED/ENTER row에 기록.
     * 페어링 누락(브라우저 강제 종료 등) 시 null 유지.
     */
    public void recordPairedDuration(int durationMs) {
        this.durationMs = durationMs;
    }
}
