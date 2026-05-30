// =====================================================================
// 오프라인 큐 — 네트워크 단절 복구 (백로그 23)
// =====================================================================
// 응시 중 네트워크가 끊기면 답안 저장/이벤트 전송이 실패한다. 기존엔 .catch(()=>{})로
// 그냥 유실됐다. 이 모듈은 모든 송신을 큐로 감싸:
//   - 온라인이면 즉시 전송
//   - 네트워크 오류(응답 없음)면 오프라인으로 전환 + 큐에 보관 후 3초마다 재시도
//   - 복구되면 큐를 순서대로 일괄 재전송 (누락 0)
//   - 복구 시 onReconnect 훅을 호출해 CONNECTION_LOST/RESTORED 마커 이벤트를 전송
//
// 답안 저장은 문항별 최신 1건만 의미 있으므로 coalesceKey로 합쳐 큐를 가볍게 유지한다.
// 이벤트/배치는 순서·전량 보존이 중요하므로 합치지 않는다.
// =====================================================================

const RETRY_INTERVAL_MS = 3000;

// navigator.onLine이 boolean이 아닌 환경(일부 런타임)에선 온라인으로 가정
function initialOnline() {
  return (typeof navigator === 'undefined' || typeof navigator.onLine !== 'boolean')
    ? true
    : navigator.onLine;
}

let online = initialOnline();
let offlineSince = null;            // ISO 문자열, 오프라인 진입 시각
let queue = [];                     // [{ key?, send: () => Promise }]
let flushing = false;
let retryTimer = null;
const subscribers = new Set();      // ({ online, offlineSince }) => void
let onReconnect = null;             // async (offlineSince, restoredAt) => void  (마커 전송용)

function notify() {
  const state = { online, offlineSince };
  subscribers.forEach((fn) => {
    try { fn(state); } catch { /* 구독자 오류 격리 */ }
  });
}

// axios/fetch 네트워크 오류 판별: 서버 응답이 아예 없으면 단절로 간주.
// (4xx/5xx는 서버에 도달한 것이므로 단절 아님 — 호출 측이 처리)
function isNetworkError(err) {
  if (!err) return false;
  if (err.response) return false;             // axios: 응답 있음 = 서버 도달
  if (err.code === 'ERR_NETWORK') return true;
  if (err.name === 'TypeError') return true;  // fetch 네트워크 실패
  return err.request !== undefined || err.message === 'Network Error';
}

function pushTask(task) {
  if (task.key) {
    const i = queue.findIndex((t) => t.key === task.key);
    if (i >= 0) queue.splice(i, 1); // 같은 키(예: 특정 문항 답안)는 최신으로 교체
  }
  queue.push(task);
}

function startRetry() {
  if (retryTimer) return;
  retryTimer = setInterval(() => { flush(); }, RETRY_INTERVAL_MS);
}
function stopRetry() {
  if (retryTimer) { clearInterval(retryTimer); retryTimer = null; }
}

function markOffline() {
  if (!online) return;
  online = false;
  offlineSince = new Date().toISOString();
  startRetry();
  notify();
}

async function markOnline() {
  if (online) return;
  const since = offlineSince;
  online = true;
  stopRetry();
  // 복구 마커(CONNECTION_LOST/RESTORED) 먼저 best-effort 전송
  if (onReconnect) {
    try { await onReconnect(since, new Date().toISOString()); } catch { /* 마커 실패는 무시 */ }
  }
  offlineSince = null;
  notify();
}

// 큐를 순서대로 비운다. 네트워크 오류를 만나면 오프라인 전환 후 중단(나머지는 보존).
async function flush() {
  if (flushing) return;
  flushing = true;
  try {
    while (queue.length > 0) {
      const task = queue[0];
      try {
        await task.send();
        queue.shift();
        if (!online) await markOnline(); // 오프라인 중 첫 성공 = 복구
      } catch (err) {
        if (isNetworkError(err)) { markOffline(); break; }
        queue.shift(); // 서버가 거부(4xx/5xx) = 재전송해도 동일 → 드롭
      }
    }
  } finally {
    flushing = false;
  }
}

// ---- 공개 API ----

/** 송신 작업을 큐에 넣고 즉시 전송 시도. key가 있으면 같은 key의 이전 작업을 대체(coalesce). */
export function enqueue(send, key) {
  pushTask({ send, key });
  flush();
}

/** 연결 상태 구독. 즉시 현재 상태 1회 통지. 해제 함수 반환. */
export function subscribeConnection(fn) {
  subscribers.add(fn);
  try { fn({ online, offlineSince }); } catch { /* noop */ }
  return () => subscribers.delete(fn);
}

/** 복구 시 호출될 훅 등록 (CONNECTION_LOST/RESTORED 마커 전송용). */
export function setReconnectHandler(fn) { onReconnect = fn; }

export function isOnline() { return online; }

/** 큐/상태 초기화 (세션 종료 시). */
export function resetQueue() {
  queue = [];
  stopRetry();
  online = initialOnline();
  offlineSince = null;
  onReconnect = null;
}

// 브라우저 온라인/오프라인 신호 연동
if (typeof window !== 'undefined') {
  window.addEventListener('offline', () => markOffline());
  window.addEventListener('online', () => { flush(); }); // 성공 시 flush가 markOnline 처리
}
