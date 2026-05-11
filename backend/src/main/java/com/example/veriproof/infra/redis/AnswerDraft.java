package com.example.veriproof.infra.redis;

import com.fasterxml.jackson.annotation.JsonInclude;

import java.util.Set;

/**
 * Redis hash 값으로 직렬화되는 단일 문항의 작성 중 답안.
 * 주관식: {@code answerText} 사용.
 * 객관식: {@code selectedChoiceIds} 사용 (다중 선택 가능).
 * 필드는 모두 nullable — 클라이언트가 보내지 않은 부분은 null.
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record AnswerDraft(
        String answerText,
        Set<Long> selectedChoiceIds
) {}
