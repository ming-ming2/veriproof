package com.example.veriproof.domain.exam.entity;

import jakarta.persistence.*;
import lombok.*;

import java.util.ArrayList;
import java.util.List;

@Entity
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Table(name = "question")
public class Question {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Setter // 연관관계 편의 메서드를 위함
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "exam_id", nullable = false)
    private Exam exam;

    @Enumerated(EnumType.STRING)
    @Column(name = "question_type", nullable = false, length = 20)
    private QuestionType questionType;

    @Column(columnDefinition = "TEXT", nullable = false)
    private String body;

    @Column(name = "correct_answer", columnDefinition = "TEXT")
    private String correctAnswer;

    @Column(nullable = false)
    private Integer points;

    @Column(name = "display_order", nullable = false)
    private Integer displayOrder;

    @OneToMany(mappedBy = "question", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<QuestionChoice> choices = new ArrayList<>();

    @OneToMany(mappedBy = "question", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<QuestionImage> Images = new ArrayList<>();

    @Builder
    public Question(QuestionType questionType, String body, String correctAnswer, Integer points, Integer displayOrder) {
        this.questionType = questionType;
        this.body = body;
        this.correctAnswer = correctAnswer;
        this.points = points;
        this.displayOrder = displayOrder;
    }

    public void addChoice(QuestionChoice choice) {
        this.choices.add(choice);
        choice.setQuestion(this);
    }
}