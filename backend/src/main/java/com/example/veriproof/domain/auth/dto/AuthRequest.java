package com.example.veriproof.domain.auth.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;


public class AuthRequest {
    public record SignupRequest(
            @NotBlank
            @Pattern(regexp = "^[a-zA-Z0-9]{4,50}$", message = "아이디는 영문/숫자 4~50자여야 합니다.")
            String username,

            @NotBlank
            @Size(min = 8, max = 100, message = "비밀번호는 8자 이상이어야 합니다.")
            String password,

            @NotBlank
            @Size(max = 100)
            String name,

            @NotBlank
            @Size(max = 200)
            String affiliation
    ) {}

    public record LoginRequest(
            @NotBlank
            String username,

            @NotBlank
            String password
    ) {}

    public record UpdateProfileRequest(
            @Size(max = 100)
            String name,

            @Size(max = 200)
            String affiliation
    ) {}

    public record UpdatePwRequest(
            @NotBlank
            @Size(min = 8, max = 100, message = "비밀번호는 8자 이상이어야 합니다.")
            String password
    ) {}
}