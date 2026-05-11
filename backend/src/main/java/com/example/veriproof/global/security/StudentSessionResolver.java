package com.example.veriproof.global.security;

import com.example.veriproof.global.exception.CustomException;
import com.example.veriproof.global.exception.ErrorCode;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.core.MethodParameter;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.support.WebDataBinderFactory;
import org.springframework.web.context.request.NativeWebRequest;
import org.springframework.web.method.support.HandlerMethodArgumentResolver;
import org.springframework.web.method.support.ModelAndViewContainer;

import java.util.UUID;

/**
 * {@link CurrentSession} 어노테이션이 붙은 컨트롤러 인자를 해석.
 * X-Session-Token 헤더에서 sessionUuid를 추출하고 UUID 형식만 검증한다.
 * 세션의 존재/상태/만료 검증은 호출 측 서비스에서 수행한다 — 본 리졸버에서 DB를 두드리지 않음으로써
 * 단일 책임을 지킨다.
 */
@Component
public class StudentSessionResolver implements HandlerMethodArgumentResolver {

    public static final String HEADER = "X-Session-Token";

    @Override
    public boolean supportsParameter(MethodParameter parameter) {
        return parameter.hasParameterAnnotation(CurrentSession.class)
                && UUID.class.isAssignableFrom(parameter.getParameterType());
    }

    @Override
    public Object resolveArgument(MethodParameter parameter,
                                  ModelAndViewContainer mavContainer,
                                  NativeWebRequest webRequest,
                                  WebDataBinderFactory binderFactory) {
        HttpServletRequest request = webRequest.getNativeRequest(HttpServletRequest.class);
        if (request == null) {
            throw new CustomException(ErrorCode.INVALID_SESSION_TOKEN);
        }

        String header = request.getHeader(HEADER);
        if (!StringUtils.hasText(header)) {
            throw new CustomException(ErrorCode.INVALID_SESSION_TOKEN);
        }

        try {
            return UUID.fromString(header.trim());
        } catch (IllegalArgumentException e) {
            throw new CustomException(ErrorCode.INVALID_SESSION_TOKEN);
        }
    }
}
