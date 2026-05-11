package com.example.veriproof.domain.exam.repository;

import com.example.veriproof.domain.exam.entity.SubmissionAnswer;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface SubmissionAnswerRepository extends JpaRepository<SubmissionAnswer, Long> {

    List<SubmissionAnswer> findAllByExamSessionId(Long examSessionId);
    Optional<SubmissionAnswer> findByExamSessionIdAndQuestionId(Long examSessionId, Long questionId);
}
