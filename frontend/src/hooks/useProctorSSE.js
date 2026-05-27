import { useEffect } from 'react';

export function useProctorSSE({ proctorToken, onStudentEvent, onAttentionUpdate, onSessionStatus }) {
  useEffect(() => {
    if (!proctorToken) return;

    const es = new EventSource(`/api/v1/proctor/exams/${proctorToken}/stream`);

    es.addEventListener('student-event', (e) => {
      try { onStudentEvent?.(JSON.parse(e.data)); } catch {}
    });

    es.addEventListener('attention-update', (e) => {
      try { onAttentionUpdate?.(JSON.parse(e.data)); } catch {}
    });

    es.addEventListener('session-status', (e) => {
      try { onSessionStatus?.(JSON.parse(e.data)); } catch {}
    });

    // heartbeat: 연결 유지용, 별도 처리 불필요
    es.onerror = () => es.close();

    return () => es.close();
  }, [proctorToken, onStudentEvent, onAttentionUpdate, onSessionStatus]);
}
