package com.example.veriproof.domain.exam.dto;

import jakarta.validation.constraints.Future;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.OffsetDateTime;
import java.util.List;

public record Request(
        @NotBlank @Size(min = 1, max = 200) String title,
        @NotNull OffsetDateTime startsAt,
        @NotNull @Future OffsetDateTime endsAt,
        @NotEmpty List<QuestionDto> questions,
        List<RosterDto> roster
) {
    public record QuestionDto(
            @NotBlank String questionType, // "SUBJECTIVE" or "MULTIPLE_CHOICE"
            @NotBlank String body,
            String correctAnswer,
            @NotNull Integer points,
            @NotNull Integer displayOrder,
            List<ChoiceDto> choices
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
}