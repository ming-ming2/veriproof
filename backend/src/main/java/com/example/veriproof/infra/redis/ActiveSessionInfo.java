package com.example.veriproof.infra.redis;

/**
 * 실시간 대시보드에 노출될 학생의 활성 세션 상태 DTO (데이터 전송 객체)
 */
public record ActiveSessionInfo(
        String sessionUuid,
        String studentNumber,
        String studentName,
        Long currentQuestionId,
        String lastActivityAt
) {}