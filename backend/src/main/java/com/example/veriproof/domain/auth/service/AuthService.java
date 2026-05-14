package com.example.veriproof.domain.auth.service;

// 1. 내부 도메인 및 글로벌 설정 Import
import com.example.veriproof.domain.auth.dto.AuthRequest;
import com.example.veriproof.domain.auth.dto.AuthRequest.LoginRequest;
import com.example.veriproof.domain.auth.dto.AuthRequest.SignupRequest;
import com.example.veriproof.domain.auth.dto.AuthResponse.LoginResponse;
import com.example.veriproof.domain.auth.dto.AuthResponse.ProfessorResponse;
import com.example.veriproof.domain.auth.entity.Professor;
import com.example.veriproof.domain.auth.repository.ProfessorRepository;
import com.example.veriproof.global.exception.CustomException;
import com.example.veriproof.global.exception.ErrorCode;
import com.example.veriproof.global.security.JwtTokenProvider;
import com.example.veriproof.domain.auth.dto.AuthResponse.ReadProfessorResponse;
import com.example.veriproof.domain.auth.dto.AuthRequest.UpdateProfileRequest;
import com.example.veriproof.domain.auth.dto.AuthRequest.UpdatePwRequest;

// 2. 외부 프레임워크 (Lombok, Spring Security, Spring TX) Import
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class AuthService {

    private final ProfessorRepository professorRepository;
    private final PasswordEncoder passwordEncoder; // SecurityConfig에서 BCryptPasswordEncoder 빈 등록 필요
    private final JwtTokenProvider jwtTokenProvider; // JWT 발급 유틸리티 (별도 구현 필요)

    @Transactional
    public ProfessorResponse signup(SignupRequest request) {
        // 중복 여부 체크
        if (professorRepository.existsByUsername(request.username())) {
            throw new CustomException(ErrorCode.USERNAME_ALREADY_EXISTS); // 409 에러
        }

        Professor professor = Professor.builder()
                .username(request.username())
                .passwordHash(passwordEncoder.encode(request.password())) // 비밀번호 해싱
                .name(request.name())
                .affiliation(request.affiliation())
                .build();

        Professor saved = professorRepository.save(professor);
        // Id, Username, Name 반환
        return new ProfessorResponse(saved.getId(), saved.getUsername(), saved.getName());
    }

    public LoginResponse login(LoginRequest request) {
        // UserName 체크
        Professor professor = professorRepository.findByUsername(request.username())
                .orElseThrow(() -> new CustomException(ErrorCode.INVALID_CREDENTIALS)); // 401 에러

        // Password 체크
        if (!passwordEncoder.matches(request.password(), professor.getPasswordHash())) {
            throw new CustomException(ErrorCode.INVALID_CREDENTIALS);
        }

        // Token 생성, 및 반환
        String token = jwtTokenProvider.createToken(professor.getId(), professor.getUsername());
        return new LoginResponse(token, new ProfessorResponse(professor.getId(), professor.getUsername(), professor.getName()));
    }

    @Transactional
    public void deleteAccount(Long Id){
        // 1. 존재 여부 확인
        Professor professor = professorRepository.findById(Id)
                .orElseThrow(() -> new CustomException(ErrorCode.USER_NOT_FOUND));

        // 2. 계정 삭제
        professorRepository.delete(professor);
    }

    public ReadProfessorResponse getProfile(Long professorId) {
        Professor professor = professorRepository.findById(professorId)
                .orElseThrow(() -> new CustomException(ErrorCode.USER_NOT_FOUND));
        return new ReadProfessorResponse(professor.getUsername(), professor.getName(), professor.getAffiliation());
    }

    @Transactional
    public ProfessorResponse updateProfile(Long professorId, UpdateProfileRequest request) {
        Professor professor = professorRepository.findById(professorId)
                .orElseThrow(() -> new CustomException(ErrorCode.USER_NOT_FOUND));

        // 2. 수정 (Dirty Checking에 의해 변경 감지되어 자동 업데이트됨)
        professor.updateProfile(request.name(), request.affiliation());

        // 3. 변경된 결과 반환
        return new ProfessorResponse(professor.getId(), professor.getUsername(), professor.getName());
    }

    @Transactional
    public void updatePw(Long professorId, UpdatePwRequest request) {
        Professor professor = professorRepository.findById(professorId)
                .orElseThrow(() -> new CustomException(ErrorCode.USER_NOT_FOUND));

        if (!passwordEncoder.matches(request.currentPassword(), professor.getPasswordHash())) {
            throw new CustomException(ErrorCode.INVALID_CREDENTIALS);
        }

        String encodedPassword = passwordEncoder.encode(request.newPassword());
        professor.updatePassword(encodedPassword);
    }
}