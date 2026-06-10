# Veriproof 배포 가이드 (올인원 단일 서비스)

데모 시연용 배포 문서. 프론트엔드(React/Vite)를 빌드해 Spring Boot 정적 리소스로 번들하여
**하나의 컨테이너**로 서빙한다. 같은 origin이라 CORS 문제가 없고, 플랫폼이 HTTPS를 자동 제공한다.

## 구성 요약

```
[브라우저] ──HTTPS──> [단일 컨테이너: Spring Boot + 번들된 SPA]
                          ├── /            → React SPA (index.html)
                          ├── /api/v1/**   → REST API
                          └─> [Managed PostgreSQL] + [Managed Redis]
```

- 빌드/실행 정의: 루트 `Dockerfile` (멀티스테이지)
- DB 스키마: Flyway가 앱 기동 시 자동 마이그레이션 (`V1`~`V6`)
- 클립보드/전체화면 API는 보안 컨텍스트가 필요 → **HTTPS 필수** (플랫폼 기본 도메인이 HTTPS라 충족)

---

## 필요한 환경 변수

| 변수 | 설명 | 예시 |
| :-- | :-- | :-- |
| `PORT` | 컨테이너 리슨 포트 (플랫폼이 자동 주입) | `8080` |
| `SPRING_DATASOURCE_URL` | Postgres JDBC URL | `jdbc:postgresql://host:5432/veriproof` |
| `SPRING_DATASOURCE_USERNAME` | DB 사용자 | `postgres` |
| `SPRING_DATASOURCE_PASSWORD` | DB 비밀번호 | `********` |
| `REDIS_HOST` | Redis 호스트 | `redis.internal` |
| `REDIS_PORT` | Redis 포트 | `6379` |
| `REDIS_PASSWORD` | Redis 비밀번호 (없으면 비움) | `********` |
| `JWT_SECRET` | JWT 서명 키 (Base64, 운영 시 반드시 교체) | `aGVsbG8td29ybGQ...` |
| `FRONTEND_BASE_URL` | **배포된 앱의 공개 URL** (감독관 링크/QR 절대주소 조립용) | `https://veriproof.up.railway.app` |
| `FILE_UPLOAD_DIR` | 업로드 저장 경로 (컨테이너 내부 기본값 사용) | `/app/uploads/images` |
| `CORS_ALLOWED_ORIGINS` | 분리 배포 시에만 필요(올인원이면 무시 가능) | `https://veriproof.up.railway.app` |

> ⚠️ `FRONTEND_BASE_URL`은 배포 후 발급된 실제 도메인으로 반드시 채울 것. 비워두면 감독관 링크가 `localhost`로 생성됨.

---

## 방법 A. Railway (권장 — Postgres/Redis 관리형 + GitHub 연동)

1. **프로젝트 생성**: railway.app → New Project → *Deploy from GitHub repo* → 이 저장소, 브랜치 `deploy/all-in-one` 선택
2. **빌드 방식**: Railway가 루트 `Dockerfile`을 자동 감지해 Docker 빌드 (Nixpacks 아님)
3. **DB 추가**: 프로젝트에 *New → Database → PostgreSQL* 추가
4. **Redis 추가**: *New → Database → Redis* 추가
5. **환경 변수 연결**: 앱 서비스의 Variables 탭에서 위 표대로 입력.
   Railway는 DB/Redis 서비스의 값을 참조 변수로 끌어올 수 있다:
   - `SPRING_DATASOURCE_URL` = `jdbc:postgresql://${{Postgres.PGHOST}}:${{Postgres.PGPORT}}/${{Postgres.PGDATABASE}}`
   - `SPRING_DATASOURCE_USERNAME` = `${{Postgres.PGUSER}}`
   - `SPRING_DATASOURCE_PASSWORD` = `${{Postgres.PGPASSWORD}}`
   - `REDIS_HOST` = `${{Redis.REDISHOST}}` · `REDIS_PORT` = `${{Redis.REDISPORT}}` · `REDIS_PASSWORD` = `${{Redis.REDISPASSWORD}}`
   - `JWT_SECRET` = (직접 긴 랜덤 문자열)
6. **공개 도메인 발급**: 앱 서비스 Settings → Networking → *Generate Domain*
7. 발급된 도메인을 `FRONTEND_BASE_URL`에 입력 후 재배포
8. 배포 로그에서 Flyway 마이그레이션 성공 + `Started ...Application` 확인

## 방법 B. Render

1. New → *Web Service* → 저장소/브랜치 연결 → Runtime: **Docker** (루트 Dockerfile 자동 사용)
2. New → *PostgreSQL* / *Key Value(Redis)* 생성 후 Internal 접속 정보 확인
3. Web Service의 Environment에 위 표대로 변수 입력 (`PORT`는 Render가 주입)
4. 첫 배포 후 발급된 `*.onrender.com` 도메인을 `FRONTEND_BASE_URL`로 설정 후 재배포

> Render 무료 인스턴스는 일정 시간 미사용 시 잠드므로(cold start), **발표 직전 한 번 깨워두기**.

---

## 로컬에서 배포 이미지 그대로 검증

```powershell
# 1) DB/Redis 먼저 기동
docker compose up -d db redis

# 2) 올인원 이미지 빌드
docker build -t veriproof .

# 3) 실행 (host.docker.internal 로 로컬 DB/Redis 접속)
docker run --rm -p 8081:8081 `
  -e PORT=8081 `
  -e SPRING_DATASOURCE_URL="jdbc:postgresql://host.docker.internal:5432/veriproof" `
  -e SPRING_DATASOURCE_USERNAME=postgres `
  -e SPRING_DATASOURCE_PASSWORD=oracle `
  -e REDIS_HOST=host.docker.internal `
  -e FRONTEND_BASE_URL=http://localhost:8081 `
  veriproof
```

브라우저에서 `http://localhost:8081` → SPA 로딩, `/api/v1/...` 호출 동작 확인.

---

## 데모 전 체크리스트

- [ ] `FRONTEND_BASE_URL`이 실제 배포 도메인으로 설정됨 (감독관 링크/QR 정상)
- [ ] HTTPS 도메인으로 접속 (클립보드/전체화면 감지 정상 동작)
- [ ] 교수 계정 회원가입 → 시험 개설 → 코드/QR 발급 확인
- [ ] 학생 응시 흐름 + 감독관 대시보드 폴링(3초) 정상
- [ ] (Render 무료 플랜) 발표 직전 서비스 깨워두기
- [ ] 업로드 이미지는 재배포 시 휘발 → 발표 직전 시험 세팅, 또는 영속 볼륨 마운트
