package com.example.veriproof.domain.exam.dto;

import java.time.OffsetDateTime;
import java.util.List;

public class Response{
    public record ExamCreateResponse(
        Long id,
        String examCode,
        String proctorLink,
        String qrCodeUrl,
        Integer questionCount
    ) {}

    public record ExamListResponse(
            Long id,
            String title,
            String examCode,
            OffsetDateTime startsAt,
            OffsetDateTime endsAt,
            int questionCount,           // 문항 수
            int registeredStudentCount   // 등록된 응시자 수
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
            String qrCodeUrl,
            List<QuestionDetailDto> questions,
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

    public record SessionDetailDto(
            String sessionUuid,
            String studentNumber,
            String studentName,
            String status,
            Integer totalScore,
            OffsetDateTime startedAt,
            OffsetDateTime submittedAt
    ) {}
}