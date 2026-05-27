package com.example.veriproof.infra.redis;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataAccessException;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.Map;
import java.util.UUID;

/**
 * 세션별 시그널 카운트 Hash.
 * 키: {@code session:{sessionUuid}:signals}, field=시그널 타입(paste/visibility_lost/...), value=카운트.
 *
 * 감독관 상세 패널에서 즉시 응답할 수 있도록 누적 카운트를 Redis에 둔다.
 * (DB 집계는 가능하지만 학생 상세 패널을 열 때마다 GROUP BY를 돌리지 않기 위함.)
 *
 * fail-open. Redis 장애 시 카운트 누락만 발생.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class SignalCounterStore {

    private static final Duration TRAILING_BUFFER = Duration.ofHours(1);

    private final StringRedisTemplate redis;

    /** 특정 시그널 타입 카운트 +1. */
    public void increment(UUID sessionUuid, String signalType, OffsetDateTime examEndsAt) {
        String key = key(sessionUuid);
        try {
            redis.opsForHash().increment(key, signalType, 1L);
            redis.expireAt(key, examEndsAt.plus(TRAILING_BUFFER).toInstant());
        } catch (DataAccessException e) {
            log.warn("SignalCounterStore.increment failed sessionUuid={} type={}", sessionUuid, signalType, e);
        }
    }

    /** 시그널 타입별 카운트 일괄 조회. 빈 Map fallback. */
    public Map<Object, Object> getAll(UUID sessionUuid) {
        try {
            Map<Object, Object> raw = redis.opsForHash().entries(key(sessionUuid));
            return raw != null ? raw : Map.of();
        } catch (DataAccessException e) {
            log.warn("SignalCounterStore.getAll failed sessionUuid={}", sessionUuid, e);
            return Map.of();
        }
    }

    private String key(UUID sessionUuid) {
        return "session:" + sessionUuid + ":signals";
    }
}
