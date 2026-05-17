import { useEffect } from 'react';

export function useProctorSSE({ proctorToken, onStudentUpdated, onBehaviorEvent }) {
  useEffect(() => {
    if (!proctorToken) return;

    const es = new EventSource(`/api/v1/proctor/events?token=${proctorToken}`);

    es.addEventListener('student_updated', (e) => {
      try { onStudentUpdated?.(JSON.parse(e.data)); } catch {}
    });

    es.addEventListener('behavior_event', (e) => {
      try { onBehaviorEvent?.(JSON.parse(e.data)); } catch {}
    });

    // heartbeat: 연결 유지용, 별도 처리 불필요
    es.onerror = () => es.close();

    return () => es.close();
  }, [proctorToken, onStudentUpdated, onBehaviorEvent]);
}
