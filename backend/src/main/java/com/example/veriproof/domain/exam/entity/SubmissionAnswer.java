package com.example.veriproof.domain.exam.entity;

import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.OffsetDateTime;
import java.util.HashSet;
import java.util.Set;

/**
 * 학생이 제출한 단일 문항에 대한 답안.
 * 주관식: {@code answerText} 사용, {@code selectedChoices} 비움.
 * 객관식: {@code selectedChoices}로 다중 선택 표현, {@code answerText} 비움.
 * 객관식 자동 채점 결과 또는 교수가 부여한 점수가 {@code earnedScore}에 누적된다.
 */
@Entity
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Table(name = "submission_answer",
        uniqueConstraints = @UniqueConstraint(name = "answer_unique_per_question",
                columnNames = {"exam_session_id", "question_id"}))
public class SubmissionAnswer {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "exam_session_id", nullable = false)
    private ExamSession examSession;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "question_id", nullable = false)
    private Question question;

    @Column(name = "answer_text", columnDefinition = "TEXT")
    private String answerText;

    @Column(name = "earned_score", nullable = false)
    private Integer earnedScore;

    @Column(name = "submitted_at", nullable = false, updatable = false)
    private OffsetDateTime submittedAt;

    /**
     * V3 마이그레이션으로 생성된 join 테이블 매핑.
     * 객관식 다중 선택을 표현. join 테이블에 메타데이터가 없으므로 @ManyToMany로 충분.
     */
    @ManyToMany
    @JoinTable(
            name = "submission_answer_choice",
            joinColumns = @JoinColumn(name = "submission_answer_id"),
            inverseJoinColumns = @JoinColumn(name = "choice_id")
    )
    private Set<QuestionChoice> selectedChoices = new HashSet<>();

    @Builder
    public SubmissionAnswer(ExamSession examSession,
                            Question question,
                            String answerText,
                            Integer earnedScore,
                            Set<QuestionChoice> selectedChoices) {
        this.examSession = examSession;
        this.question = question;
        this.answerText = answerText;
        this.earnedScore = earnedScore != null ? earnedScore : 0;
        this.selectedChoices = selectedChoices != null ? selectedChoices : new HashSet<>();
        this.submittedAt = OffsetDateTime.now();
    }

    // 채점 결과 반영
    public void updateScore(int score) {
        this.earnedScore = score;
    }
}
