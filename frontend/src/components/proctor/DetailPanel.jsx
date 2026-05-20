import React from 'react';

const EVENT_LABEL = {
  PASTE: '붙여넣기',
  VISIBILITY_LOST: '화면 이탈',
  VISIBILITY_RESTORED: '화면 복귀',
  FULLSCREEN_EXIT: '전체화면 해제',
  FULLSCREEN_ENTER: '전체화면 복귀',
  CAPTURE_SHORTCUT: '화면 캡처',
  WINDOW_BLUR: '창 포커스 손실',
  SUSPICIOUS_CHOICE_CHANGE: '의심 선택지 변경',
};

export default function DetailPanel({ student, onClose }) {
  if (!student) {
    return (
      <div style={styles.backdrop} onClick={onClose}>
        <div style={styles.panel} onClick={(e) => e.stopPropagation()}>
          <button style={styles.closeBtn} onClick={onClose}>✕</button>
          <p style={{ color: '#999', marginTop: 40, textAlign: 'center' }}>로딩 중...</p>
        </div>
      </div>
    );
  }

  const {
    studentName, studentNumber,
    attentionScore, attentionLevel,
    signals,
    avgVisibilityDurationMs,
    recentEvents,
    currentAnswerPreview,
  } = student;

  return (
    <div style={styles.backdrop} onClick={onClose}>
      <div style={styles.panel} onClick={(e) => e.stopPropagation()}>
        <button style={styles.closeBtn} onClick={onClose}>✕</button>

        <h2 style={styles.heading}>
          {studentName} <span style={styles.sub}>({studentNumber})</span>
        </h2>
        <p style={styles.meta}>주목도 {attentionScore}점 · {attentionLevel}</p>

        {signals && (
          <section style={styles.section}>
            <h3 style={styles.sectionTitle}>이상 신호 요약</h3>
            <div style={styles.grid}>
              <Stat label="붙여넣기" value={signals.paste} />
              <Stat label="화면 이탈" value={signals.visibilityLost} />
              <Stat label="전체화면 해제" value={signals.fullscreenExit} />
              <Stat label="화면 캡처" value={signals.captureShortcut} />
              <Stat label="의심 선택 변경" value={signals.suspiciousChoiceChange} />
              <Stat
                label="평균 이탈 시간"
                value={avgVisibilityDurationMs != null
                  ? `${(avgVisibilityDurationMs / 1000).toFixed(1)}초`
                  : '-'}
              />
            </div>
          </section>
        )}

        {recentEvents?.length > 0 && (
          <section style={styles.section}>
            <h3 style={styles.sectionTitle}>최근 이벤트</h3>
            <div style={styles.timeline}>
              {recentEvents.map((ev, i) => (
                <div key={i} style={styles.timelineRow}>
                  <span style={styles.timeLabel}>
                    {new Date(ev.occurredAt).toLocaleTimeString('ko-KR')}
                  </span>
                  <span style={styles.eventText}>
                    {EVENT_LABEL[ev.type] || ev.type}
                    {ev.questionId != null && ` (문항 ${ev.questionId})`}
                    {ev.durationMs != null && (
                      <span style={styles.duration}> {(ev.durationMs / 1000).toFixed(1)}초</span>
                    )}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        {currentAnswerPreview && (
          <section style={styles.section}>
            <h3 style={styles.sectionTitle}>현재 답안 미리보기</h3>
            <div style={styles.answerBox}>
              <div style={styles.qLabel}>문항 {currentAnswerPreview.questionId}</div>
              {currentAnswerPreview.answerText ? (
                <p style={styles.answerText}>{currentAnswerPreview.answerText}</p>
              ) : (
                <p style={styles.answerText}>
                  선택지: {currentAnswerPreview.selectedChoiceIds?.join(', ') || '(없음)'}
                </p>
              )}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div style={statStyles.box}>
      <div style={statStyles.value}>{value ?? 0}</div>
      <div style={statStyles.label}>{label}</div>
    </div>
  );
}

const statStyles = {
  box: { textAlign: 'center', padding: '8px 4px' },
  value: { fontSize: 22, fontWeight: 700, color: '#1a1a1a' },
  label: { fontSize: 11, color: '#888', marginTop: 2 },
};

const styles = {
  backdrop: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)',
    zIndex: 200, display: 'flex', justifyContent: 'flex-end',
  },
  panel: {
    width: 400, height: '100%', background: '#fff', overflowY: 'auto',
    padding: '28px 24px', position: 'relative',
    boxShadow: '-4px 0 20px rgba(0,0,0,0.15)',
  },
  closeBtn: {
    position: 'absolute', top: 16, right: 16,
    background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#666',
  },
  heading: { fontSize: 20, fontWeight: 700, margin: '0 0 4px' },
  sub: { fontWeight: 400, fontSize: 14, color: '#888' },
  meta: { color: '#666', fontSize: 14, margin: '0 0 20px' },
  section: { marginBottom: 24 },
  sectionTitle: {
    fontSize: 13, fontWeight: 700, color: '#555', margin: '0 0 10px',
    borderBottom: '1px solid #f0f0f0', paddingBottom: 6,
  },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 },
  timeline: { display: 'flex', flexDirection: 'column', gap: 8 },
  timelineRow: { display: 'flex', gap: 10, alignItems: 'baseline', fontSize: 13 },
  timeLabel: { color: '#bbb', fontSize: 11, flexShrink: 0 },
  eventText: { color: '#333' },
  duration: { color: '#e53935', fontSize: 12 },
  answerBox: { padding: '10px 12px', background: '#f9f9f9', borderRadius: 8 },
  qLabel: { fontSize: 12, fontWeight: 700, color: '#666', marginBottom: 4 },
  answerText: { fontSize: 13, color: '#333', margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all' },
};
