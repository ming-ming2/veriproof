package com.example.veriproof.domain.event.controller;

import com.example.veriproof.domain.event.dto.EventBatchRequest;
import com.example.veriproof.domain.event.dto.EventRequest;
import com.example.veriproof.domain.event.service.EventIngestService;
import com.example.veriproof.global.common.ApiResponse;
import com.example.veriproof.global.security.CurrentSession;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;

@Tag(name = "Student-Event", description = "학생 응시 중 실시간 이벤트 수집 API (백로그 13)")
@RestController
@RequestMapping("/api/v1/student/sessions/me/events")
@RequiredArgsConstructor
public class StudentEventController {

    private final EventIngestService eventIngestService;

    @Operation(summary = "즉시 이벤트 묶음 전송",
            description = "PASTE / VISIBILITY_LOST·RESTORED / FULLSCREEN_EXIT·ENTER / CAPTURE_SHORTCUT / WINDOW_BLUR. " +
                    "서버가 페어링 + 점수 갱신 + 감독관 SSE broadcast 처리.")
    @SecurityRequirement(name = "X-Session-Token") // 1️⃣ 스웨거 상단 자물쇠 인증과 이 API를 연동합니다.
    @PostMapping
    public ResponseEntity<ApiResponse<Void>> ingestEvents(
            @Parameter(hidden = true) @CurrentSession UUID sessionUuid, // 2️⃣ 스웨거 UI에서 쿼리 파라미터 창을 숨깁니다.
            @RequestBody @Valid EventRequest request) {

        eventIngestService.ingest(sessionUuid, request);
        return ResponseEntity.noContent().build();
    }

    @Operation(summary = "배치 이벤트 + 답안 스냅샷 전송",
            description = "KEYSTROKE / CHOICE_CHANGE / QUESTION_NAVIGATE + answer_snapshot 일괄 저장. ")
    @SecurityRequirement(name = "X-Session-Token") // 1️⃣ 여기도 자물쇠 연동
    @PostMapping("/batch")
    public ResponseEntity<ApiResponse<Void>> ingestBatch(
            @Parameter(hidden = true) @CurrentSession UUID sessionUuid, // 2️⃣ 여기도 쿼리 창 숨기기
            @RequestBody @Valid EventBatchRequest request) {

        eventIngestService.ingestBatch(sessionUuid, request);
        return ResponseEntity.noContent().build();
    }
}
