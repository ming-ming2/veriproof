package com.example.veriproof.domain.auth.dto;


public class AuthResponse {
    public record ProfessorResponse(
            Long id,
            String username,
            String name
    ) {}

    public record LoginResponse(
            String token,
            ProfessorResponse professor
    ) {}
}
