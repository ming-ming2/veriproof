package com.example.veriproof.global.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.core.io.ClassPathResource;
import org.springframework.core.io.Resource;
import org.springframework.lang.NonNull;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;
import org.springframework.web.servlet.resource.PathResourceResolver;

import java.io.IOException;

/**
 * 올인원 배포용 SPA 정적 리소스 핸들러.
 * <p>
 * 빌드된 프론트엔드(dist)는 classpath:/static/ 에 번들된다.
 * 실제 정적 파일(js/css/이미지 등)이 있으면 그대로 서빙하고,
 * 존재하지 않는 경로(React Router 클라이언트 라우트)는 index.html 로 폴백하여
 * 새로고침/직접 진입 시에도 SPA 라우팅이 동작하도록 한다.
 * 단, /api 로 시작하는 요청은 폴백하지 않는다.
 */
@Configuration
public class WebConfig implements WebMvcConfigurer {

    @Override
    public void addResourceHandlers(@NonNull ResourceHandlerRegistry registry) {
        registry.addResourceHandler("/**")
                .addResourceLocations("classpath:/static/")
                .resourceChain(true)
                .addResolver(new PathResourceResolver() {
                    @Override
                    protected Resource getResource(@NonNull String resourcePath,
                                                   @NonNull Resource location) throws IOException {
                        Resource requested = location.createRelative(resourcePath);
                        if (requested.exists() && requested.isReadable()) {
                            return requested;
                        }
                        // API 경로는 SPA 폴백 대상에서 제외 (404가 정상 동작하도록)
                        if (resourcePath.startsWith("api/")) {
                            return null;
                        }
                        // 나머지는 SPA 진입점으로 폴백
                        return new ClassPathResource("/static/index.html");
                    }
                });
    }
}
