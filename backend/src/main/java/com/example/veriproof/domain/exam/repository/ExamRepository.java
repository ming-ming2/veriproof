package com.example.veriproof.domain.exam.repository;

import com.example.veriproof.domain.exam.entity.Exam;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ExamRepository extends JpaRepository<Exam, Long> {
    boolean existsByExamCode(String examCode);

    Optional<Exam> findByExamCode(String examCode);

    List<Exam> findAllByProfessorIdOrderByCreatedAtDesc(Long professorId);
}