package com.example.veriproof.domain.event.entity;

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
 * 답안 1분 스냅샷 (V4, 백로그 14).
 *
 * 클라이언트가 60초 단위 배치 전송 시 함께 보내는 답안 상태를 append-only로 저장한다.
 * 사후 답안 재생(백로그 15)에서 임의 시점으로 점프할 때 가장 가까운 스냅샷을 초기 상태로 두고
 * event_log의 KEYSTROKE/CHOICE_CHANGE를 forward 재생하는 데 사용.
 *
 * Sprint 2 Redis draft와 역할 분리:
 *  - draft: 매 변경마다 덮어쓰기. 마지막 상태 1건. 자동 제출 백업.
 *  - snapshot: 1분에 1번 append. 시간순 누적. 재생용.
 */
@Entity
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
// 인덱스 정의는 V4 마이그레이션이 단일 출처(idx_snapshot_session_q_time).
@Table(name = "answer_snapshot")
public class AnswerSnapshot {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "exam_session_id", nullable = false)
    private ExamSession examSession;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "question_id", nullable = false)
    private Question question;

    @Column(name = "captured_at", nullable = false, updatable = false)
    private OffsetDateTime capturedAt;

    @Column(name = "answer_text", columnDefinition = "TEXT")
    private String answerText;

    @JdbcTypeCode(SqlTypes.ARRAY)
    @Column(name = "selected_choice_ids", columnDefinition = "bigint[]")
    private Long[] selectedChoiceIds;

    @Builder
    public AnswerSnapshot(ExamSession examSession,
                          Question question,
                          OffsetDateTime capturedAt,
                          String answerText,
                          Long[] selectedChoiceIds) {
        this.examSession = examSession;
        this.question = question;
        this.capturedAt = capturedAt;
        this.answerText = answerText;
        this.selectedChoiceIds = selectedChoiceIds;
    }
}
