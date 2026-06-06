import { useLocation } from 'react-router-dom';

export default function ExamDone() {
  // 시간 만료 자동 제출이면 ExamSession에서 navigate state로 timeout=true를 넘긴다 (백로그 21).
  const timeout = useLocation().state?.timeout === true;

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.checkmark}>✓</div>
        <h1 style={styles.title}>제출 완료</h1>
        {timeout && <p style={styles.timeoutNote}>시간 만료로 자동 제출되었습니다.</p>}
        <p style={styles.subtitle}>시험 답안이 성공적으로 제출되었습니다.</p>
        <p style={styles.note}>이 창을 닫아도 됩니다.</p>
      </div>
    </div>
  );
}

const styles = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#f0f2f5',
  },
  card: {
    background: '#fff',
    borderRadius: 16,
    padding: '56px 48px',
    textAlign: 'center',
    width: 380,
    boxShadow: '0 4px 24px rgba(0,0,0,0.1)',
  },
  checkmark: {
    width: 72,
    height: 72,
    borderRadius: '50%',
    background: '#4caf50',
    color: '#fff',
    fontSize: 36,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '0 auto 24px',
    fontWeight: 700,
  },
  title: { margin: '0 0 12px', fontSize: 28, fontWeight: 700, color: '#1a1a1a' },
  timeoutNote: { margin: '0 0 8px', color: '#e53935', fontSize: 15, fontWeight: 700 },
  subtitle: { margin: '0 0 8px', color: '#555', fontSize: 16 },
  note: { color: '#aaa', fontSize: 14, margin: 0 },
};
