package com.example.veriproof.infra.redis;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataAccessException;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * 시험별 학생 주목도 점수 ZSET.
 * 키: {@code exam:{examId}:attention}, member=sessionUuid, score=누적 시그널 수.
 *
 * 감독관 카드 정렬({@code ZREVRANGE})에 사용. 점수 갱신은 의심 시그널 도착 시 +1 ({@link #increment}).
 *
 * fail-open: Redis 장애 시 예외 던지지 않고 silently 0/no-op 처리.
 * 점수 누락은 감독관 UI에만 영향을 주며 학생 응시·기록 자체에는 영향이 없어야 한다.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class AttentionStore {

    /** 시험 종료 후 1시간 보존. */
    private static final Duration TRAILING_BUFFER = Duration.ofHours(1);

    private final StringRedisTemplate redis;

    /** 누적 점수 1 증가. 반환은 갱신 후 점수. fail-open. */
    public double increment(Long examId, UUID sessionUuid, OffsetDateTime examEndsAt) {
        String key = key(examId);
        try {
            Double newScore = redis.opsForZSet().incrementScore(key, sessionUuid.toString(), 1.0);
            redis.expireAt(key, examEndsAt.plus(TRAILING_BUFFER).toInstant());
            return newScore != null ? newScore : 0.0;
        } catch (DataAccessException e) {
            log.warn("AttentionStore.increment failed examId={}", examId, e);
            return 0.0;
        }
    }

    /** 단일 학생의 현재 점수. fail-open으로 0 반환. */
    public double getScore(Long examId, UUID sessionUuid) {
        try {
            Double score = redis.opsForZSet().score(key(examId), sessionUuid.toString());
            return score != null ? score : 0.0;
        } catch (DataAccessException e) {
            log.warn("AttentionStore.getScore failed examId={}", examId, e);
            return 0.0;
        }
    }

    private String key(Long examId) {
        return "exam:" + examId + ":attention";
    }
}
