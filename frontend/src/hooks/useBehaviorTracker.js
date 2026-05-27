import { useRef, useEffect, useCallback } from 'react';
import { sendBatchEvents } from '../api/exam-session';

export function useBehaviorTracker({ sessionToken, getAnswers, getQuestions }) {
  const periodStartRef = useRef(new Date().toISOString());
  const eventsRef = useRef([]);

  const buildPayload = useCallback(() => {
    const now = new Date().toISOString();
    const answers = getAnswers?.() || {};
    const questions = getQuestions?.() || [];

    const snapshots = questions
      .map((q) => ({
        questionId: q.id,
        capturedAt: now,
        answerText: answers[q.id]?.answerText || null,
        selectedChoiceIds: answers[q.id]?.selectedChoiceIds?.length > 0
          ? answers[q.id].selectedChoiceIds
          : null,
      }))
      .filter((s) => s.answerText || s.selectedChoiceIds);

    const payload = {
      batchPeriodStart: periodStartRef.current,
      batchPeriodEnd: now,
      events: eventsRef.current,
      snapshots,
    };
    periodStartRef.current = now;
    eventsRef.current = [];
    return payload;
  }, [getAnswers, getQuestions]);

  const flush = useCallback(async () => {
    if (!sessionToken) return;
    const payload = buildPayload();
    if (payload.events.length === 0 && payload.snapshots.length === 0) return;
    try { await sendBatchEvents(sessionToken, payload); } catch {}
  }, [sessionToken, buildPayload]);

  // 1분 주기 자동 전송
  useEffect(() => {
    if (!sessionToken) return;
    const id = setInterval(flush, 60000);
    return () => clearInterval(id);
  }, [sessionToken, flush]);

  // 페이지 언로드 시 keepalive로 잔여 데이터 전송
  useEffect(() => {
    if (!sessionToken) return;
    const handleBeforeUnload = () => {
      const payload = buildPayload();
      fetch('/api/v1/student/sessions/me/events/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Session-Token': sessionToken },
        body: JSON.stringify(payload),
        keepalive: true,
      });
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [sessionToken, buildPayload]);

  const trackKeystroke = useCallback((questionId, key, action) => {
    eventsRef.current.push({
      type: 'KEYSTROKE',
      occurredAt: new Date().toISOString(),
      questionId,
      payload: { key, action },
    });
  }, []);

  /**
   * Cursor 위치 기반 편집 이벤트. 재생 시 splice로 재구성하여 중간편집·선택치환·IME 모두 정확.
   * payload 형식: { pos, removeLen, insert } — text = text.slice(0,pos) + insert + text.slice(pos+removeLen)
   */
  const trackEdit = useCallback((questionId, pos, removeLen, insert) => {
    eventsRef.current.push({
      type: 'KEYSTROKE',
      occurredAt: new Date().toISOString(),
      questionId,
      payload: { pos, removeLen, insert },
    });
  }, []);

  const trackChoiceChange = useCallback((questionId, fromChoiceIds, toChoiceIds) => {
    eventsRef.current.push({
      type: 'CHOICE_CHANGE',
      occurredAt: new Date().toISOString(),
      questionId,
      payload: { from: fromChoiceIds, to: toChoiceIds },
    });
  }, []);

  const trackNavigation = useCallback((fromQuestionId, toQuestionId) => {
    if (!fromQuestionId || !toQuestionId || fromQuestionId === toQuestionId) return;
    eventsRef.current.push({
      type: 'QUESTION_NAVIGATE',
      occurredAt: new Date().toISOString(),
      payload: { fromQuestionId, toQuestionId },
    });
  }, []);

  return { trackKeystroke, trackEdit, trackChoiceChange, trackNavigation, flushBeforeSubmit: flush };
}
