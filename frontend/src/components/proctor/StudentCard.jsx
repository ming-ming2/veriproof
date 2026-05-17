import React from 'react';

const LEVEL_CONFIG = {
  HIGH:        { icon: '🔥', label: '강조', border: '#e53935', bg: '#ffebee', color: '#e53935' },
  MEDIUM_HIGH: { icon: '⚠️', label: '주의', border: '#f57c00', bg: '#fff3e0', color: '#f57c00' },
  MEDIUM_LOW:  { icon: '⚡', label: '보통', border: '#757575', bg: '#f5f5f5', color: '#757575' },
  LOW:         { icon: '✅', label: '양호', border: '#2e7d32', bg: '#e8f5e9', color: '#2e7d32' },
};

function StudentCard({ student, onClick }) {
  const cfg = LEVEL_CONFIG[student.attentionLevel] || LEVEL_CONFIG.LOW;
  const lastTime = student.lastActivityAt
    ? new Date(student.lastActivityAt).toLocaleTimeString('ko-KR')
    : '-';
  const { signalSummary: sig } = student;

  return (
    <div
      style={{ ...styles.card, borderLeft: `4px solid ${cfg.border}`, background: cfg.bg }}
      onClick={() => onClick(student)}
    >
      <div style={styles.row}>
        <span style={{ ...styles.levelLabel, color: cfg.color }}>{cfg.icon} {cfg.label}</span>
        <span style={styles.score}>{student.attentionScore}점</span>
      </div>
      <div style={styles.name}>{student.studentName}</div>
      <div style={styles.number}>{student.studentNumber}</div>
      <div style={styles.meta}>
        문항 {student.currentQuestionOrder ?? '-'}번 · {lastTime}
      </div>
      {sig && (
        <div style={styles.signals}>
          {sig.tabAwayCount > 0 && <span style={styles.tag}>탭이탈 {sig.tabAwayCount}</span>}
          {sig.pasteCount > 0 && <span style={styles.tag}>붙여넣기 {sig.pasteCount}</span>}
          {sig.focusLossCount > 0 && <span style={styles.tag}>포커스손실 {sig.focusLossCount}</span>}
          {sig.fullscreenExitCount > 0 && <span style={styles.tag}>전체화면해제 {sig.fullscreenExitCount}</span>}
        </div>
      )}
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
  meta: { fontSize: 12, color: '#555', marginBottom: 6 },
  signals: { display: 'flex', gap: 4, flexWrap: 'wrap' },
  tag: { fontSize: 11, background: 'rgba(0,0,0,0.07)', padding: '2px 6px', borderRadius: 8, color: '#444' },
};
