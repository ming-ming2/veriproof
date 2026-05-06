# Sprint 1 Auth 점검 보고서

작성일: 2026-05-04
범위: 백로그 1-1(교수 회원가입), 1-2(교수 로그인) 코드 점검 + 프론트/백엔드 연동 준비

---

## 1. 환경 셋업

### Java
- **JDK 23** 사용. `backend/build.gradle`의 toolchain을 17 → 23으로 변경.


### PostgreSQL (Docker)
```bash
# 최초 실행
docker run -d --name veriproof-pg -p 5432:5432 \
  -e POSTGRES_PASSWORD=oracle -e POSTGRES_DB=veriproof postgres:16

# 재사용
docker start veriproof-pg
docker stop veriproof-pg
```

### 백엔드 실행
```bash
cd backend
./gradlew bootRun        # 또는 IntelliJ에서 ProjectApplication ▶
```
8081 포트 리스닝. Flyway가 `V1`, `V2` 마이그레이션 자동 적용.

### 프론트 실행
```bash
cd frontend
npm run dev              # 5173 포트, /api/v1/* → 8081 자동 프록시
```

---

## 2. 수정한 버그

### Critical — 동작 자체가 안 되던 항목

| 파일 | 문제 | 수정 |
|------|------|------|
| `frontend/vite.config.js` | proxy target이 `localhost:8080`인데 백엔드는 `8081` | `8081`로 변경 |
| `frontend/src/api/axiosInstance.js` | `baseURL: '/api'`인데 백엔드 prefix는 `/api/v1` | `/api/v1`로 변경 |
| `frontend/src/hooks/useAuth.js` | 로그인 응답에서 `data.token`/`data.user` 읽음. 실제 응답은 `ApiResponse` 래퍼라 한 depth 더 깊고, 사용자 필드명도 `professor` | `res.data.token`, `res.data.professor`로 수정 |
| `frontend/src/hooks/useAuth.js` | 에러 메시지를 `data.message`에서 읽음 (실제는 `data.error.message`) | 경로 수정 |
| `backend/.../SecurityConfig.java` | `JwtAuthenticationFilter`가 빈 등록만 되고 SecurityFilterChain에 미추가 → 토큰 검증 미동작 | `addFilterBefore(...)` 추가 |

### Important — 스펙 미준수 / 미완성

| 파일 | 수정 |
|------|------|
| `backend/.../AuthRequest.java` | username `@Pattern(^[a-zA-Z0-9]{4,50}$)` 추가, name/affiliation/password에 `@Size(max=...)` 추가 |
| `backend/.../JwtAuthenticationFilter.java` | 토큰을 `validateToken` + `getClaims` 두 번 파싱하던 구조를 한 번으로 단순화 |
| `backend/.../db/migration/V2__drop_updated_at_triggers.sql` (신규) | `updated_at` 자동 갱신 책임을 JPA Auditing 쪽으로 일원화 (DB 트리거가 JPA 값을 덮어쓰던 중복 제거) |
| `frontend/src/api/axiosInstance.js` | 401 응답 인터셉터 추가. 토큰 만료 시 자동으로 `localStorage` 비우고 `/login` 이동 (단, `/auth/login`/`/auth/signup` 호출은 메시지 표시를 위해 제외) |
| `frontend/src/App.jsx` | `/exam/create`, `/exam/:id` 라우트 추가 (Dashboard에서 navigate하는데 정의 안 되어있었음) |
| `frontend/src/pages/Dashboard.jsx` | 로그아웃 버튼에 onClick 핸들러 연결 |

---

## 3. 인증 흐름

```
[프론트 Vite (5173)]
   │ axios POST /api/v1/auth/login   (baseURL = '/api/v1')
   ↓
[Vite proxy → localhost:8081]
   ↓
AuthController.login → AuthService.login (BCrypt 검증) → JwtTokenProvider.createToken
   ↓
ApiResponse.success(LoginResponse{token, professor})  → HTTP 200
   ↓
useAuth.handleLogin
   ├─ localStorage.token = res.data.token
   └─ localStorage.user  = res.data.professor (id, username, name)
   ↓
이후 모든 요청
   └─ 요청 인터셉터가 Authorization: Bearer {token} 자동 삽입
        ↓
JwtAuthenticationFilter가 검증 → SecurityContext에 JwtAuthenticationToken 저장
```

---

## 4. API 응답 포맷

모든 응답은 `ApiResponse<T>` 래퍼.

**성공 (회원가입)**
```json
{
  "data": { "id": 1, "username": "prof001", "name": "Kim" },
  "timestamp": "2026-05-04T09:50:41.503Z"
}
```

**성공 (로그인)**
```json
{
  "data": {
    "token": "eyJhbGciOiJIUzUxMiJ9...",
    "professor": { "id": 1, "username": "prof001", "name": "Kim" }
  },
  "timestamp": "..."
}
```

**커스텀 에러 (`CustomException` → `ApiResponse.error`)**
```json
{
  "error": { "code": "USERNAME_ALREADY_EXISTS", "message": "이미 존재하는 아이디입니다." },
  "timestamp": "..."
}
```

| 상황 | HTTP | code |
|------|------|------|
| 정상 회원가입 | 201 | — |
| 중복 username | 409 | `USERNAME_ALREADY_EXISTS` |
| 정상 로그인 | 200 | — |
| 잘못된 자격증명 (잘못된 비번 / 없는 사용자) | 401 | `INVALID_CREDENTIALS` |
| 입력 검증 실패 (비번 8자 미만, username 패턴 위반 등) | 400 | `VALIDATION_FAILED` |
| 토큰 누락/만료된 보호 경로 | 403 | (Spring 기본 응답 — 추후 커스터마이징 가능) |

---

## 5. 변경된 파일

```
backend/
├── build.gradle                              # toolchain 23
└── src/main/
    ├── java/com/example/veriproof/
    │   ├── domain/auth/dto/AuthRequest.java
    │   ├── global/config/SecurityConfig.java
    │   └── global/security/JwtAuthenticationFilter.java
    └── resources/db/migration/
        └── V2__drop_updated_at_triggers.sql  # 신규

frontend/
├── vite.config.js
└── src/
    ├── api/axiosInstance.js
    ├── hooks/useAuth.js
    ├── App.jsx
    └── pages/Dashboard.jsx
```
