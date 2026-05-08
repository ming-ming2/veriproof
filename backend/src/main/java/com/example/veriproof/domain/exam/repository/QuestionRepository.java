package com.example.veriproof.domain.exam.repository;

import com.example.veriproof.domain.exam.entity.Question;
import org.springframework.data.jpa.repository.JpaRepository;

public interface QuestionRepository extends JpaRepository<Question, Long> {

}