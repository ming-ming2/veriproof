package com.example.veriproof.domain.exam.repository;

import com.example.veriproof.domain.exam.entity.Question;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface QuestionRepository extends JpaRepository<Question, Long> {

    /**
     * 문항이 특정 시험에 속하는지 함께 검증하며 조회. 학생 답안 저장 시
     * 다른 시험의 문항 ID로 위조 시도하는 케이스를 차단.
     */
    Optional<Question> findByIdAndExamId(Long id, Long examId);
}