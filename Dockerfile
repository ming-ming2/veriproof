# syntax=docker/dockerfile:1

###############################################
# 1단계: 프론트엔드(React + Vite) 정적 빌드
###############################################
FROM node:22-slim AS frontend
WORKDIR /fe

# 의존성 레이어 캐싱
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

# 소스 복사 후 빌드 → /fe/dist 생성
COPY frontend/ ./
RUN npm run build

###############################################
# 2단계: 백엔드(Spring Boot) 빌드
#  - 프론트 dist를 static 리소스로 번들하여 단일 jar 생성
###############################################
FROM eclipse-temurin:23-jdk AS backend
WORKDIR /app

# Gradle 의존성 레이어 캐싱 (빌드 스크립트만 먼저 복사)
COPY backend/gradlew ./
COPY backend/gradle ./gradle
COPY backend/build.gradle backend/settings.gradle ./
RUN chmod +x gradlew && ./gradlew dependencies --no-daemon || true

# 백엔드 소스 복사
COPY backend/src ./src

# 프론트 빌드 산출물을 Spring 정적 리소스로 번들
COPY --from=frontend /fe/dist ./src/main/resources/static

# 실행 가능한 fat jar 생성 (테스트 제외)
RUN ./gradlew bootJar --no-daemon -x test

###############################################
# 3단계: 런타임 (슬림 JRE)
###############################################
FROM eclipse-temurin:23-jre
WORKDIR /app

# 업로드 디렉터리 (영속 볼륨을 마운트하지 않으면 재배포 시 휘발)
RUN mkdir -p /app/uploads/images
ENV FILE_UPLOAD_DIR=/app/uploads/images

COPY --from=backend /app/build/libs/*.jar app.jar

# 플랫폼이 PORT 환경변수를 주입 (기본 8081)
EXPOSE 8081
ENTRYPOINT ["java", "-jar", "app.jar"]
