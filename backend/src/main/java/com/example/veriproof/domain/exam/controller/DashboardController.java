package com.example.veriproof.domain.exam.controller;

import com.example.veriproof.domain.exam.dto.Response;
import com.example.veriproof.domain.exam.service.ExamService;
import com.example.veriproof.global.common.ApiResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@Tag(name = "Exam", description = "시험 관련 API (개설, 조회 등)")
@RestController
@RequestMapping("/api/v1/dashboard")
@RequiredArgsConstructor
public class DashboardController {
    private final ExamService examService;

    @Operation(summary = "시험 목록 조회", description = "로그인한 교수가 개설한 시험 목록을 조회합니다.")
    @GetMapping
    public ResponseEntity<ApiResponse<List<Response.ExamListResponse>>> getExams(
            @AuthenticationPrincipal Long professorId) { // 수정됨


        List<Response.ExamListResponse> response = examService.getExamsByProfessor(professorId);

        // API 명세서에 따른 200 응답 처리[cite: 1]
        return ResponseEntity.ok(ApiResponse.success(response));
    }
}
