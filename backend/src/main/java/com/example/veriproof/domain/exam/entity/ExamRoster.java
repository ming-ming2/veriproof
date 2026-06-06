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

    // 좌석 배치(백로그 25): 이름순 정렬 후 1부터 배정. 좌석 미사용 시 NULL.
    @Column(name = "seat_number")
    private Integer seatNumber;

    @Builder
    public ExamRoster(String studentNumber, String studentName) {
        this.studentNumber = studentNumber;
        this.studentName = studentName;
    }

    public void assignSeatNumber(Integer seatNumber) {
        this.seatNumber = seatNumber;
    }
}