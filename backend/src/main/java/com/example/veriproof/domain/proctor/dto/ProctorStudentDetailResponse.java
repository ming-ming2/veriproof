package com.example.veriproof.domain.proctor.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Builder;
import lombok.Getter;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Getter
@Builder
@JsonInclude(JsonInclude.Include.NON_NULL)
public class ProctorStudentDetailResponse {
    private String studentNumber;
    private String studentName;
    private double attentionScore;
    private String attentionLevel;
    private Map<String, Integer> signals;
    private Long avgVisibilityDurationMs;
    private List<RecentEventItem> recentEvents;
    private CurrentAnswerPreview currentAnswerPreview;

    @Getter
    @Builder
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class RecentEventItem {
        private String type;
        private Long questionId;
        private OffsetDateTime occurredAt;
        private Integer durationMs;
    }

    @Getter
    @Builder
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class CurrentAnswerPreview {
        private Long questionId;
        private String answerText;
        private Set<Long> selectedChoiceIds;
    }
}
