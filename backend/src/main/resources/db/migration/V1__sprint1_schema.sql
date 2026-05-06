-- =====================================================================
-- VeriProof Sprint 1 Database Schema (Updated: Grading & Roster)
-- =====================================================================
-- 시간대: 모든 시간 컬럼은 TIMESTAMPTZ (UTC 저장)
-- ID 전략: 내부 PK는 BIGSERIAL, 외부 노출은 UUID 컬럼 별도
--
-- =====================================================================

-- 확장: UUID 생성 함수 (proctor_token, session_uuid 등에 사용)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";


-- =====================================================================
-- 1. professor : 교수 계정
-- =====================================================================
CREATE TABLE professor (
                           id              BIGSERIAL       PRIMARY KEY,
                           username        VARCHAR(50)     NOT NULL UNIQUE,    -- 아이디 (영문/숫자)
                           password_hash   VARCHAR(60)     NOT NULL,           -- BCrypt
                           name            VARCHAR(100)    NOT NULL,
                           affiliation     VARCHAR(200)    NOT NULL,
                           created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
                           updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_professor_username ON professor(username);


-- =====================================================================
-- 2. exam : 시험
-- =====================================================================
CREATE TABLE exam (
                      id                  BIGSERIAL       PRIMARY KEY,
                      professor_id        BIGINT          NOT NULL REFERENCES professor(id) ON DELETE CASCADE,
                      title               VARCHAR(200)    NOT NULL,
                      exam_code           VARCHAR(6)      NOT NULL UNIQUE,
                      proctor_token       UUID            NOT NULL UNIQUE DEFAULT uuid_generate_v4(),
                      starts_at           TIMESTAMPTZ     NOT NULL,
                      ends_at             TIMESTAMPTZ     NOT NULL,
                      created_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
                      updated_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

                      CONSTRAINT exam_time_check CHECK (ends_at > starts_at)
);

CREATE INDEX idx_exam_professor ON exam(professor_id);
CREATE INDEX idx_exam_code ON exam(exam_code);
CREATE INDEX idx_exam_proctor_token ON exam(proctor_token);


-- =====================================================================
-- 3. exam_roster : 시험 응시 예정자 명단 (사전 등록용)
-- =====================================================================
CREATE TABLE exam_roster (
                             id              BIGSERIAL       PRIMARY KEY,
                             exam_id         BIGINT          NOT NULL REFERENCES exam(id) ON DELETE CASCADE,
                             student_number  VARCHAR(50)     NOT NULL,
                             student_name    VARCHAR(100)    NOT NULL,

                             CONSTRAINT roster_unique_per_exam UNIQUE (exam_id, student_number)
);

CREATE INDEX idx_roster_exam ON exam_roster(exam_id);


-- =====================================================================
-- 4. question : 문항 (+ 주관식 정답)
-- =====================================================================
CREATE TABLE question (
                          id              BIGSERIAL       PRIMARY KEY,
                          exam_id         BIGINT          NOT NULL REFERENCES exam(id) ON DELETE CASCADE,
                          question_type   VARCHAR(20)     NOT NULL,
                          body            TEXT            NOT NULL,
                          correct_answer  TEXT,           -- 주관식 정답 보조용
                          points          INT             NOT NULL,
                          display_order   INT             NOT NULL,
                          created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

                          CONSTRAINT question_type_check CHECK (question_type IN ('SUBJECTIVE', 'MULTIPLE_CHOICE')),
                          CONSTRAINT question_points_check CHECK (points > 0),
                          CONSTRAINT question_order_unique UNIQUE (exam_id, display_order)
);

CREATE INDEX idx_question_exam ON question(exam_id);


-- =====================================================================
-- 5. question_choice : 객관식 선택지 (+ 정답 여부)
-- =====================================================================
CREATE TABLE question_choice (
                                 id              BIGSERIAL       PRIMARY KEY,
                                 question_id     BIGINT          NOT NULL REFERENCES question(id) ON DELETE CASCADE,
                                 body            TEXT            NOT NULL,
                                 is_correct      BOOLEAN         NOT NULL DEFAULT FALSE, -- 객관식 정답 여부
                                 display_order   INT             NOT NULL,

                                 CONSTRAINT choice_order_unique UNIQUE (question_id, display_order)
);

CREATE INDEX idx_choice_question ON question_choice(question_id);


-- =====================================================================
-- 6. question_image : 문항 첨부 이미지
-- =====================================================================
CREATE TABLE question_image (
                                id              BIGSERIAL       PRIMARY KEY,
                                question_id     BIGINT          NOT NULL REFERENCES question(id) ON DELETE CASCADE,
                                file_path       VARCHAR(500)    NOT NULL,
                                original_name   VARCHAR(255)    NOT NULL,
                                mime_type       VARCHAR(100)    NOT NULL,
                                size_bytes      BIGINT          NOT NULL,
                                uploaded_at     TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_image_question ON question_image(question_id);


-- =====================================================================
-- 7. exam_session : 학생 응시 세션 (+ 총점)
-- =====================================================================
CREATE TABLE exam_session (
                              id              BIGSERIAL       PRIMARY KEY,
                              session_uuid    UUID            NOT NULL UNIQUE DEFAULT uuid_generate_v4(),
                              exam_id         BIGINT          NOT NULL REFERENCES exam(id) ON DELETE CASCADE,
                              student_number  VARCHAR(50)     NOT NULL,
                              student_name    VARCHAR(100)    NOT NULL,
                              started_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
                              submitted_at    TIMESTAMPTZ,
                              status          VARCHAR(20)     NOT NULL DEFAULT 'IN_PROGRESS',
                              total_score     INT             DEFAULT 0, -- 자동 채점 및 교수가 부여한 총점

                              CONSTRAINT session_status_check CHECK (status IN ('IN_PROGRESS', 'SUBMITTED', 'EXPIRED')),
                              CONSTRAINT session_unique_per_student UNIQUE (exam_id, student_number)
);

CREATE INDEX idx_session_exam ON exam_session(exam_id);
CREATE INDEX idx_session_uuid ON exam_session(session_uuid);
CREATE INDEX idx_session_status ON exam_session(status);


-- =====================================================================
-- 8. submission_answer : 학생이 제출한 답안 (+ 획득 점수)
-- =====================================================================
CREATE TABLE submission_answer (
                                   id                  BIGSERIAL       PRIMARY KEY,
                                   exam_session_id     BIGINT          NOT NULL REFERENCES exam_session(id) ON DELETE CASCADE,
                                   question_id         BIGINT          NOT NULL REFERENCES question(id) ON DELETE CASCADE,
                                   answer_text         TEXT,
                                   selected_choice_id  BIGINT          REFERENCES question_choice(id) ON DELETE SET NULL,
                                   earned_score        INT             DEFAULT 0, -- 해당 문항에서 얻은 점수
                                   submitted_at        TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

                                   CONSTRAINT answer_unique_per_question UNIQUE (exam_session_id, question_id),
                                   CONSTRAINT answer_content_check CHECK (
                                       answer_text IS NOT NULL OR selected_choice_id IS NOT NULL
                                       )
);

CREATE INDEX idx_answer_session ON submission_answer(exam_session_id);
CREATE INDEX idx_answer_question ON submission_answer(question_id);


-- =====================================================================
-- 트리거: updated_at 자동 갱신
-- =====================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_professor_updated_at BEFORE UPDATE ON professor
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_exam_updated_at BEFORE UPDATE ON exam
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();