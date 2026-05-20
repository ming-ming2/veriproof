package com.example.veriproof.domain.proctor.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.util.List;

@Getter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ExamEventFeedResponse {
    private List<EventFeedItemResponse> events;
}