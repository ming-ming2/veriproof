package com.example.veriproof.domain.exam.repository;

import com.example.veriproof.domain.exam.entity.ExamSession;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ExamSessionRepository extends JpaRepository<ExamSession, Long> {
    List<ExamSession> findAllByExamId(Long examId);

    int countByExamId(Long examId);
}