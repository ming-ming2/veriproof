-- =====================================================================
-- V2: updated_at 자동 갱신 트리거 제거
-- =====================================================================
-- 사유: JPA Auditing(@LastModifiedDate)이 이미 updated_at을 갱신하므로
-- DB 트리거가 함께 동작하면 JPA가 보낸 값을 다시 NOW()로 덮어써서
-- 결과가 미세하게 어긋날 수 있음. 갱신 책임은 JPA 쪽으로 일원화.
-- =====================================================================

DROP TRIGGER IF EXISTS update_professor_updated_at ON professor;
DROP TRIGGER IF EXISTS update_exam_updated_at ON exam;
DROP FUNCTION IF EXISTS update_updated_at_column();
