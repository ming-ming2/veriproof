package com.example.veriproof.domain.student.controller;

import com.example.veriproof.domain.student.dto.StudentRequest;
import com.example.veriproof.domain.student.dto.StudentResponse;
import com.example.veriproof.domain.student.service.StudentSessionService;
import com.example.veriproof.global.common.ApiResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

@Tag(name = "Student-Exam", description = "학생 응시 진입 API (코드 입력, 응시 시작)")
@RestController
@RequestMapping("/api/v1/student/exams")
@RequiredArgsConstructor
@Validated
public class StudentExamController {

    private final StudentSessionService studentSessionService;

    @Operation(summary = "시험 코드로 시험 메타 조회",
            description = "6자리 시험 코드로 제목·시작/종료 시각·문항 수를 조회합니다. (백로그 7)")
    @GetMapping("/lookup")
    public ResponseEntity<ApiResponse<StudentResponse.ExamLookupResponse>> lookup(
            @RequestParam("code")
            @NotBlank
            @Pattern(regexp = "^[A-Z0-9]{6}$", message = "시험 코드는 영문 대문자/숫자 6자리여야 합니다.")
            String code) {

        StudentResponse.ExamLookupResponse response = studentSessionService.lookupExam(code);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @Operation(summary = "응시 시작",
            description = "학번/이름 검증, 시간 검증, 동시접속 lock 획득 후 sessionUuid를 발급합니다. " +
                    "발급된 sessionToken은 후속 요청에서 X-Session-Token 헤더로 송신해야 합니다. (백로그 8, 20)")
    @PostMapping("/{examCode}/sessions")
    public ResponseEntity<ApiResponse<StudentResponse.SessionStartResponse>> startSession(
            @PathVariable
            @Pattern(regexp = "^[A-Z0-9]{6}$", message = "시험 코드는 영문 대문자/숫자 6자리여야 합니다.")
            String examCode,
            @RequestBody @Valid StudentRequest.SessionStartRequest request) {

        StudentResponse.SessionStartResponse response = studentSessionService.startSession(examCode, request);
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.success(response));
    }
}
