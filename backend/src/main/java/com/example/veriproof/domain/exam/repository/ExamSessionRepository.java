package com.example.veriproof.domain.exam.repository;

import com.example.veriproof.domain.exam.entity.ExamSession;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface ExamSessionRepository extends JpaRepository<ExamSession, Long> {
    List<ExamSession> findAllByExamId(Long examId);

    int countByExamId(Long examId);

    /**
     * 동일 시험에 동일 학번의 세션 조회. 학생 응시 시작 시 재접속/신규 분기에 사용.
     */
    Optional<ExamSession> findByExamIdAndStudentNumber(Long examId, String studentNumber);

    /**
     * X-Session-Token 헤더로 들어온 sessionUuid로 세션 조회.
     */
    Optional<ExamSession> findBySessionUuid(UUID sessionUuid);
}