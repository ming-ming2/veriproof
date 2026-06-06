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
    private Integer seatNumber;   // 백로그 25: 좌석 번호 (1-based), 좌석 미사용 시 null
    private Long currentQuestionId;
    private OffsetDateTime lastActivityAt;
    private double attentionScore;
    private String attentionLevel; // HIGH, MID, LOW, NORMAL
    private String status;
}