package com.example.veriproof.domain.event.dto;

import com.fasterxml.jackson.databind.JsonNode;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Set;

/**
 * 학생 배치 이벤트 + 답안 스냅샷 묶음 요청 (백로그 14).
 * 클라이언트는 60초 단위로 누적해 전송. 제출 직전 잔여분도 동일 페이로드로 함께 flush.
 *
 * 지원 event type: KEYSTROKE, CHOICE_CHANGE, QUESTION_NAVIGATE
 *
 * CHOICE_CHANGE 도착 시 서버가 직전 5초 내 VISIBILITY_RESTORED / FULLSCREEN_ENTER가
 * 있으면 SUSPICIOUS_CHOICE_CHANGE 파생 row를 추가 생성하고 점수 +1.
 */
public record EventBatchRequest(
        @NotNull OffsetDateTime batchPeriodStart,
        @NotNull OffsetDateTime batchPeriodEnd,
        @Valid List<EventItem> events,
        @Valid List<SnapshotItem> snapshots
) {

    public record EventItem(
            @NotBlank String type,
            @NotNull OffsetDateTime occurredAt,
            Long questionId,
            JsonNode payload
    ) {}

    public record SnapshotItem(
            @NotNull Long questionId,
            @NotNull OffsetDateTime capturedAt,
            String answerText,
            Set<Long> selectedChoiceIds
    ) {}
}
