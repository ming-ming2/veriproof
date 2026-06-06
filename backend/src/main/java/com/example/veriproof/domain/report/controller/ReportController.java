package com.example.veriproof.domain.report.controller;

import com.example.veriproof.domain.report.dto.ReportResponseDto;
import com.example.veriproof.domain.report.service.ReportService;
import com.example.veriproof.global.common.ApiResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@Tag(name = "Report", description = "사후 분석 리포트 API")
@RestController
@RequestMapping("/api/v1/exams")
@RequiredArgsConstructor
public class ReportController {

    private final ReportService reportService;

    @Operation(summary = "시험 사후 리포트 조회",
            description = "시험 종료 시각 이후 전체적인 통계 및 학생들의 주목도 기반 목록을 조회합니다.")
    @GetMapping("/{examId}/report")
    public ResponseEntity<ApiResponse<ReportResponseDto>> getExamReport(
            @AuthenticationPrincipal Long professorId,
            @PathVariable Long examId) {

        ReportResponseDto report = reportService.generateReport(professorId, examId);
        return ResponseEntity.ok(ApiResponse.success(report));
    }
}