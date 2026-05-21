import { useRef, useEffect, useCallback } from 'react';
import { sendInstantEvents } from '../api/exam-session';

export function useExamWebsocket({ sessionToken }) {
  const currentQuestionIdRef = useRef(null);
  const isActiveRef = useRef(true);

  const postEvent = useCallback((type, payload) => {
    if (!isActiveRef.current || !sessionToken) return;
    const event = {
      type,
      occurredAt: new Date().toISOString(),
      questionId: currentQuestionIdRef.current,
      ...(payload !== undefined ? { payload } : {}),
    };
    sendInstantEvents(sessionToken, [event]).catch(() => {});
  }, [sessionToken]);

  useEffect(() => {
    if (!sessionToken) return;

    const handleVisibility = () => {
      if (document.hidden) {
        postEvent('VISIBILITY_LOST');
      } else {
        postEvent('VISIBILITY_RESTORED');
      }
    };

    const handleFullscreen = () => {
      if (!document.fullscreenElement) {
        postEvent('FULLSCREEN_EXIT');
      } else {
        postEvent('FULLSCREEN_ENTER');
      }
    };

    // document가 visible한 상태에서만 WINDOW_BLUR 전송 (탭 전환과 중복 방지)
    const handleBlur = () => {
      if (!document.hidden) postEvent('WINDOW_BLUR');
    };

    const handlePaste = (e) => {
      const text = e.clipboardData?.getData('text') || '';
      // paste 시점에 선택 영역이 있으면 그 길이만큼이 함께 덮어써진다.
      // replay 복원 시 이 값으로 paste 블록 앞부분을 먼저 제거한다.
      const tgt = e.target;
      const selectedLength =
        tgt && typeof tgt.selectionStart === 'number' && typeof tgt.selectionEnd === 'number'
          ? Math.abs(tgt.selectionEnd - tgt.selectionStart)
          : 0;
      postEvent('PASTE', {
        length: text.length,
        preview: text.slice(0, 50),
        selectedLength,
      });
    };

    const handleKeyDown = (e) => {
      // PrtScn(Windows), Meta+Shift+3/4/5(Mac) 감지
      if (
        e.key === 'PrintScreen' ||
        (e.metaKey && e.shiftKey && ['3', '4', '5'].includes(e.key))
      ) {
        postEvent('CAPTURE_SHORTCUT', { key: e.key });
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    document.addEventListener('fullscreenchange', handleFullscreen);
    document.addEventListener('paste', handlePaste);
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('blur', handleBlur);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      document.removeEventListener('fullscreenchange', handleFullscreen);
      document.removeEventListener('paste', handlePaste);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('blur', handleBlur);
    };
  }, [sessionToken, postEvent]);

  const setCurrentQuestionId = useCallback((id) => {
    currentQuestionIdRef.current = id;
  }, []);

  const deactivate = useCallback(() => {
    isActiveRef.current = false;
  }, []);

  return { setCurrentQuestionId, deactivate };
}
