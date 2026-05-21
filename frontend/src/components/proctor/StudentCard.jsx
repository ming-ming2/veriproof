import React from 'react';

// 스펙: HIGH(≥4 빨강), MID(≥2 주황), LOW(≥1 노랑), NORMAL(0 기본)
const LEVEL_CONFIG = {
  HIGH:   { label: '강조', border: '#e53935', bg: '#ffebee', color: '#e53935' },
  MID:    { label: '주의', border: '#f57c00', bg: '#fff3e0', color: '#f57c00' },
  LOW:    { label: '보통', border: '#f9a825', bg: '#fffde7', color: '#f9a825' },
  NORMAL: { label: '평범', border: '#bdbdbd', bg: '#fafafa', color: '#757575' },
};

function StudentCard({ student, onClick }) {
  const cfg = LEVEL_CONFIG[student.attentionLevel] || LEVEL_CONFIG.NORMAL;
  const lastTime = student.lastActivityAt
    ? new Date(student.lastActivityAt).toLocaleTimeString('ko-KR')
    : '-';
  const isSubmitted = student.status === 'SUBMITTED';

  return (
    <div
      style={{
        ...styles.card,
        borderLeft: `4px solid ${cfg.border}`,
        background: cfg.bg,
        opacity: isSubmitted ? 0.55 : 1,
      }}
      onClick={() => !isSubmitted && onClick(student)}
    >
      <div style={styles.row}>
        <span style={{ ...styles.levelLabel, color: cfg.color }}>{cfg.label}</span>
        <span style={styles.score}>{student.attentionScore ?? 0}점</span>
      </div>
      <div style={styles.name}>{student.studentName}</div>
      <div style={styles.number}>{student.studentNumber}</div>
      <div style={styles.meta}>
        문항 {student.currentQuestionId ?? '-'} · {lastTime}
      </div>
      {isSubmitted && <div style={styles.submittedBadge}>제출 완료</div>}
    </div>
  );
}

export default React.memo(StudentCard);

const styles = {
  card: {
    padding: '14px 16px', borderRadius: 10, cursor: 'pointer',
    boxShadow: '0 1px 4px rgba(0,0,0,0.08)', transition: 'box-shadow 0.15s',
  },
  row: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  levelLabel: { fontSize: 12, fontWeight: 700 },
  score: { fontSize: 13, fontWeight: 700, color: '#333' },
  name: { fontSize: 15, fontWeight: 700, color: '#1a1a1a', marginBottom: 2 },
  number: { fontSize: 12, color: '#888', marginBottom: 6 },
  meta: { fontSize: 12, color: '#555' },
  submittedBadge: {
    marginTop: 6, fontSize: 11, color: '#9e9e9e',
    background: 'rgba(0,0,0,0.06)', padding: '2px 8px',
    borderRadius: 8, display: 'inline-block',
  },
};
