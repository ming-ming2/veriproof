import { useState, useEffect } from 'react';

// 화면 폭이 breakpoint 미만이면 모바일로 간주.
// 인라인 스타일 환경이라 CSS 미디어쿼리 대신 런타임에 스타일을 분기하기 위한 훅.
export function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(
    typeof window !== 'undefined' && window.innerWidth < breakpoint
  );

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < breakpoint);
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [breakpoint]);

  return isMobile;
}
