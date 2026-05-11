package com.example.veriproof.domain.student.controller;

import com.example.veriproof.domain.student.dto.StudentRequest;
import com.example.veriproof.domain.student.dto.StudentResponse;
import com.example.veriproof.domain.student.service.AnswerDraftService;
import com.example.veriproof.domain.student.service.StudentSessionService;
import com.example.veriproof.global.common.ApiResponse;
import com.example.veriproof.global.security.CurrentSession;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@Tag(name = "Student-Session", description = "학생 응시 세션 API (현재 세션 조회, 답안 초안 저장)")
@RestController
@RequestMapping("/api/v1/student/sessions/me")
@RequiredArgsConstructor
public class StudentSessionController {

    private final StudentSessionService studentSessionService;
    private final AnswerDraftService answerDraftService;

    @Operation(summary = "현재 세션 + 작성 중 답안 조회",
            description = "재접속 시 호출. 시험 메타·문항 + Redis에 저장된 답안 초안 일체 반환. (백로그 9)")
    @GetMapping
    public ResponseEntity<ApiResponse<StudentResponse.SessionMeResponse>> getMe(
            @CurrentSession UUID sessionUuid) {

        StudentResponse.SessionMeResponse response = studentSessionService.getSessionMe(sessionUuid);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @Operation(summary = "답안 초안 저장",
            description = "단일 문항에 대한 답안을 Redis hash에 저장. 매 변경마다 호출되며 프론트는 1초 디바운스 권장. (백로그 9)")
    @PutMapping("/answers/{questionId}")
    public ResponseEntity<ApiResponse<Void>> saveDraft(
            @CurrentSession UUID sessionUuid,
            @PathVariable Long questionId,
            @RequestBody @Valid StudentRequest.AnswerDraftRequest request) {

        answerDraftService.saveDraft(sessionUuid, questionId, request);
        return ResponseEntity.noContent().build();
    }

    @Operation(summary = "답안 제출",
            description = "Redis 초안 → DB SubmissionAnswer flush + 객관식 자동 채점 + lock 해제. " +
                    "객관식은 정답 set 완전 일치 시 만점, 주관식은 0점(교수 채점 대기). (백로그 10)")
    @PostMapping("/submit")
    public ResponseEntity<ApiResponse<StudentResponse.SubmitResponse>> submit(
            @CurrentSession UUID sessionUuid) {

        StudentResponse.SubmitResponse response = studentSessionService.submit(sessionUuid);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @Operation(summary = "응시 활성 lock heartbeat",
            description = "클라이언트가 약 10초 주기로 호출하여 응시 활성 lock의 TTL(30초)을 갱신. " +
                    "끊기면 30초 후 자동 만료되어 본인/타인이 재접속 가능. (백로그 20)")
    @PostMapping("/heartbeat")
    public ResponseEntity<ApiResponse<Void>> heartbeat(@CurrentSession UUID sessionUuid) {
        studentSessionService.heartbeat(sessionUuid);
        return ResponseEntity.noContent().build();
    }
}
