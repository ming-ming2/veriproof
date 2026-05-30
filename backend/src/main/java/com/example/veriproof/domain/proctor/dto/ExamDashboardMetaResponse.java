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
    private Integer seatRows;   // 백로그 25: 좌석 배치 미사용 시 null
    private Integer seatCols;
}