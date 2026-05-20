package com.example.veriproof.domain.proctor.dto;

import lombok.Builder;
import lombok.Getter;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;

@Getter
@Builder
public class ProctorStudentDetailResponse {
    private String studentNumber;
    private String studentName;
    private double attentionScore;
    private String attentionLevel;
    private Map<String, Integer> signals;
    private Long avgVisibilityDurationMs;
    private List<RecentLogItem> recentLogs;
    private List<CurrentDraftItem> currentDrafts;

    @Getter
    @Builder
    public static class RecentLogItem {
        private String type;
        private Long questionId;
        private OffsetDateTime occurredAt;
    }

    @Getter
    @Builder
    public static class CurrentDraftItem {
        private Long questionId;
        private String answerText;
    }
}