package com.example.veriproof.domain.student.service;

import com.example.veriproof.domain.exam.entity.Exam;
import com.example.veriproof.domain.exam.entity.ExamSession;
import com.example.veriproof.domain.exam.repository.ExamSessionRepository;
import com.example.veriproof.domain.exam.repository.QuestionRepository;
import com.example.veriproof.domain.student.dto.StudentRequest;
import com.example.veriproof.global.exception.CustomException;
import com.example.veriproof.global.exception.ErrorCode;
import com.example.veriproof.infra.redis.AnswerDraft;
import com.example.veriproof.infra.redis.AnswerDraftStore;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * 응시 중 작성 답안의 초안 저장/조회 책임.
 * 실제 저장은 Redis hash(={@link AnswerDraftStore}). 본 서비스는 세션/문항 검증만 담당.
 */
@Service
@RequiredArgsConstructor
public class AnswerDraftService {

    private final ExamSessionRepository examSessionRepository;
    private final QuestionRepository questionRepository;
    private final AnswerDraftStore answerDraftStore;

    /**
     * 답안 초안 저장. 백로그 9.
     * 1) 세션이 IN_PROGRESS인지
     * 2) 시험 종료 시각을 넘기지 않았는지
     * 3) 문항이 해당 시험에 속하는지 (위조 방지)
     * 모두 통과하면 Redis hash에 단일 문항 단위로 저장.
     */
    @Transactional(readOnly = true)
    public void saveDraft(UUID sessionUuid, Long questionId, StudentRequest.AnswerDraftRequest request) {
        ExamSession session = requireActiveSession(sessionUuid);
        Exam exam = session.getExam();

        if (OffsetDateTime.now().isAfter(exam.getEndsAt())) {
            throw new CustomException(ErrorCode.EXAM_ENDED);
        }

        // 다른 시험 문항으로 위조 시도 차단
        questionRepository.findByIdAndExamId(questionId, exam.getId())
                .orElseThrow(() -> new CustomException(ErrorCode.QUESTION_NOT_IN_EXAM));

        AnswerDraft draft = new AnswerDraft(request.answerText(), request.selectedChoiceIds());
        answerDraftStore.save(sessionUuid, questionId, draft, exam.getEndsAt());
    }

    private ExamSession requireActiveSession(UUID sessionUuid) {
        ExamSession session = examSessionRepository.findBySessionUuid(sessionUuid)
                .orElseThrow(() -> new CustomException(ErrorCode.SESSION_NOT_FOUND));
        if (session.isSubmitted()) {
            throw new CustomException(ErrorCode.SESSION_ALREADY_SUBMITTED);
        }
        return session;
    }
}
