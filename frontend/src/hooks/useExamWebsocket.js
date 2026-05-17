import { useRef, useEffect, useCallback } from 'react';

export function useExamWebsocket({ sessionToken }) {
  const wsRef = useRef(null);
  const currentQuestionIdRef = useRef(null);
  const tabAwayTimeRef = useRef(null);
  const isActiveRef = useRef(true);

  useEffect(() => {
    if (!sessionToken) return;
    const ws = new WebSocket(
      `ws://localhost:8081/api/v1/student/sessions/me/ws?token=${sessionToken}`
    );
    wsRef.current = ws;
    return () => { ws.close(); };
  }, [sessionToken]);

  const sendWsEvent = useCallback((type, extra = {}) => {
    if (!isActiveRef.current) return;
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify({
      type,
      questionId: currentQuestionIdRef.current,
      timestamp: new Date().toISOString(),
      ...extra,
    }));
  }, []);

  // 브라우저 이벤트 → WS 전송
  useEffect(() => {
    if (!sessionToken) return;

    const handleVisibility = () => {
      if (document.hidden) {
        tabAwayTimeRef.current = Date.now();
        sendWsEvent('TAB_AWAY');
      } else {
        const duration = tabAwayTimeRef.current
          ? parseFloat(((Date.now() - tabAwayTimeRef.current) / 1000).toFixed(1))
          : 0;
        tabAwayTimeRef.current = null;
        sendWsEvent('TAB_RETURN', { duration });
      }
    };

    const handleFullscreen = () => {
      if (!document.fullscreenElement) sendWsEvent('FULLSCREEN_EXIT');
    };

    // document가 visible한 상태의 blur = 포커스 손실 (스크린샷, 알림 등)
    const handleBlur = () => {
      if (!document.hidden) sendWsEvent('FOCUS_LOSS');
    };

    const handlePaste = () => sendWsEvent('PASTE');

    document.addEventListener('visibilitychange', handleVisibility);
    document.addEventListener('fullscreenchange', handleFullscreen);
    document.addEventListener('paste', handlePaste);
    window.addEventListener('blur', handleBlur);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      document.removeEventListener('fullscreenchange', handleFullscreen);
      document.removeEventListener('paste', handlePaste);
      window.removeEventListener('blur', handleBlur);
    };
  }, [sessionToken, sendWsEvent]);

  const setCurrentQuestionId = useCallback((id) => {
    currentQuestionIdRef.current = id;
  }, []);

  const deactivate = useCallback(() => {
    isActiveRef.current = false;
  }, []);

  return { setCurrentQuestionId, deactivate };
}
