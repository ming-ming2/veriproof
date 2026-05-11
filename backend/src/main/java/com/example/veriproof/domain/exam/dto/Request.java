package com.example.veriproof.domain.exam.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Future;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.time.OffsetDateTime;
import java.util.List;

public record Request(
        @NotBlank @Size(min = 1, max = 200) String title,
        @NotNull OffsetDateTime startsAt,
        @NotNull @Future OffsetDateTime endsAt,
        @NotEmpty @Valid List<QuestionDto> questions,
        @NotEmpty @Valid List<RosterDto> roster   // 백로그 1-4: 명단 최소 1명 필수
) {
    public record QuestionDto(
            @NotBlank
            @Pattern(regexp = "SUBJECTIVE|MULTIPLE_CHOICE", message = "questionType은 SUBJECTIVE 또는 MULTIPLE_CHOICE여야 합니다.")
            String questionType,
            @NotBlank String body,
            String correctAnswer,
            @NotNull @Min(value = 1, message = "배점은 1점 이상이어야 합니다.") Integer points,
            @NotNull Integer displayOrder,
            @Valid List<ChoiceDto> choices
    ) {}

    public record ChoiceDto(
            @NotBlank String body,
            @NotNull Boolean isCorrect,
            @NotNull Integer displayOrder
    ) {}

    public record RosterDto(
            @NotBlank String studentNumber,
            @NotBlank String studentName
    ) {}

    public record GradingRequest(
            @NotNull(message = "점수는 필수 입력 항목입니다.")
            @Min(value = 0, message = "점수는 0점 이상이어야 합니다.")
            Integer earnedScore
    ) {}
}
