package com.example.veriproof.domain.exam.service;

import com.example.veriproof.domain.exam.entity.ExamSession;
import com.example.veriproof.domain.exam.entity.QuestionType;
import com.example.veriproof.domain.exam.entity.SubmissionAnswer;
import com.example.veriproof.domain.exam.repository.SubmissionAnswerRepository;
import com.example.veriproof.global.exception.CustomException;
import com.example.veriproof.global.exception.ErrorCode;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class GradingService {

    private final SubmissionAnswerRepository answerRepository;

    @Transactional
    public void gradeSubjectiveAnswer(Long professorId, Long sessionId, Long questionId, Integer score) {
        // 1. 답안 조회
        SubmissionAnswer answer = answerRepository.findByExamSessionIdAndQuestionId(sessionId, questionId)
                .orElseThrow(() -> new CustomException(ErrorCode.ANSWER_NOT_FOUND));

        ExamSession session = answer.getExamSession();

        // 2. 권한 검증: 로그인한 교수의 시험인지 확인
        if (!session.getExam().getProfessor().getId().equals(professorId)) {
            throw new CustomException(ErrorCode.FORBIDDEN);
        }

        // 3. 상태 검증: 제출 완료된 답안인지 확인
        if (!session.isSubmitted()) {
            throw new CustomException(ErrorCode.SESSION_NOT_SUBMITTED);
        }

        // 4. 타입 검증: 대상이 주관식 문항인지 확인
        if (answer.getQuestion().getQuestionType() != QuestionType.SUBJECTIVE) {
            throw new CustomException(ErrorCode.NOT_SUBJECTIVE_QUESTION);
        }

        // 5. 배점 한도 검증: 만점을 초과하는지 확인
        int maxPoints = answer.getQuestion().getPoints();
        if (score > maxPoints) {
            throw new CustomException(ErrorCode.INVALID_SCORE);
        }

        // 6. 점수 반영 (엔티티 상태 변경)
        answer.updateScore(score);

        // 7. 변경된 점수를 바탕으로 세션 총점 재계산 (파라미터로 session 객체를 바로 넘김)
        updateSessionTotalScore(session);
    }

    private void updateSessionTotalScore(ExamSession session) {
        // 해당 세션의 모든 문항 점수 합산 (객관식 자동채점 점수 + 이번에 갱신된 주관식 점수)
        int total = answerRepository.findAllByExamSessionId(session.getId()).stream()
                .mapToInt(SubmissionAnswer::getEarnedScore)
                .sum();

        // 총점 갱신 (기존에 ExamSession에 추가해둔 updateTotalScore 메서드 사용)
        session.updateTotalScore(total);
    }
}