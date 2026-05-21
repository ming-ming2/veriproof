package com.example.veriproof.domain.replay.dto;

import com.fasterxml.jackson.annotation.JsonInclude;

import java.time.OffsetDateTime;
import java.util.List;

/**
 * 답안 재생 응답 (백로그 15).
 * timeline은 event_log를 startedAt 기준 상대 ms(`t`)로 변환한 시간순 배열.
 * snapshots는 answer_snapshot의 시간순 배열.
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record ReplayResponse(
        Long sessionId,
        String studentNumber,
        String studentName,
        String examTitle,
        OffsetDateTime startedAt,
        OffsetDateTime submittedAt,
        List<QuestionMeta> questions,
        List<TimelineItem> timeline,
        List<SnapshotItem> snapshots
) {

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record QuestionMeta(
            Long id,
            String questionType,
            String body,
            Integer displayOrder,
            Integer points,
            List<ChoiceMeta> choices   // 객관식일 때만 채워짐. 프론트가 displayOrder로 "1번/2번" 라벨링.
    ) {}

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record ChoiceMeta(
            Long id,
            String body,
            Integer displayOrder
    ) {}

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record TimelineItem(
            Long t,
            String type,
            Long questionId,
            Integer durationMs,
            Object payload   // 파싱된 JSON 객체 (프론트가 e.payload.key 등으로 직접 접근)
    ) {}

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record SnapshotItem(
            Long t,
            Long questionId,
            String answerText,
            List<Long> selectedChoiceIds
    ) {}
}
