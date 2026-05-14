import { useState, useEffect, useRef, useCallback } from 'react';

// 이탈 감지 훅 - visibilitychange(탭 전환/최소화), fullscreenchange(ESC 해제), window blur(ALT+TAB) 이벤트 감지
export function useExamGuard({ requestFullscreen } = {}) {
  const [violationCount, setViolationCount] = useState(0);
  const [showWarning, setShowWarning] = useState(false);
  const isActive = useRef(true);
  const lastViolationTime = useRef(0);

  const handleViolation = useCallback(() => {
    if (!isActive.current) return;
    // 500ms 내 중복 이벤트 무시 (ESC 해제 시 blur + fullscreenchange 동시 발생 방지)
    const now = Date.now();
    if (now - lastViolationTime.current < 500) return;
    lastViolationTime.current = now;
    setViolationCount((c) => c + 1);
    setShowWarning(true);
  }, []);

  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden) handleViolation();
    };
    const handleFullscreen = () => {
      if (!document.fullscreenElement) handleViolation();
    };
    // ALT+TAB 또는 다른 앱 클릭 시 window가 포커스를 잃음
    const handleBlur = () => {
      handleViolation();
    };

    document.addEventListener('visibilitychange', handleVisibility);
    document.addEventListener('fullscreenchange', handleFullscreen);
    window.addEventListener('blur', handleBlur);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      document.removeEventListener('fullscreenchange', handleFullscreen);
      window.removeEventListener('blur', handleBlur);
    };
  }, [handleViolation]);

  // 경고 해제 + 전체화면 재진입
  const dismissWarning = useCallback(async () => {
    setShowWarning(false);
    if (requestFullscreen) await requestFullscreen();
  }, [requestFullscreen]);

  // 제출/종료 시 이탈 감지 비활성화
  const deactivate = useCallback(() => {
    isActive.current = false;
    setShowWarning(false);
  }, []);

  return { violationCount, showWarning, dismissWarning, deactivate };
}
