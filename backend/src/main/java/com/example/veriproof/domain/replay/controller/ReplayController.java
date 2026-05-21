package com.example.veriproof.domain.replay.controller;

import com.example.veriproof.domain.replay.dto.ReplayResponse;
import com.example.veriproof.domain.replay.service.ReplayService;
import com.example.veriproof.global.common.ApiResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "Replay", description = "종료된 시험 답안 재생 API (백로그 15)")
@RestController
@RequestMapping("/api/v1/exams")
@RequiredArgsConstructor
public class ReplayController {

    private final ReplayService replayService;

    @Operation(summary = "답안 재생 데이터 일괄 조회",
            description = "교수가 본인이 개설한 시험의 SUBMITTED 세션에 대해 timeline + snapshots 일괄 반환. " +
                    "t = startedAt 기준 상대 ms.")
    @GetMapping("/{examId}/sessions/{sessionId}/replay")
    public ResponseEntity<ApiResponse<ReplayResponse>> getReplay(
            @AuthenticationPrincipal Long professorId,
            @PathVariable Long examId,
            @PathVariable Long sessionId) {

        return ResponseEntity.ok(ApiResponse.success(
                replayService.getReplay(professorId, examId, sessionId)));
    }
}
