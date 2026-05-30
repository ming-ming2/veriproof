-- =====================================================================
-- VeriProof — 좌석 배치(백로그 25) + 채점 완료 상태(백로그 24)
-- =====================================================================
-- 1) exam.seat_rows / seat_cols : 강의실 좌석 그리드(행 x 열). 둘 다 NULL이면 좌석 배치 미사용.
-- 2) exam_roster.seat_number   : 이름순 정렬 후 1부터 배정한 좌석 번호.
-- 3) exam_session.grading_status: 세션 단위 채점 완료 상태(UNGRADED/COMPLETED).
-- 기존 컬럼들이 INT/Integer 매핑을 쓰므로 동일하게 INTEGER 사용(Hibernate validate 호환).
-- =====================================================================

ALTER TABLE exam
    ADD COLUMN seat_rows INTEGER,
    ADD COLUMN seat_cols INTEGER;

ALTER TABLE exam_roster
    ADD COLUMN seat_number INTEGER;

ALTER TABLE exam_session
    ADD COLUMN grading_status VARCHAR(20) NOT NULL DEFAULT 'UNGRADED';

ALTER TABLE exam_session
    ADD CONSTRAINT session_grading_status_check
        CHECK (grading_status IN ('UNGRADED', 'COMPLETED'));
