package com.example.veriproof.domain.exam.controller;

import com.example.veriproof.domain.exam.dto.Request;
import com.example.veriproof.domain.exam.dto.Response;
import com.example.veriproof.domain.exam.service.ExamService;
import com.example.veriproof.domain.exam.service.GradingService;
import com.example.veriproof.domain.exam.service.ImageUploadService;
import com.example.veriproof.global.common.ApiResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.http.MediaType;

import java.util.List;

@Tag(name = "Exam", description = "시험 관련 API (개설, 조회 등)")
@RestController
@RequestMapping("/api/v1/exams")
@RequiredArgsConstructor
public class ExamController {

    private final ExamService examService;
    private final ImageUploadService imageUploadService;
    private final GradingService gradingService;

    @Operation(summary = "시험 개설", description = "새로운 시험을 생성하고 6자리 코드 및 감독관 링크를 발급합니다.")
    @PostMapping
    public ResponseEntity<ApiResponse<Response.ExamCreateResponse>> createExam(
            // 수정됨: JwtAuthenticationToken 객체 대신 Principal 값인 Long 타입을 직접 주입받음
            @AuthenticationPrincipal Long professorId,
            @RequestBody @Valid Request request) {

        // 비즈니스 로직은 Service 계층으로 전적으로 위임
        Response.ExamCreateResponse response = examService.createExam(professorId, request);

        // API 명세서에 따른 201 응답 처리[cite: 1]
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success(response));
    }

    @Operation(summary = "시험 목록 조회", description = "로그인한 교수가 개설한 시험 목록을 조회합니다.")
    @GetMapping
    public ResponseEntity<ApiResponse<List<Response.ExamListResponse>>> getExams(
            @AuthenticationPrincipal Long professorId) { // 수정됨

        List<Response.ExamListResponse> response = examService.getExamsByProfessor(professorId);

        // API 명세서에 따른 200 응답 처리[cite: 1]
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @Operation(summary = "문항 이미지 첨부", description = "특정 문항에 이미지를 업로드합니다 (최대 5MB).")
    @PostMapping(value = "/{examId}/questions/{questionId}/images", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<ApiResponse<Response.ImageUploadResponse>> uploadImage(
            @AuthenticationPrincipal Long professorId,
            @PathVariable Long examId,
            @PathVariable Long questionId,
            @RequestParam(value = "file") MultipartFile file) {

        Response.ImageUploadResponse response = imageUploadService.uploadQuestionImage(
                professorId, examId, questionId, file
        );

        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success(response));
    }

    @Operation(summary = "시험 상세 조회", description = "시험 정보, 문항, 학생 세션 목록을 조회합니다.")
    @GetMapping("/{examId}")
    public ResponseEntity<ApiResponse<Response.ExamDetailResponse>> getExamDetail(
            @AuthenticationPrincipal Long professorId, // 수정됨
            @PathVariable Long examId) {

        Response.ExamDetailResponse response = examService.getExamDetail(professorId, examId);

        // API 명세서에 따른 200 응답 처리[cite: 1]
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @Operation(summary = "시험 수정",
            description = "시험 정보, 문항, 응시 명단을 일괄 갱신합니다. 이미 응시자가 1명이라도 있는 경우 수정할 수 없습니다.")
    @PutMapping("/{examId}")
    public ResponseEntity<ApiResponse<Response.ExamDetailResponse>> updateExam(
            @AuthenticationPrincipal Long professorId,
            @PathVariable Long examId,
            @RequestBody @Valid Request request) {

        Response.ExamDetailResponse response = examService.updateExam(professorId, examId, request);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @Operation(summary = "시험 삭제",
            description = "시험과 모든 하위 데이터(문항/선택지/이미지/명단)를 삭제합니다. 이미 응시자가 1명이라도 있는 경우 삭제할 수 없습니다.")
    @DeleteMapping("/{examId}")
    public ResponseEntity<Void> deleteExam(
            @AuthenticationPrincipal Long professorId,
            @PathVariable Long examId) {

        examService.deleteExam(professorId, examId);
        return ResponseEntity.noContent().build();
    }

    @Operation(summary = "주관식 채점", description = "교수가 학생의 주관식 답안에 점수를 부여합니다.")
    @PutMapping("/{examId}/sessions/{sessionId}/questions/{questionId}/grade")
    public ResponseEntity<ApiResponse<Void>> gradeAnswer(
            @AuthenticationPrincipal Long professorId,
            @PathVariable Long sessionId,
            @PathVariable Long questionId,
            @RequestBody Request.GradingRequest request) {

        gradingService.gradeSubjectiveAnswer(professorId, sessionId, questionId, request.earnedScore());

        return ResponseEntity.ok(ApiResponse.success(null));
    }
}