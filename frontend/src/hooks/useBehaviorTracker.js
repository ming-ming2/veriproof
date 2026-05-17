import { useRef, useEffect, useCallback } from 'react';
import { sendBehaviorLogs } from '../api/exam-session';

export function useBehaviorTracker({ sessionToken }) {
  const periodStartRef = useRef(new Date().toISOString());
  const keystrokesRef = useRef({});     // { [questionId]: count }
  const choiceChangesRef = useRef([]);
  const navigationsRef = useRef([]);

  const buildPayload = () => {
    const now = new Date().toISOString();
    const payload = {
      periodStartAt: periodStartRef.current,
      periodEndAt: now,
      keystrokes: Object.entries(keystrokesRef.current).map(([qId, count]) => ({
        questionId: Number(qId),
        count,
      })),
      choiceChanges: choiceChangesRef.current,
      questionNavigations: navigationsRef.current,
    };
    periodStartRef.current = now;
    keystrokesRef.current = {};
    choiceChangesRef.current = [];
    navigationsRef.current = [];
    return payload;
  };

  const flush = useCallback(async () => {
    if (!sessionToken) return;
    const payload = buildPayload();
    try { await sendBehaviorLogs(sessionToken, payload); } catch {}
  }, [sessionToken]);

  // 1분 주기 자동 전송
  useEffect(() => {
    if (!sessionToken) return;
    const id = setInterval(flush, 60000);
    return () => clearInterval(id);
  }, [sessionToken, flush]);

  // 페이지 언로드 시 fetch keepalive로 잔여 데이터 전송
  useEffect(() => {
    if (!sessionToken) return;
    const handleBeforeUnload = () => {
      const payload = buildPayload();
      fetch('/api/v1/student/sessions/me/behavior-logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Session-Token': sessionToken },
        body: JSON.stringify(payload),
        keepalive: true,
      });
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [sessionToken]);

  const trackKeystroke = useCallback((questionId) => {
    keystrokesRef.current[questionId] = (keystrokesRef.current[questionId] || 0) + 1;
  }, []);

  const trackChoiceChange = useCallback((questionId, fromChoiceIds, toChoiceIds) => {
    choiceChangesRef.current.push({
      questionId,
      fromChoiceIds,
      toChoiceIds,
      changedAt: new Date().toISOString(),
    });
  }, []);

  const trackNavigation = useCallback((fromQuestionId, toQuestionId) => {
    if (!fromQuestionId || !toQuestionId || fromQuestionId === toQuestionId) return;
    navigationsRef.current.push({
      fromQuestionId,
      toQuestionId,
      navigatedAt: new Date().toISOString(),
    });
  }, []);

  return { trackKeystroke, trackChoiceChange, trackNavigation, flushBeforeSubmit: flush };
}
