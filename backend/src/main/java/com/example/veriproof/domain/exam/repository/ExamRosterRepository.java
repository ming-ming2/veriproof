package com.example.veriproof.domain.exam.repository;

import com.example.veriproof.domain.exam.entity.ExamRoster;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface ExamRosterRepository extends JpaRepository<ExamRoster, Long> {

    /**
     * 특정 시험의 응시 명단에 해당 학번이 등록되어 있는지 조회.
     * 학번/이름 매칭 검증의 1차 단계.
     */
    Optional<ExamRoster> findByExamIdAndStudentNumber(Long examId, String studentNumber);
}
