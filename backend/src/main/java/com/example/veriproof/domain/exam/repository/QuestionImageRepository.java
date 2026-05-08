package com.example.veriproof.domain.exam.repository;

import com.example.veriproof.domain.exam.entity.QuestionImage;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface QuestionImageRepository extends JpaRepository<QuestionImage, Long> {

    // 특정 문항(Question)에 첨부된 모든 이미지 목록을 조회할 때 사용 (추후 상세 조회 등에서 활용 가능)
    List<QuestionImage> findAllByQuestionId(Long questionId);
}