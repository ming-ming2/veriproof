package com.example.veriproof.infra.redis;

import com.example.veriproof.global.exception.CustomException;
import com.example.veriproof.global.exception.ErrorCode;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataAccessException;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.util.UUID;

/**
 * 동일 시험 + 동일 학번에 대한 응시 활성 lock.
 * 키: {@code exam:{examId}:active:{studentNumber}}, 값: 점유한 sessionUuid, TTL 30초.
 * 클라이언트는 10초 주기 heartbeat로 TTL을 갱신해 lock을 살려두고, 응시 종료/연결 끊김 시 자연 만료된다.
 *
 * 모든 Redis 호출은 {@link DataAccessException} 시 {@link ErrorCode#LOCK_UNAVAILABLE} 로 변환되어
 * fail-close 동작을 보장한다 (응시 시작 자체가 차단됨).
 */
@Component
@RequiredArgsConstructor
public class SessionLockStore {

    public static final Duration TTL = Duration.ofSeconds(30);

    private final StringRedisTemplate redis;

    /**
     * lock 획득 시도. 다음 중 하나면 {@code true}:
     *  - 새로 획득
     *  - 기존 점유자가 본인(sessionUuid 일치)이라 TTL 갱신만 하고 통과 (재접속)
     * 다른 sessionUuid가 점유 중이면 {@code false}.
     */
    public boolean tryAcquire(Long examId, String studentNumber, UUID sessionUuid) {
        String key = key(examId, studentNumber);
        String value = sessionUuid.toString();
        try {
            Boolean acquired = redis.opsForValue().setIfAbsent(key, value, TTL);
            if (Boolean.TRUE.equals(acquired)) {
                return true;
            }
            // NX 실패 → 기존 점유자 확인
            String existing = redis.opsForValue().get(key);
            if (value.equals(existing)) {
                redis.expire(key, TTL); // 재접속이므로 TTL 갱신
                return true;
            }
            return false;
        } catch (DataAccessException e) {
            throw new CustomException(ErrorCode.LOCK_UNAVAILABLE);
        }
    }

    /**
     * 본인 sessionUuid가 lock을 들고 있을 때만 TTL을 갱신한다 (heartbeat).
     * 만료/소유자 변경 시 {@code false}.
     */
    public boolean refresh(Long examId, String studentNumber, UUID sessionUuid) {
        String key = key(examId, studentNumber);
        try {
            String existing = redis.opsForValue().get(key);
            if (existing == null) {
                return false;
            }
            if (!sessionUuid.toString().equals(existing)) {
                return false;
            }
            Boolean ok = redis.expire(key, TTL);
            return Boolean.TRUE.equals(ok);
        } catch (DataAccessException e) {
            throw new CustomException(ErrorCode.LOCK_UNAVAILABLE);
        }
    }

    /**
     * 제출/명시적 종료 시 lock 해제. best-effort — Redis 장애여도 호출자 트랜잭션을 깨면 안 된다.
     */
    public void release(Long examId, String studentNumber) {
        try {
            redis.delete(key(examId, studentNumber));
        } catch (DataAccessException ignored) {
            // 자연 만료(30초)에 의지
        }
    }

    private String key(Long examId, String studentNumber) {
        return "exam:" + examId + ":active:" + studentNumber;
    }
}
