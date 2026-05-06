package com.example.veriproof.global.common;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Getter;

import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;

@Getter
@JsonInclude(JsonInclude.Include.NON_NULL)
public class ApiResponse<T> {
    private final T data;
    private final ErrorResponse error;
    private final String timestamp;

    private ApiResponse(T data, ErrorResponse error) {
        this.data = data;
        this.error = error;
        this.timestamp = ZonedDateTime.now(ZoneId.of("UTC")).format(DateTimeFormatter.ISO_INSTANT);
    }

    public static <T> ApiResponse<T> success(T data) {
        return new ApiResponse<>(data, null);
    }

    public static ApiResponse<Void> error(String code, String message) {
        return new ApiResponse<>(null, new ErrorResponse(code, message));
    }

    public record ErrorResponse(String code, String message) {}
}