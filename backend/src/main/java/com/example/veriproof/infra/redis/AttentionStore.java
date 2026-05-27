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

    /** * [추가] 재접속 시 이전 점수를 새 UUID로 이관하기 위해 명시적으로 점수를 세팅합니다.
     */
    public void setScore(Long examId, UUID sessionUuid, double score, OffsetDateTime examEndsAt) {
        if (score <= 0) return; // 0점 이하는 굳이 저장할 필요 없음
        String key = key(examId);
        try {
            redis.opsForZSet().add(key, sessionUuid.toString(), score);
            redis.expireAt(key, examEndsAt.plus(TRAILING_BUFFER).toInstant());
        } catch (DataAccessException e) {
            log.warn("AttentionStore.setScore failed examId={}", examId, e);
        }
    }

    /** * [추가] 재접속으로 더 이상 쓰지 않는 과거 UUID의 점수 기록을 ZSET에서 삭제합니다.
     */
    public void remove(Long examId, UUID sessionUuid) {
        try {
            redis.opsForZSet().remove(key(examId), sessionUuid.toString());
        } catch (DataAccessException e) {
            log.warn("AttentionStore.remove failed examId={}", examId, e);
        }
    }

    private String key(Long examId) {
        return "exam:" + examId + ":attention";
    }
}
