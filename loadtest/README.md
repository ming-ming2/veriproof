# 백로그 22 — 동시 응시 부하 검증

100명의 가상 학생이 동일 시험에 동시에 응시하며 이벤트를 발생시키고, 감독관 대시보드 갱신
응답시간과 이벤트 손실, 답안/스냅샷 저장을 검증하는 부하 테스트 스크립트.

의존성 없음 (Node 18+ 내장 `fetch` 사용).

## 사전 준비

백엔드 + DB + Redis가 떠 있어야 함.

```bash
docker compose up -d            # postgres + redis
cd backend && ./gradlew bootRun # 8081 포트
```

## 실행

```bash
node loadtest/backlog22-load-test.mjs
```

환경변수로 조정:

| 변수 | 기본값 | 설명 |
|---|---|---|
| `BASE_URL` | `http://localhost:8081/api/v1` | API base |
| `STUDENTS` | `100` | 가상 학생 수 |
| `DURATION_SEC` | `60` | 학생별 응시 지속 시간 (데모 30분이면 `1800`) |
| `EVENT_INTERVAL_MS` | `5000` | 즉시 이벤트 주기 |
| `PROCTOR_POLL_MS` | `1000` | 감독관 대시보드 폴링 주기 |
| `LATENCY_SLA_MS` | `1000` | 대시보드 갱신 SLA |
| `DB_CONTAINER` | `veriproof-db` | DB 교차검증용 도커 컨테이너명 (비우면 생략) |

예) `STUDENTS=100 DURATION_SEC=60 node loadtest/backlog22-load-test.mjs`

## 검증 항목 (판정)

1. **대시보드 1초 이내 갱신** — `GET /proctor/exams/{token}/students` 응답시간 p95 ≤ SLA
2. **이벤트 손실 0건** — 서버 ingest는 `@Transactional` 동기 저장이라 204 = 영속화 완료.
   2xx가 아닌 이벤트 요청 수 = 손실. 0이어야 PASS.
3. **전원 응시 시작 / 전원 제출 완료**
4. **답안/스냅샷 저장** — 도커 DB로 `event_log` / `answer_snapshot` / `SUBMITTED` 세션 수 교차검증

종료 코드: 전부 PASS면 0, 하나라도 FAIL이면 1.

## 참고

- 스크립트가 `부하검증-<timestamp>` 제목의 시험을 매 실행 새로 개설한다. dev DB 정리 시:
  ```bash
  docker exec veriproof-db psql -U postgres -d veriproof -c "DELETE FROM exam WHERE title LIKE '부하검증-%';"
  ```
- 짧은 `DURATION_SEC`(<12s)이면 배치/스냅샷 단계가 발생하지 않아 4번 항목이 FAIL날 수 있음 — 최소 30~60초 권장.
