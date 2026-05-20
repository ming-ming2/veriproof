package com.example.veriproof.infra.redis;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@Slf4j
@Component
@RequiredArgsConstructor
public class ActiveSessionStore {

    private final StringRedisTemplate stringRedisTemplate;
    private final ObjectMapper objectMapper;

    /**
     * 시험 ID에 해당하는 모든 활성 세션 정보 가져오기
     */
    public Map<Object, Object> getAllActiveSessions(Long examId) {
        String activeKey = "exam:" + examId + ":active";
        return stringRedisTemplate.opsForHash().entries(activeKey);
    }

    /**
     * 활성 세션 추가/업데이트
     */
    public void saveActiveSession(Long examId, String sessionUuid, Object metaInfo) {
        String activeKey = "exam:" + examId + ":active";
        try {
            String jsonStr = objectMapper.writeValueAsString(metaInfo);
            stringRedisTemplate.opsForHash().put(activeKey, sessionUuid, jsonStr);
        } catch (JsonProcessingException e) {
            throw new RuntimeException("Redis 저장 중 JSON 직렬화 실패", e);
        }
    }

    /**
     * 세션 제거
     */
    public void removeActiveSession(Long examId, String sessionUuid) {
        String activeKey = "exam:" + examId + ":active";
        stringRedisTemplate.opsForHash().delete(activeKey, sessionUuid);
    }

    /**
     * 서비스 계층을 위한 캡슐화된 조회 메서드
     */
    public List<ActiveSessionInfo> getActiveSessionInfos(Long examId) {
        String activeKey = "exam:" + examId + ":active";
        Map<Object, Object> entries = stringRedisTemplate.opsForHash().entries(activeKey);
        List<ActiveSessionInfo> infos = new ArrayList<>();

        for (Map.Entry<Object, Object> entry : entries.entrySet()) {
            String sessionUuid = String.valueOf(entry.getKey());
            String jsonStr = String.valueOf(entry.getValue());

            try {
                Map<String, Object> metaMap = objectMapper.readValue(jsonStr, new TypeReference<>() {});

                infos.add(new ActiveSessionInfo(
                        sessionUuid,
                        String.valueOf(metaMap.get("studentNumber")),
                        metaMap.get("studentName") != null ? String.valueOf(metaMap.get("studentName")) : String.valueOf(metaMap.get("name")),
                        metaMap.get("currentQuestionId") != null ? Long.valueOf(String.valueOf(metaMap.get("currentQuestionId"))) : null,
                        metaMap.get("lastActivityAt") != null ? String.valueOf(metaMap.get("lastActivityAt")) : OffsetDateTime.now().toString()
                ));
            } catch (JsonProcessingException e) {
                log.warn("[Redis 역직렬화 실패] Exam: {}, Session: {}, Error: {}", examId, sessionUuid, e.getMessage());
            }
        }
        return infos;
    }
}