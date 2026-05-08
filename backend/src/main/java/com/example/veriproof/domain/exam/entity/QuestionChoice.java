package com.example.veriproof.domain.exam.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Table(name = "question_choice")
public class QuestionChoice {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Setter // 연관관계 편의 메서드를 위함
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "question_id", nullable = false)
    private Question question;

    @Column(columnDefinition = "TEXT", nullable = false)
    private String body;

    @Column(name = "is_correct", nullable = false)
    private Boolean isCorrect;

    @Column(name = "display_order", nullable = false)
    private Integer displayOrder;

    @Builder
    public QuestionChoice(String body, Boolean isCorrect, Integer displayOrder) {
        this.body = body;
        this.isCorrect = isCorrect != null ? isCorrect : false;
        this.displayOrder = displayOrder;
    }
}