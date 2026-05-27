-- =====================================================================
-- VeriProof Sprint 3 — 실시간 이벤트 로그 + 답안 스냅샷
-- =====================================================================
-- 백로그 13·14: 학생 응시 중 발생하는 의심 시그널과 답안 진화 과정을 누적 저장.
-- 백로그 15: event_log + answer_snapshot으로 사후 재생 데이터 일괄 조회.
-- 백로그 17·18: event_log를 시간 역순으로 감독관 이벤트 피드에 노출.
--
-- 설계 메모:
--  - PK BIGSERIAL (Kafka 비채택으로 UUID 명분 사라짐, 학부 스코프 단순성 우선)
--  - exam_id 비정규화 (감독관 이벤트 피드/사후 집계에서 JOIN 회피)
--  - duration_ms는 VISIBILITY/FULLSCREEN 페어링 결과를 RESTORED/ENTER row에 기록
--  - payload는 JSONB (이벤트 종류별 페이로드 스키마가 달라 컬럼 정규화 비효율)
-- =====================================================================

CREATE TABLE event_log (
    id                  BIGSERIAL       PRIMARY KEY,
    exam_session_id     BIGINT          NOT NULL REFERENCES exam_session(id) ON DELETE CASCADE,
    exam_id             BIGINT          NOT NULL REFERENCES exam(id)         ON DELETE CASCADE,
    event_type          VARCHAR(40)     NOT NULL,
    question_id         BIGINT                   REFERENCES question(id)     ON DELETE SET NULL,
    occurred_at         TIMESTAMPTZ     NOT NULL,
    received_at         TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    duration_ms         INTEGER,
    payload             JSONB           NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX idx_event_session_time ON event_log(exam_session_id, occurred_at);
CREATE INDEX idx_event_exam_time    ON event_log(exam_id, occurred_at DESC);
CREATE INDEX idx_event_type         ON event_log(event_type);


CREATE TABLE answer_snapshot (
    id                  BIGSERIAL       PRIMARY KEY,
    exam_session_id     BIGINT          NOT NULL REFERENCES exam_session(id) ON DELETE CASCADE,
    question_id         BIGINT          NOT NULL REFERENCES question(id)     ON DELETE CASCADE,
    captured_at         TIMESTAMPTZ     NOT NULL,
    answer_text         TEXT,
    selected_choice_ids BIGINT[]
);

CREATE INDEX idx_snapshot_session_q_time ON answer_snapshot(exam_session_id, question_id, captured_at);
