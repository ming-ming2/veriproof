package com.example.veriproof.global.exception;

import lombok.Getter;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;

@Getter
@RequiredArgsConstructor
public enum ErrorCode {
    // 공통
    VALIDATION_FAILED(HttpStatus.BAD_REQUEST, "VALIDATION_FAILED", "잘못된 입력값입니다."),
    INTERNAL_SERVER_ERROR(HttpStatus.INTERNAL_SERVER_ERROR, "INTERNAL_SERVER_ERROR", "서버 내부 오류가 발생했습니다."),
    FORBIDDEN(HttpStatus.FORBIDDEN, "FORBIDDEN", "해당 자원에 대한 권한이 없습니다."),

    // 인증
    INVALID_CREDENTIALS(HttpStatus.UNAUTHORIZED, "INVALID_CREDENTIALS", "아이디 또는 비밀번호가 일치하지 않습니다."),
    USERNAME_ALREADY_EXISTS(HttpStatus.CONFLICT, "USERNAME_ALREADY_EXISTS", "이미 존재하는 아이디입니다."),

    // 시험 - 조회
    EXAM_NOT_FOUND(HttpStatus.NOT_FOUND, "EXAM_NOT_FOUND", "존재하지 않는 시험입니다."),
    QUESTION_NOT_FOUND(HttpStatus.NOT_FOUND, "QUESTION_NOT_FOUND", "존재하지 않는 문항입니다."),

    // 시험 - 개설/수정 검증
    EXAM_TIME_INVALID(HttpStatus.BAD_REQUEST, "EXAM_TIME_INVALID", "종료 시간은 시작 시간보다 이후여야 합니다."),
    ROSTER_EMPTY(HttpStatus.BAD_REQUEST, "ROSTER_EMPTY", "응시 명단은 최소 1명 이상이어야 합니다."),
    MULTIPLE_CHOICE_NO_CORRECT(HttpStatus.BAD_REQUEST, "MULTIPLE_CHOICE_NO_CORRECT", "객관식 문항은 정답 선택지를 1개 이상 지정해야 합니다."),
    MULTIPLE_CHOICE_NO_CHOICES(HttpStatus.BAD_REQUEST, "MULTIPLE_CHOICE_NO_CHOICES", "객관식 문항은 선택지를 2개 이상 등록해야 합니다."),

    // 파일 업로드
    INVALID_FILE(HttpStatus.BAD_REQUEST, "INVALID_FILE", "유효하지 않은 파일입니다."),
    FILE_TOO_LARGE(HttpStatus.BAD_REQUEST, "FILE_TOO_LARGE", "파일 크기가 허용 범위를 초과합니다."),
    UNSUPPORTED_FILE_TYPE(HttpStatus.BAD_REQUEST, "UNSUPPORTED_FILE_TYPE", "지원하지 않는 파일 형식입니다."),
    QUESTION_NOT_IN_EXAM(HttpStatus.BAD_REQUEST, "QUESTION_NOT_IN_EXAM", "해당 문항이 시험에 속해있지 않습니다.");

    private final HttpStatus status;
    private final String code;
    private final String message;
}
