package com.example.veriproof.domain.proctor.dto;

import lombok.Builder;
import lombok.Getter;
import java.time.OffsetDateTime;

import java.util.UUID;

@Getter
@Builder
public class ProctorStudentCardResponse {
    private UUID sessionUuid;
    private String studentNumber;
    private String studentName;
    private Long currentQuestionId;
    private OffsetDateTime lastActivityAt;
    private double attentionScore;
    private String attentionLevel; // HIGH, MID, LOW, NORMAL
    private String status;
}