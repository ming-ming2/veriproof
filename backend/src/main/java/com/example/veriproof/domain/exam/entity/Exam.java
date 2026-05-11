package com.example.veriproof.domain.exam.entity;

import com.example.veriproof.domain.auth.entity.Professor;
import com.example.veriproof.global.entity.BaseTimeEntity;
import jakarta.persistence.*;
import lombok.*;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Entity
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Table(name = "exam")
public class Exam extends BaseTimeEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "professor_id", nullable = false)
    private Professor professor;

    @Column(nullable = false, length = 200)
    private String title;

    @Column(name = "exam_code", nullable = false, unique = true, length = 6)
    private String examCode;

    @Column(name = "proctor_token", nullable = false, unique = true, updatable = false)
    private UUID proctorToken;

    @Column(name = "starts_at", nullable = false)
    private OffsetDateTime startsAt;

    @Column(name = "ends_at", nullable = false)
    private OffsetDateTime endsAt;

    // Cascade.ALL과 orphanRemoval=true를 통해 Exam 생명주기에 종속시킴
    @OneToMany(mappedBy = "exam", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<Question> questions = new ArrayList<>();

    @OneToMany(mappedBy = "exam", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<ExamRoster> rosters = new ArrayList<>();

    @Builder
    public Exam(Professor professor, String title, String examCode, OffsetDateTime startsAt, OffsetDateTime endsAt) {
        this.professor = professor;
        this.title = title;
        this.examCode = examCode;
        this.proctorToken = UUID.randomUUID(); // 애플리케이션 레벨에서 UUID 생성
        this.startsAt = startsAt;
        this.endsAt = endsAt;
    }

    // --- 연관관계 편의 메서드 ---
    public void addQuestion(Question question) {
        this.questions.add(question);
        question.setExam(this);
    }

    public void addRoster(ExamRoster roster) {
        this.rosters.add(roster);
        roster.setExam(this);
    }

    public void update(String title, OffsetDateTime startsAt, OffsetDateTime endsAt) {
        this.title = title;
        this.startsAt = startsAt;
        this.endsAt = endsAt;
    }
}