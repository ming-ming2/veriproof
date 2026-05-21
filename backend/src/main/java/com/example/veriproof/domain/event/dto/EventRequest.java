package com.example.veriproof.domain.event.dto;

import com.fasterxml.jackson.databind.JsonNode;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;

import java.time.OffsetDateTime;
import java.util.List;

/**
 * 학생 즉시 이벤트 묶음 요청 (백로그 13).
 * 한 번의 요청에 여러 이벤트를 묶어 전송 가능 (예: VISIBILITY_LOST + 곧바로 VISIBILITY_RESTORED).
 *
 * 지원 type:
 *  PASTE, VISIBILITY_LOST, VISIBILITY_RESTORED,
 *  FULLSCREEN_EXIT, FULLSCREEN_ENTER,
 *  CAPTURE_SHORTCUT, WINDOW_BLUR
 *
 * 검증되지 않은 type은 서비스 계층에서 EVENT_TYPE_INVALID(400)로 차단된다.
 */
public record EventRequest(
        @NotEmpty @Valid List<EventItem> events
) {

    public record EventItem(
            @NotBlank String type,
            @NotNull OffsetDateTime occurredAt,
            Long questionId,
            JsonNode payload
    ) {}
}
