ㅇ# VeriProof 로컬 개발 환경 세팅 가이드

이 문서는 팀원 누구나 로컬에서 프로젝트를 실행할 수 있도록 작성된 가이드입니다.

---

## 전체 구조 요약

```
[프론트엔드 (React)]  →  [백엔드 (Spring Boot)]  →  [DB (PostgreSQL)]
   localhost:5173           localhost:8081              localhost:5432
      각자 실행               각자 실행               Docker로 자동 실행
```

- DB는 Docker로 띄웁니다 (설치만 하면 한 줄로 실행 가능)
- 백엔드/프론트엔드는 각자 IDE 또는 터미널에서 실행합니다

---

## 1단계: Docker Desktop 설치

Docker는 "가상 컨테이너"를 실행하는 프로그램입니다.  
쉽게 말해, 내 컴퓨터에 PostgreSQL을 직접 설치하지 않아도 Docker가 대신 띄워줍니다.

### Mac

1. https://www.docker.com/products/docker-desktop/ 접속
2. **Download for Mac** 클릭 (Apple Silicon / Intel 본인 맥에 맞는 것 선택)
   - M1, M2, M3, M4 맥이면 → **Apple Silicon**
   - 그 외 → **Intel**
3. 다운로드된 `.dmg` 파일 실행 → Applications 폴더로 드래그
4. Docker Desktop 실행 (처음에 권한 허용 물어보면 다 허용)
5. 상단 메뉴바에 고래 아이콘이 뜨면 준비 완료

### Windows

1. https://www.docker.com/products/docker-desktop/ 접속
2. **Download for Windows** 클릭
3. 설치 파일 실행 → 기본 설정 그대로 Next
4. 설치 중 **WSL 2** 관련 안내가 나오면:
   - "WSL 2 설치" 또는 "Enable WSL 2" 체크하고 진행
   - 재부팅이 필요할 수 있음
5. 설치 완료 후 Docker Desktop 실행
6. 트레이에 고래 아이콘이 뜨고 "Docker Desktop is running" 뜨면 준비 완료

> **WSL 2 에러가 나는 경우**  
> PowerShell을 관리자 권한으로 열고 아래 명령 실행 후 재부팅:
> ```
> wsl --install
> ```

---

## 2단계: 데이터베이스 실행 (Docker)

터미널(Mac) 또는 PowerShell/CMD(Windows)을 열고, 프로젝트 루트 폴더로 이동합니다.

```bash
cd 본인의/veriproof/프로젝트/경로
```

예시:
```bash
# Mac
cd ~/IdeaProjects/veriproof

# Windows
cd C:\Users\본인이름\IdeaProjects\veriproof
```

그 다음 아래 명령어 실행:

```bash
docker compose up -d
```

이게 끝입니다! 이 명령어 하나로:
- PostgreSQL 16 이미지를 자동으로 다운로드하고
- `veriproof`라는 데이터베이스를 생성하고
- 5432 포트로 접속 가능하게 띄워줍니다

### 잘 실행됐는지 확인

```bash
docker compose ps
```

아래처럼 `running` 상태면 성공:
```
NAME            STATUS
veriproof-db    Up 10 seconds
```

### DB 중지/재시작

```bash
# 중지
docker compose down

# 다시 시작
docker compose up -d
```

> 참고: `docker compose down`을 해도 데이터는 유지됩니다.  
> 데이터까지 완전히 날리고 싶으면: `docker compose down -v`

---

## 3단계: 백엔드 실행

### IntelliJ IDEA에서 실행 (권장)

1. IntelliJ에서 `backend` 폴더를 프로젝트로 열기
2. JDK 24 설정 확인 (File → Project Structure → SDK)
3. `VeriproofApplication.java` (메인 클래스) 찾아서 실행 (초록 재생 버튼)

### 터미널에서 실행

```bash
cd backend
./gradlew bootRun
```

Windows의 경우:
```bash
cd backend
gradlew.bat bootRun
```

실행 후 콘솔에 아래 비슷한 로그가 나오면 성공:
```
Started VeriproofApplication in X.XX seconds
```

- Swagger UI 확인: http://localhost:8081/swagger-ui.html

---

## 4단계: 프론트엔드 실행

```bash
cd frontend
npm install
npm run dev
```

실행 후 터미널에 뜨는 URL(보통 http://localhost:5173)로 접속하면 됩니다.

---

## 자주 발생하는 문제

### "port 5432 already in use"

이미 로컬에 PostgreSQL이 설치돼 있는 경우입니다.

- Mac: `brew services stop postgresql`
- Windows: 서비스에서 PostgreSQL 중지
- 또는 Docker Desktop에서 해당 컨테이너 삭제 후 다시 `docker compose up -d`

### "docker: command not found"

Docker Desktop이 실행 중인지 확인하세요 (메뉴바/트레이에 고래 아이콘).

### 백엔드 실행 시 DB 연결 에러

1. `docker compose ps`로 DB가 running 상태인지 확인
2. DB를 먼저 띄운 후 백엔드를 실행해야 합니다

### Flyway 마이그레이션 에러

DB를 초기화하고 다시 시작:
```bash
docker compose down -v
docker compose up -d
```
그 후 백엔드 다시 실행.

---

## 요약 (매일 개발 시작할 때)

```bash
# 1. Docker Desktop 실행 (이미 실행 중이면 스킵)

# 2. DB 띄우기
docker compose up -d

# 3. 백엔드 실행
cd backend
./gradlew bootRun

# 4. 프론트엔드 실행 (새 터미널에서)
cd frontend
npm install   # 처음 한 번만
npm run dev
```

끝!
