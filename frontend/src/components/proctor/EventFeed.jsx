import React, { memo } from 'react';

function EventFeed({ events }) {
  return (
    <div style={styles.container}>
      <h3 style={styles.title}>실시간 이벤트 피드</h3>
      <div style={styles.feed}>
        {events.length === 0 ? (
          <p style={styles.empty}>이벤트 없음</p>
        ) : (
          events.map((ev, i) => (
            <div key={i} style={styles.item}>
              <span style={styles.time}>
                {new Date(ev.occurredAt).toLocaleTimeString('ko-KR')}
              </span>
              <span style={styles.name}>{ev.studentName}</span>
              <span style={styles.desc}>{ev.displayText}</span>
            </div>
          ))
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
