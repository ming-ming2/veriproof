package com.example.veriproof.domain.proctor.controller;

import com.example.veriproof.domain.event.service.EventBroadcaster;
import com.example.veriproof.domain.proctor.dto.*;
import com.example.veriproof.domain.proctor.service.ProctorService;
import com.example.veriproof.global.common.ApiResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

@Tag(name = "Proctor (시험 감독관 대시보드 API)", description = "백로그 16, 17, 18 실시간 모니터링 관련 API 명세")
@RestController
@RequestMapping("/api/v1/proctor") // 명세에 맞게 /api/v1 추가
@RequiredArgsConstructor
public class ProctorController {

    private final ProctorService proctorService;
    private final EventBroadcaster eventBroadcaster;

    /**
     * 백로그 16-1: 대시보드 상단 메타 정보 조회
     */
    @Operation(summary = "대시보드 상단 메타 정보 조회")
    @GetMapping("/exams/{proctorToken}/meta")
    public ResponseEntity<ApiResponse<ExamDashboardMetaResponse>> getDashboardMeta(
            @PathVariable UUID proctorToken) {
        ExamDashboardMetaResponse data = proctorService.getDashboardMeta(proctorToken);
        return ResponseEntity.ok(ApiResponse.success(data));
    }

    /**
     * 백로그 16-2 & 17: 대시보드 실시간 학생 카드 목록 조회 (정렬 포함)
     */
    @Operation(summary = "실시간 응시 학생 카드 목록 조회")
    @GetMapping("/exams/{proctorToken}/students")
    public ResponseEntity<ApiResponse<List<ProctorStudentCardResponse>>> getStudentCards(
            @PathVariable UUID proctorToken,
            @RequestParam(name = "sort", defaultValue = "attentionScore") String sort) {
        List<ProctorStudentCardResponse> data = proctorService.getStudentCards(proctorToken, sort);
        return ResponseEntity.ok(ApiResponse.success(data));
    }

    /**
     * 백로그 17: 우측 학생 상세 정보 패널 통합 조회
     */
    @Operation(summary = "우측 학생 상세 정보 패널 조회")
    @GetMapping("/exams/{proctorToken}/students/{sessionUuid}")
    public ResponseEntity<ApiResponse<ProctorStudentDetailResponse>> getStudentDetail(
            @PathVariable UUID proctorToken,
            @PathVariable UUID sessionUuid) {
        ProctorStudentDetailResponse data = proctorService.getStudentDetail(proctorToken, sessionUuid);
        return ResponseEntity.ok(ApiResponse.success(data));
    }

    /**
     * 백로그 18: 전체 시험 실시간 이벤트 피드
     */
    @Operation(summary = "전체 시험 실시간 이벤트 피드 조회")
    @GetMapping("/exams/{proctorToken}/feed")
    public ResponseEntity<ApiResponse<ExamEventFeedResponse>> getExamEventFeed(
            @PathVariable UUID proctorToken,
            @RequestParam(name = "since", required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) OffsetDateTime since,
            @RequestParam(name = "limit", defaultValue = "50") int limit) {

        if (since == null) {
            since = OffsetDateTime.now().minusHours(1);
        }

        ExamEventFeedResponse data = proctorService.getExamEventFeed(proctorToken, since, limit);
        return ResponseEntity.ok(ApiResponse.success(data));
    }

    /**
     * 백로그 17 (핵심): 실시간 1초 갱신을 위한 SSE 스트림 구독 엔드포인트
     */
    @Operation(summary = "실시간 상태 갱신 스트림 (SSE 구독)", description = "학생 이벤트 발생 및 점수 변동 시 실시간으로 데이터를 푸시받는 채널입니다.")
    @GetMapping(value = "/exams/{proctorToken}/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public ResponseEntity<SseEmitter> subscribeToEventStream(@PathVariable UUID proctorToken) {
        // 1. 토큰 유효성 검증 및 시험 ID 추출
        Long examId = proctorService.getExamIdByToken(proctorToken);

        // 2. 구독 로직 연결 (이후 학생이 이벤트를 발생시키면 이 Emitter를 통해 자동 전송됨)
        SseEmitter emitter = eventBroadcaster.subscribe(examId);

        return ResponseEntity.ok(emitter);
    }
}