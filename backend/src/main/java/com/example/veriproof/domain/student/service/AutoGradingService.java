package com.example.veriproof.domain.student.service;

import com.example.veriproof.domain.exam.entity.Question;
import com.example.veriproof.domain.exam.entity.QuestionChoice;
import com.example.veriproof.domain.exam.entity.QuestionType;
import com.example.veriproof.infra.redis.AnswerDraft;
import org.springframework.stereotype.Component;

import java.util.Set;
import java.util.stream.Collectors;

/**
 * 객관식 자동 채점.
 * 백로그 10 정책: 정답 선택지 집합과 학생이 선택한 집합이 <b>완전히 일치</b>해야 만점, 아니면 0점.
 * 부분 점수 없음. 주관식은 자동 채점 대상이 아니며 교수가 후속으로 채점한다(백로그 11).
 */
@Component
public class AutoGradingService {

    /**
     * @return 객관식 정답 선택지 id set
     */
    public Set<Long> correctChoiceIds(Question question) {
        return question.getChoices().stream()
                .filter(c -> Boolean.TRUE.equals(c.getIsCorrect()))
                .map(QuestionChoice::getId)
                .collect(Collectors.toSet());
    }

    /**
     * 단일 문항 채점.
     * 객관식이 아니면 항상 0 (수동 채점 대기).
     */
    public int gradeQuestion(Question question, AnswerDraft draft) {
        if (question.getQuestionType() != QuestionType.MULTIPLE_CHOICE) {
            return 0;
        }

        Set<Long> correctIds = correctChoiceIds(question);
        Set<Long> selectedIds = (draft != null && draft.selectedChoiceIds() != null)
                ? draft.selectedChoiceIds()
                : Set.of();

        return correctIds.equals(selectedIds) ? question.getPoints() : 0;
    }
}
