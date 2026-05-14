package com.example.veriproof.domain.exam.dto;

import java.time.OffsetDateTime;
import java.util.List;

public class Response{
    public record ExamCreateResponse(
        Long id,
        String examCode,
        String proctorLink,
        Integer questionCount
    ) {}

    public record ExamListResponse(
            Long id,
            String title,
            String examCode,
            OffsetDateTime startsAt,
            OffsetDateTime endsAt,
            int questionCount,
            int rosterCount,    // 사전 등록된 명단 인원
            int takerCount      // 실제 응시(세션 생성) 학생 수
    ) {}

    public record ImageUploadResponse(
            Long imageId,
            String fileUrl,
            String originalName,
            Long sizeBytes
    ) {}

    public record ExamDetailResponse(
            Long id,
            String title,
            String examCode,
            OffsetDateTime startsAt,
            OffsetDateTime endsAt,
            String proctorLink,
            List<QuestionDetailDto> questions,
            List<RosterDetailDto> roster,        // 사전 응시 명단 (백로그 1-5 요구)
            List<SessionDetailDto> sessions
    ) {}

    public record QuestionDetailDto(
            Long id,
            String questionType,
            String body,
            Integer points,
            String correctAnswer, // 교수는 정답 데이터도 조회 가능
            Integer displayOrder,
            List<ImageDetailDto> images,
            List<ChoiceDetailDto> choices
    ) {}

    public record ImageDetailDto(
            Long id,
            String fileUrl
    ) {}

    public record ChoiceDetailDto(
            Long id,
            String body,
            Boolean isCorrect,    // 객관식 정답 여부
            Integer displayOrder
    ) {}

    public record RosterDetailDto(
            Long id,
            String studentNumber,
            String studentName
    ) {}

    public record SessionDetailDto(
            Long id,                        // 주관식 채점 엔드포인트의 path 파라미터로 사용
            String sessionUuid,
            String studentNumber,
            String studentName,
            String status,
            Integer totalScore,
            OffsetDateTime startedAt,
            OffsetDateTime submittedAt
    ) {}

    /**
     * 교수가 학생 한 명의 답안 전체를 조회할 때 사용하는 응답.
     * 백로그 11 (주관식 채점) UI에서 호출.
     */
    public record SessionAnswersResponse(
            Long sessionId,
            String studentNumber,
            String studentName,
            String status,
            Integer totalScore,
            OffsetDateTime submittedAt,
            List<AnswerDetailDto> answers
    ) {}

    public record AnswerDetailDto(
            Long questionId,
            String questionType,            // SUBJECTIVE | MULTIPLE_CHOICE
            String questionBody,
            Integer points,
            String correctAnswer,           // 주관식 참조용 정답 (null 가능)
            Integer earnedScore,
            String answerText,              // 주관식 학생 답안
            List<Long> selectedChoiceIds,   // 학생이 선택한 객관식 id
            List<ChoiceDetailDto> choices   // 객관식 선택지 (정답 표시 포함)
    ) {}
}
