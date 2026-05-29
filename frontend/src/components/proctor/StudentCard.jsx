import React from 'react';

const LEVEL_CONFIG = {
  HIGH:   { border: '#e53935', color: '#e53935' },
  MID:    { border: '#f57c00', color: '#f57c00' },
  LOW:    { border: '#f9a825', color: '#f9a825' },
  NORMAL: { border: '#bdbdbd', color: '#9e9e9e' },
};

function StudentCard({ student, onClick }) {
  const cfg = LEVEL_CONFIG[student.attentionLevel] || LEVEL_CONFIG.NORMAL;
  const lastTime = student.lastActivityAt
    ? new Date(student.lastActivityAt).toLocaleTimeString('ko-KR', {
        hour: '2-digit',
        minute: '2-digit',
      })
    : '-';
  const isSubmitted = student.status === 'SUBMITTED';

  return (
    <div
      style={{
        ...styles.card,
        borderLeft: `3px solid ${isSubmitted ? '#e0e0e0' : cfg.border}`,
        opacity: isSubmitted ? 0.5 : 1,
        cursor: isSubmitted ? 'default' : 'pointer',
      }}
      onClick={() => !isSubmitted && onClick(student)}
      onMouseEnter={(e) => {
        if (!isSubmitted) e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.12)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.06)';
      }}
    >
      <div style={styles.topRow}>
        <span style={styles.name}>{student.studentName}</span>
        {isSubmitted ? (
          <span style={styles.submittedTag}>제출</span>
        ) : (
          <span style={{ ...styles.score, color: cfg.color }}>
            {student.attentionScore ?? 0}
          </span>
        )}
      </div>
      <div style={styles.bottomRow}>
        <span style={styles.number}>{student.studentNumber}</span>
        {!isSubmitted && (
          <>
            <span style={styles.sep}>·</span>
            <span style={styles.meta}>문항 {student.currentQuestionId ?? '-'}</span>
            <span style={styles.sep}>·</span>
            <span style={styles.meta}>{lastTime}</span>
          </>
        )}
      </div>
    </div>
  );
}

export default React.memo(StudentCard);

const styles = {
  card: {
    padding: '10px 12px',
    borderRadius: 8,
    background: '#fff',
    boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
    transition: 'box-shadow 0.15s',
  },
  topRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  name: {
    fontSize: 14,
    fontWeight: 600,
    color: '#1a1a1a',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  score: {
    fontSize: 14,
    fontWeight: 700,
    flexShrink: 0,
    marginLeft: 6,
  },
  bottomRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    flexWrap: 'nowrap',
    overflow: 'hidden',
  },
  number: {
    fontSize: 11,
    color: '#888',
    fontFamily: '"SF Mono", "Fira Code", monospace',
    flexShrink: 0,
  },
  sep: { fontSize: 11, color: '#ccc', flexShrink: 0 },
  meta: {
    fontSize: 11,
    color: '#aaa',
    flexShrink: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  submittedTag: {
    fontSize: 10,
    color: '#9e9e9e',
    background: '#f0f0f0',
    padding: '2px 6px',
    borderRadius: 4,
    flexShrink: 0,
  },
};
