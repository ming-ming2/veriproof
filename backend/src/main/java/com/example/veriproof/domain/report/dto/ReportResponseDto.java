package com.example.veriproof.domain.report.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Builder;
import lombok.Getter;
import java.time.OffsetDateTime;
import java.util.List;

@Getter
@Builder
@JsonInclude(JsonInclude.Include.NON_NULL)
public class ReportResponseDto {
    private final Long examId;
    private final String title;
    private final OffsetDateTime endsAt;

    private final Summary summary;
    private final SignalDistribution signalDistribution;
    private final SuspiciousPatterns suspiciousPatterns;
    private final List<StudentReportDto> students;

    @Getter @Builder
    public static class Summary {
        private final int rosterCount;
        private final int takerCount;
        private final int submittedCount;
        private final double avgScore;
        private final long avgDurationMs;
    }

    @Getter @Builder
    public static class SignalDistribution {
        private final long paste;
        private final long visibilityLost;
        private final long fullscreenExit;
        private final long captureShortcut;
        private final long suspiciousChoiceChange;
    }

    @Getter @Builder
    public static class SuspiciousPatterns {
        private final long choiceChangeAfterReturn;
        private final long pasteAfterReturn;
    }

    @Getter @Builder
    public static class StudentReportDto {
        private final Long sessionId;
        private final String sessionUuid;
        private final String studentNumber;
        private final String studentName;
        private final String status;
        private final Integer totalScore;
        private final Long durationMs;
        private final int attentionScore;
        private final String attentionLevel;
    }
}