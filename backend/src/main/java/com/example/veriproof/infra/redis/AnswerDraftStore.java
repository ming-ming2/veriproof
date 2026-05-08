package com.example.veriproof.infra.redis;

import com.example.veriproof.global.exception.CustomException;
import com.example.veriproof.global.exception.ErrorCode;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataAccessException;
import org.springframework.data.redis.core.HashOperations;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

/**
 * 응시 중 작성 중 답안(초안)을 Redis hash로 저장.
 * 키: {@code session:{sessionUuid}:draft}, field=questionId, value=JSON({@link AnswerDraft}).
 *
 * 매번 PUT마다 EXPIREAT을 endsAt + 10분으로 갱신 — 시험 종료 후 자동 정리되지만,
 * 정상 제출 시에는 {@link #clear} 로 즉시 삭제.
 */
@Component
@RequiredArgsConstructor
public class AnswerDraftStore {

    private static final Duration TRAILING_BUFFER = Duration.ofMinutes(10);

    private final StringRedisTemplate redis;
    private final ObjectMapper objectMapper;

    public void save(UUID sessionUuid, Long questionId, AnswerDraft draft, OffsetDateTime examEndsAt) {
        String key = key(sessionUuid);
        try {
            String json = objectMapper.writeValueAsString(draft);
            HashOperations<String, String, String> hashOps = redis.opsForHash();
            hashOps.put(key, String.valueOf(questionId), json);
            redis.expireAt(key, examEndsAt.plus(TRAILING_BUFFER).toInstant());
        } catch (JsonProcessingException e) {
            // JSON 직렬화 자체가 실패 — 코드 버그. 노출 가능한 일반 에러로 변환.
            throw new CustomException(ErrorCode.INTERNAL_SERVER_ERROR);
        } catch (DataAccessException e) {
            throw new CustomException(ErrorCode.LOCK_UNAVAILABLE);
        }
    }

    public Map<Long, AnswerDraft> getAll(UUID sessionUuid) {
        String key = key(sessionUuid);
        try {
            HashOperations<String, String, String> hashOps = redis.opsForHash();
            Map<String, String> raw = hashOps.entries(key);
            if (raw == null || raw.isEmpty()) {
                return Map.of();
            }
            Map<Long, AnswerDraft> result = new HashMap<>(raw.size());
            for (Map.Entry<String, String> entry : raw.entrySet()) {
                try {
                    Long qid = Long.valueOf(entry.getKey());
                    AnswerDraft draft = objectMapper.readValue(entry.getValue(), AnswerDraft.class);
                    result.put(qid, draft);
                } catch (NumberFormatException | JsonProcessingException ignored) {
                    // 손상된 entry는 건너뜀 — 다른 문항 복구는 영향받지 않게
                }
            }
            return result;
        } catch (DataAccessException e) {
            throw new CustomException(ErrorCode.LOCK_UNAVAILABLE);
        }
    }

    /**
     * 제출 시 즉시 정리. best-effort — Redis 장애여도 호출자 트랜잭션을 깨면 안 된다.
     */
    public void clear(UUID sessionUuid) {
        try {
            redis.delete(key(sessionUuid));
        } catch (DataAccessException ignored) {
            // 자연 만료(endsAt + 10min)에 의지
        }
    }

    private String key(UUID sessionUuid) {
        return "session:" + sessionUuid + ":draft";
    }
}
