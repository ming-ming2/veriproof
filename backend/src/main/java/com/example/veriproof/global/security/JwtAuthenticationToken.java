package com.example.veriproof.global.security;

import lombok.Getter;
import org.springframework.security.authentication.AbstractAuthenticationToken;

import java.util.Collections;

// Controller에서 @AuthenticationPrincipal을 썼을 때 편하게 꺼내쓰기 위한 객체
@Getter
public class JwtAuthenticationToken extends AbstractAuthenticationToken {

    private final Long professorId;
    private final String username;

    public JwtAuthenticationToken(Long professorId, String username) {
        super(Collections.emptyList());
        this.professorId = professorId;
        this.username = username;
        setAuthenticated(true);
    }

    @Override
    public Object getCredentials() {
        return null; // JWT는 자격증명(비밀번호)을 담지 않음
    }

    @Override
    public Object getPrincipal() {
        return this.professorId; // Principal로 PK(ID)를 반환하도록 설정
    }
}