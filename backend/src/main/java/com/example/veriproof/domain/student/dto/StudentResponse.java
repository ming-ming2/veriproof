package com.example.veriproof.domain.student.dto;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Set;

/**
 * 학생 응시 흐름에서 사용하는 응답 DTO 모음.
 * 모든 필드에서 정답 정보(Question.correctAnswer, QuestionChoice.isCorrect)는 의도적으로 제외.
 */
public class StudentResponse {

    public record ExamLookupResponse(
            Long examId,
            String title,
            OffsetDateTime startsAt,
            OffsetDateTime endsAt,
            int questionCount
    ) {}

    public record SessionStartResponse(
            String sessionToken,           // sessionUuid 그대로 (X-Session-Token 헤더로 후속 호출)
            String examTitle,
            OffsetDateTime startsAt,
            OffsetDateTime endsAt,
            List<StudentQuestionDto> questions
    ) {}

    public record StudentQuestionDto(
            Long id,
            String questionType,           // SUBJECTIVE | MULTIPLE_CHOICE
            String body,
            Integer points,
            Integer displayOrder,
            List<StudentImageDto> images,
            List<StudentChoiceDto> choices // SUBJECTIVE면 빈 리스트
    ) {}

    public record StudentChoiceDto(
            Long id,
            String body,
            Integer displayOrder
            // isCorrect 노출 금지
    ) {}

    public record StudentImageDto(
            Long id,
            String fileUrl
    ) {}

    /**
     * 재접속 시 학생이 호출하는 GET /sessions/me 응답.
     * 세션 메타 + 작성 중인 모든 답안 초안을 한 번에 반환.
     */
    public record SessionMeResponse(
            String sessionToken,
            Long examId,
            String examTitle,
            OffsetDateTime startsAt,
            OffsetDateTime endsAt,
            String status,
            List<StudentQuestionDto> questions,
            List<AnswerDraftDto> drafts
    ) {}

    public record AnswerDraftDto(
            Long questionId,
            String answerText,
            Set<Long> selectedChoiceIds
    ) {}

    /**
     * 제출 완료 응답. 객관식 자동 채점 결과까지 반영된 총점을 포함.
     * 주관식이 포함된 시험에서는 교수 채점 후 총점이 갱신될 수 있다.
     */
    public record SubmitResponse(
            String sessionToken,
            String status,
            Integer totalScore,
            OffsetDateTime submittedAt
    ) {}
}
