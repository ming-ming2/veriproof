package com.example.veriproof.domain.proctor.dto;

import lombok.Builder;
import lombok.Getter;
import java.time.OffsetDateTime;
import java.util.UUID;

@Getter
@Builder
public class EventFeedItemResponse {
    private Long id;
    private UUID sessionUuid;
    private String studentNumber;
    private String type;
    private Long questionId;
    private OffsetDateTime occurredAt;
    private Long durationMs;
    private Object payload;
}