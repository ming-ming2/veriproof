-- =====================================================================
-- VeriProof Sprint 2 — 객관식 다중 선택 제출 지원
-- =====================================================================
-- 백로그 9·10: 학생이 객관식 문항에서 선택지를 여러 개 동시에 선택할 수 있어야 함.
-- 기존 submission_answer.selected_choice_id (단일 FK) 구조로는 표현 불가능 →
-- 별도의 join 테이블 submission_answer_choice 도입.
-- =====================================================================

-- 1. 단일 선택지 컬럼 + 관련 제약 제거
ALTER TABLE submission_answer DROP CONSTRAINT IF EXISTS answer_content_check;
ALTER TABLE submission_answer DROP COLUMN IF EXISTS selected_choice_id;

-- 2. 객관식 다중 선택지 join 테이블
CREATE TABLE submission_answer_choice (
    submission_answer_id    BIGINT  NOT NULL REFERENCES submission_answer(id) ON DELETE CASCADE,
    choice_id               BIGINT  NOT NULL REFERENCES question_choice(id)   ON DELETE CASCADE,
    PRIMARY KEY (submission_answer_id, choice_id)
);

CREATE INDEX idx_submission_choice_choice ON submission_answer_choice(choice_id);
