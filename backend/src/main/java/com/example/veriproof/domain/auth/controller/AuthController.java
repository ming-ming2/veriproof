package com.example.veriproof.domain.auth.controller;

// 1. 내부 도메인 및 글로벌 설정 Import
import com.example.veriproof.domain.auth.dto.AuthRequest.LoginRequest;
import com.example.veriproof.domain.auth.dto.AuthRequest.SignupRequest;
import com.example.veriproof.domain.auth.dto.AuthResponse.LoginResponse;
import com.example.veriproof.domain.auth.dto.AuthResponse.ProfessorResponse;
import com.example.veriproof.domain.auth.service.AuthService;
import com.example.veriproof.global.common.ApiResponse;

// 2. 외부 프레임워크 (Jakarta Validation, Lombok, Spring Web) Import
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@Tag(name = "Auth", description = "인증 관련 API (회원가입, 로그인)")
@RestController
@RequestMapping("/api/v1/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;

    @Operation(summary = "교수 회원가입", description = "새로운 교수 계정을 생성합니다.")
    @PostMapping("/signup")
    public ResponseEntity<ApiResponse<ProfessorResponse>> signup(@RequestBody @Valid SignupRequest request) {
        ProfessorResponse response = authService.signup(request);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success(response));
    }

    @Operation(summary = "로그인", description = "아이디와 비밀번호로 로그인하여 JWT 토큰을 발급받습니다.")
    @PostMapping("/login")
    public ResponseEntity<ApiResponse<LoginResponse>> login(@RequestBody @Valid LoginRequest request) {
        LoginResponse response = authService.login(request);
        return ResponseEntity.ok(ApiResponse.success(response));
    }
}