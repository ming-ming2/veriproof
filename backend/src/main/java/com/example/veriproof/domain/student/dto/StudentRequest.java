package com.example.veriproof.domain.student.dto;

import jakarta.validation.constraints.NotBlank;

import java.util.Set;

public class StudentRequest {

    public record SessionStartRequest(
            @NotBlank String studentNumber,
            @NotBlank String studentName
    ) {}

    /**
     * 단일 문항에 대한 답안 초안.
     * 주관식: {@code answerText} 채움. 객관식: {@code selectedChoiceIds} 채움.
     * 둘 다 비어있으면 "비워둠"으로 저장됨 (정상 케이스: 학생이 답안을 지웠을 때).
     */
    public record AnswerDraftRequest(
            String answerText,
            Set<Long> selectedChoiceIds
    ) {}
}
