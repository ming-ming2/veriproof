package com.example.veriproof.domain.exam.entity;

import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Table(name = "exam_session",
        uniqueConstraints = @UniqueConstraint(name = "session_unique_per_student",
                columnNames = {"exam_id", "student_number"}))
public class ExamSession {

    public static final String STATUS_IN_PROGRESS = "IN_PROGRESS";
    public static final String STATUS_SUBMITTED = "SUBMITTED";
    public static final String STATUS_EXPIRED = "EXPIRED";

    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "session_uuid", nullable = false, unique = true)
    private UUID sessionUuid;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "exam_id", nullable = false)
    private Exam exam;

    @Column(name = "student_number", nullable = false)
    private String studentNumber;

    @Column(name = "student_name", nullable = false)
    private String studentName;

    @Column(nullable = false)
    private String status; // 'IN_PROGRESS', 'SUBMITTED', 'EXPIRED'

    @Column(name = "total_score")
    private Integer totalScore;

    @Column(name = "started_at", nullable = false, updatable = false)
    private OffsetDateTime startedAt;

    @Column(name = "submitted_at")
    private OffsetDateTime submittedAt;

    @Builder
    public ExamSession(Exam exam, String studentNumber, String studentName) {
        this.sessionUuid = UUID.randomUUID();
        this.exam = exam;
        this.studentNumber = studentNumber;
        this.studentName = studentName;
        this.status = STATUS_IN_PROGRESS;
        this.totalScore = 0;
        this.startedAt = OffsetDateTime.now();
    }

    /**
     * 동일 학번의 새 기기가 응시를 시작하는 시점에 호출. 기존 sessionUuid는 무효화된다.
     * 호출 전에 다른 기기가 Redis lock을 들고 있지 않은지(=30초 grace 만료) 반드시 검증해야 한다.
     */
    public void regenerateSessionUuid() {
        this.sessionUuid = UUID.randomUUID();
    }

    /**
     * 학생이 답안을 제출한 시점에 호출. 상태 전이 + 채점 결과 반영.
     */
    public void submit(int totalScore) {
        this.status = STATUS_SUBMITTED;
        this.submittedAt = OffsetDateTime.now();
        this.totalScore = totalScore;
    }

    // 채점결과 변동 시, 총점 변동
    public void updateTotalScore(int totalScore) {
        this.totalScore = totalScore;
    }

    public boolean isInProgress() {
        return STATUS_IN_PROGRESS.equals(this.status);
    }

    public boolean isSubmitted() {
        return STATUS_SUBMITTED.equals(this.status);
    }
}
