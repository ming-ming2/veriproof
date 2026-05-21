import axiosInstance from './axiosInstance';

// 시험 코드로 시험 메타 조회 (무인증)
export const lookupExam = (code) =>
  axiosInstance.get(`/student/exams/lookup?code=${code}`);

// 세션 시작 + sessionToken 발급 (무인증)
export const startSession = (examCode, data) =>
  axiosInstance.post(`/student/exams/${examCode}/sessions`, data);

// 재접속 시 세션 + 문항 + 답안 이전 조회 [X-Session-Token]
export const getSession = (sessionToken) =>
  axiosInstance.get('/student/sessions/me', {
    headers: { 'X-Session-Token': sessionToken },
  });

// 단일 문항 답안 자동저장 [X-Session-Token]
export const saveAnswer = (questionId, data, sessionToken) =>
  axiosInstance.put(`/student/sessions/me/answers/${questionId}`, data, {
    headers: { 'X-Session-Token': sessionToken },
  });

// 최종 제출 [X-Session-Token]
export const submitExam = (sessionToken) =>
  axiosInstance.post('/student/sessions/me/submit', null, {
    headers: { 'X-Session-Token': sessionToken },
  });

// heartbeat - 10초 주기 lock TTL 갱신 [X-Session-Token]
export const sendHeartbeat = (sessionToken) =>
  axiosInstance.post('/student/sessions/me/heartbeat', null, {
    headers: { 'X-Session-Token': sessionToken },
  });

// 즉시 이벤트 전송 (백로그 13) [X-Session-Token]
export const sendInstantEvents = (sessionToken, events) =>
  axiosInstance.post('/student/sessions/me/events', { events }, {
    headers: { 'X-Session-Token': sessionToken },
  });

// 배치 이벤트 + 답안 스냅샷 전송 (백로그 14) [X-Session-Token]
export const sendBatchEvents = (sessionToken, data) =>
  axiosInstance.post('/student/sessions/me/events/batch', data, {
    headers: { 'X-Session-Token': sessionToken },
  });
