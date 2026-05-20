import React, { memo } from 'react';

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

// 이벤트 타입별 강조 색상
const EVENT_COLOR = {
  PASTE: '#e53935',
  VISIBILITY_LOST: '#f57c00',
  SUSPICIOUS_CHOICE_CHANGE: '#e53935',
  CAPTURE_SHORTCUT: '#e53935',
  FULLSCREEN_EXIT: '#f57c00',
  WINDOW_BLUR: '#757575',
};

function EventFeed({ events }) {
  return (
    <div style={styles.container}>
      <h3 style={styles.title}>실시간 이벤트 피드</h3>
      <div style={styles.feed}>
        {events.length === 0 ? (
          <p style={styles.empty}>이벤트 없음</p>
        ) : (
          events.map((ev, i) => {
            const label = EVENT_LABEL[ev.type] || ev.type;
            const accentColor = EVENT_COLOR[ev.type] || '#9e9e9e';
            return (
              <div key={ev.id ?? i} style={{ ...styles.item, borderLeftColor: accentColor }}>
                <span style={styles.time}>
                  {new Date(ev.occurredAt).toLocaleTimeString('ko-KR')}
                </span>
                <span style={styles.name}>{ev.studentNumber}</span>
                <span style={{ ...styles.desc, color: accentColor }}>
                  {label}
                  {ev.questionId != null && ` · 문항 ${ev.questionId}`}
                  {ev.durationMs != null && ` (${(ev.durationMs / 1000).toFixed(1)}초)`}
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

export default memo(EventFeed);

const styles = {
  container: { display: 'flex', flexDirection: 'column', height: '100%' },
  title: { fontSize: 14, fontWeight: 700, color: '#444', margin: '0 0 12px' },
  feed: { flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 },
  empty: { color: '#bbb', fontSize: 13, textAlign: 'center', marginTop: 24 },
  item: {
    display: 'flex', flexDirection: 'column', gap: 2,
    fontSize: 12, padding: '7px 10px', background: '#f9f9f9',
    borderRadius: 6, borderLeft: '3px solid #e0e0e0',
  },
  time: { color: '#bbb', fontSize: 11 },
  name: { fontWeight: 700, color: '#1a1a1a' },
  desc: { color: '#555' },
};
