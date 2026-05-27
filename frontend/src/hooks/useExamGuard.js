import { useState, useEffect, useRef, useCallback } from 'react';

// 이탈 감지 훅 - visibilitychange(탭 전환/최소화), fullscreenchange(ESC 해제), window blur(ALT+TAB), Ctrl+C/V 감지
export function useExamGuard({ requestFullscreen } = {}) {
  const [violationCount, setViolationCount] = useState(0);
  const [showWarning, setShowWarning] = useState(false);
  const [lastViolationType, setLastViolationType] = useState(null);
  const isActive = useRef(true);
  const lastViolationTime = useRef(0);

  const handleViolation = useCallback((type = 'default') => {
    if (!isActive.current) return;
    // 500ms 내 중복 이벤트 무시 (ESC 해제 시 blur + fullscreenchange 동시 발생 방지)
    // 단, copy/paste는 중복 억제 없이 항상 표시
    const now = Date.now();
    if (type !== 'copy' && type !== 'paste' && now - lastViolationTime.current < 500) return;
    lastViolationTime.current = now;
    setLastViolationType(type);
    setViolationCount((c) => c + 1);
    setShowWarning(true);
  }, []);

  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden) handleViolation('tab');
    };
    const handleFullscreen = () => {
      if (!document.fullscreenElement) handleViolation('fullscreen');
    };
    // ALT+TAB 또는 다른 앱 클릭 시 window가 포커스를 잃음
    const handleBlur = () => {
      handleViolation('blur');
    };
    const handleKeyDown = (e) => {
      if (e.ctrlKey && e.key === 'c') handleViolation('copy');
      if (e.ctrlKey && e.key === 'v') handleViolation('paste');
    };

    document.addEventListener('visibilitychange', handleVisibility);
    document.addEventListener('fullscreenchange', handleFullscreen);
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('blur', handleBlur);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      document.removeEventListener('fullscreenchange', handleFullscreen);
      document.removeEventListener('keydown', handleKeyDown);
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

  return { violationCount, showWarning, lastViolationType, dismissWarning, deactivate };
}
