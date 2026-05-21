package com.example.veriproof.domain.event.service;

import com.example.veriproof.domain.event.dto.SseEvent;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;

/**
 * 단일 인스턴스 가정의 SSE 팬아웃 구현체.
 *
 * 시험별 구독자 리스트를 인메모리 Map으로 유지한다. SSE는 매우 긴 연결이라
 * 연결 수가 인스턴스당 수십~수백 수준에 머무는 우리 시나리오에서는 충분하다.
 *
 * 다중 인스턴스로 확장 시 Redis Pub/Sub 기반 구현체로 교체.
 */
@Slf4j
@Component
public class InMemoryEventBroadcaster implements EventBroadcaster {

    /** SSE 연결 timeout. 학생 응시가 종료될 때까지 끊기지 않도록 충분히 길게. */
    private static final long EMITTER_TIMEOUT_MS = 6 * 60 * 60 * 1000L; // 6시간

    private final Map<Long, List<SseEmitter>> emittersByExam = new ConcurrentHashMap<>();

    @Override
    public SseEmitter subscribe(Long examId) {
        SseEmitter emitter = new SseEmitter(EMITTER_TIMEOUT_MS);
        List<SseEmitter> list = emittersByExam.computeIfAbsent(examId, k -> new CopyOnWriteArrayList<>());
        list.add(emitter);

        emitter.onCompletion(() -> remove(examId, emitter));
        emitter.onTimeout(()    -> remove(examId, emitter));
        emitter.onError(e       -> remove(examId, emitter));
        return emitter;
    }

    @Override
    public void publish(Long examId, SseEvent event) {
        List<SseEmitter> list = emittersByExam.get(examId);
        if (list == null || list.isEmpty()) {
            return;
        }
        for (SseEmitter emitter : list) {
            try {
                emitter.send(SseEmitter.event()
                        .name(event.name())
                        .data(event.data()));
            } catch (IOException | IllegalStateException e) {
                log.debug("SSE send failed for examId={}, removing emitter", examId, e);
                remove(examId, emitter);
            }
        }
    }

    /** 30초 주기 keepalive — 일부 프록시/네트워크 환경에서 idle 연결 차단 방지. */
    @Scheduled(fixedRate = 30_000L)
    public void heartbeat() {
        SseEvent hb = SseEvent.heartbeat();
        for (Long examId : emittersByExam.keySet()) {
            publish(examId, hb);
        }
    }

    private void remove(Long examId, SseEmitter emitter) {
        List<SseEmitter> list = emittersByExam.get(examId);
        if (list != null) {
            list.remove(emitter);
            if (list.isEmpty()) {
                emittersByExam.remove(examId, list);
            }
        }
    }
}
