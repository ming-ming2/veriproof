package com.example.veriproof.global.config;

import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.security.SecurityRequirement;
import io.swagger.v3.oas.models.security.SecurityScheme;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class SwaggerConfig {

    @Bean
    public OpenAPI openAPI() {
        String jwtSchemeName = "jwtAuth";
        String sessionTokenSchemeName = "X-Session-Token"; // 💡 새로 추가할 스킴 이름

        // 기본적으로 전역에 적용할 인증 (JWT)
        SecurityRequirement securityRequirement = new SecurityRequirement().addList(jwtSchemeName);

        Components components = new Components()
                // 1. 기존 JWT 인증 설정 (관리자/감독관용)
                .addSecuritySchemes(jwtSchemeName, new SecurityScheme()
                        .name(jwtSchemeName)
                        .type(SecurityScheme.Type.HTTP)
                        .scheme("bearer")
                        .bearerFormat("JWT"))
                // 2. 💡 학생 세션 토큰 인증 설정 추가 (학생 응시용)
                .addSecuritySchemes(sessionTokenSchemeName, new SecurityScheme()
                        .name(sessionTokenSchemeName)
                        .type(SecurityScheme.Type.APIKEY)
                        .in(SecurityScheme.In.HEADER));

        return new OpenAPI()
                .info(new Info()
                        .title("VeriProof API 명세서")
                        .description("소프트웨어 공학 Sprint 1 API 문서입니다.")
                        .version("v1.0.0"))
                .addSecurityItem(securityRequirement)
                .components(components);
    }
}