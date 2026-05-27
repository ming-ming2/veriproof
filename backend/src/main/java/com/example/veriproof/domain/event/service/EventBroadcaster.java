package com.example.veriproof.domain.event.service;

import com.example.veriproof.domain.event.dto.SseEvent;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

/**
 * 감독관 SSE 채널 팬아웃 추상.
 *
 * 단일 인스턴스 가정의 {@link InMemoryEventBroadcaster}가 기본 구현체.
 * 다중 인스턴스 배포로 확장 시 Redis Pub/Sub 기반 구현체로 교체 (스펙: sprint3-realtime-spec.md §2.2).
 */
public interface EventBroadcaster {

    /**
     * 시험 단위로 구독자 등록. 호출자(컨트롤러)는 반환된 emitter를 그대로 응답으로 돌려준다.
     * 연결 종료/타임아웃/에러 시 자동으로 자원이 정리되도록 구현체가 콜백을 부착해야 한다.
     */
    SseEmitter subscribe(Long examId);

    /** 해당 시험을 구독 중인 모든 감독관 연결에 이벤트를 송신. 실패한 emitter는 자동 정리. */
    void publish(Long examId, SseEvent event);
}
