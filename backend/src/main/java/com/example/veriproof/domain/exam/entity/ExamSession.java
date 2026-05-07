package com.example.veriproof.domain.exam.entity;

import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Table(name = "exam_session")
public class ExamSession {

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

    @Column(name = "started_at")
    private OffsetDateTime startedAt;

    @Column(name = "submitted_at")
    private OffsetDateTime submittedAt;
}