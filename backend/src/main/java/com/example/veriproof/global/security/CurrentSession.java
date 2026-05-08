package com.example.veriproof.global.security;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * 학생 응시 컨트롤러 메서드 인자에 부착하면 {@code X-Session-Token} 헤더의
 * sessionUuid가 {@link java.util.UUID}로 주입된다.
 * 헤더가 없거나 형식이 잘못된 경우 {@code INVALID_SESSION_TOKEN} 예외가 발생한다.
 * 실제 세션 존재/상태 검증은 서비스 계층에서 수행한다.
 */
@Target(ElementType.PARAMETER)
@Retention(RetentionPolicy.RUNTIME)
public @interface CurrentSession {
}
