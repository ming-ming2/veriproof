package com.example.veriproof.domain.exam.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Table(name = "exam_roster")
public class ExamRoster {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Setter
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "exam_id", nullable = false)
    private Exam exam;

    @Column(name = "student_number", nullable = false, length = 50)
    private String studentNumber;

    @Column(name = "student_name", nullable = false, length = 100)
    private String studentName;

    @Builder
    public ExamRoster(String studentNumber, String studentName) {
        this.studentNumber = studentNumber;
        this.studentName = studentName;
    }
}