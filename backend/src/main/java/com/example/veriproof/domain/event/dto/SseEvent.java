package com.example.veriproof.domain.event.dto;

/**
 * 감독관 SSE 채널에 publish되는 단일 메시지.
 * {@code name}은 SSE event 필드, {@code data}는 JSON 직렬화될 페이로드(record/Map 등).
 *
 * 정의된 name:
 *  - {@code student-event}    : 학생 이벤트 발생 (피드 prepend + 카드 lastActivityAt 갱신)
 *  - {@code attention-update} : 주목도 점수 변화 (카드 색상/위치 갱신)
 *  - {@code session-status}   : 응시 상태 전이 (IN_PROGRESS → SUBMITTED 등)
 *  - {@code heartbeat}        : 30초 주기 keepalive (data 비어 있음)
 */
public record SseEvent(String name, Object data) {

    public static SseEvent studentEvent(Object data)     { return new SseEvent("student-event", data); }
    public static SseEvent attentionUpdate(Object data)  { return new SseEvent("attention-update", data); }
    public static SseEvent sessionStatus(Object data)    { return new SseEvent("session-status", data); }
    public static SseEvent heartbeat()                   { return new SseEvent("heartbeat", java.util.Map.of()); }
}
