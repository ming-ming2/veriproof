package com.example.veriproof.domain.proctor.dto;

import lombok.Builder;
import lombok.Getter;
import java.time.OffsetDateTime;

@Getter
@Builder
public class ExamDashboardMetaResponse {
    private Long examId;
    private String title;
    private OffsetDateTime startsAt;
    private OffsetDateTime endsAt;
    private int rosterCount;
    private int activeCount;
}