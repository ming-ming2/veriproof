import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { getDashboard, getStudentDetail } from '../api/proctor';
import { useProctorSSE } from '../hooks/useProctorSSE';
import StudentCard from '../components/proctor/StudentCard';
import DetailPanel from '../components/proctor/DetailPanel';
import EventFeed from '../components/proctor/EventFeed';

const EVENT_LABEL = {
  TAB_AWAY: '탭 이탈',
  TAB_RETURN: '탭 복귀',
  FULLSCREEN_EXIT: '전체화면 해제',
  PASTE: '붙여넣기',
  FOCUS_LOSS: '포커스 손실',
};

export default function ProctorDashboard() {
  const { token } = useParams();

  const [examInfo, setExamInfo] = useState(null);
  const [students, setStudents] = useState([]);
  const [feedEvents, setFeedEvents] = useState([]);
  const [selectedUuid, setSelectedUuid] = useState(null);
  const [detailData, setDetailData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!token) return;
    getDashboard(token)
      .then(({ data: res }) => {
        const d = res.data;
        setExamInfo({
          title: d.title,
          startsAt: d.startsAt,
          endsAt: d.endsAt,
          rosterCount: d.rosterCount,
          activeTakerCount: d.activeTakerCount,
        });
        setStudents(d.students || []);
      })
      .catch((err) => {
        setError(err.response?.data?.error?.code || 'LOAD_ERROR');
      });
  }, [token]);

  const handleStudentUpdated = useCallback((data) => {
    setStudents((prev) => {
      const idx = prev.findIndex((s) => s.sessionUuid === data.sessionUuid);
      if (idx === -1) return [...prev, data];
      const next = [...prev];
      next[idx] = { ...next[idx], ...data };
      return next;
    });
  }, []);

  const handleBehaviorEvent = useCallback((data) => {
    let displayText;
    if (data.eventType === 'TAB_RETURN' && data.duration != null) {
      displayText = `화면 이탈 (${Number(data.duration).toFixed(1)}초 지속)`;
    } else {
      const label = EVENT_LABEL[data.eventType] || data.eventType;
      displayText = `${label} (문항 ${data.questionOrder}번)`;
    }
    setFeedEvents((prev) => [{ ...data, displayText }, ...prev.slice(0, 99)]);
  }, []);

  useProctorSSE({ proctorToken: token, onStudentUpdated: handleStudentUpdated, onBehaviorEvent: handleBehaviorEvent });

  const handleCardClick = useCallback(async (student) => {
    setSelectedUuid(student.sessionUuid);
    setDetailData(null);
    try {
      const { data: res } = await getStudentDetail(student.sessionUuid, token);
      setDetailData(res.data);
    } catch {}
  }, [token]);

  const handleClosePanel = useCallback(() => {
    setSelectedUuid(null);
    setDetailData(null);
  }, []);

  if (error) {
    const msg = error === 'INVALID_PROCTOR_TOKEN'
      ? '유효하지 않은 감독관 토큰입니다.'
      : `오류: ${error}`;
    return <div style={styles.center}><p style={{ color: '#e53935' }}>{msg}</p></div>;
  }

  if (!examInfo) {
    return <div style={styles.center}><p style={{ color: '#666' }}>대시보드 로드 중...</p></div>;
  }

  const sortedStudents = [...students].sort(
    (a, b) => (b.attentionScore ?? 0) - (a.attentionScore ?? 0)
  );
  const selectedStudent = selectedUuid
    ? detailData || students.find((s) => s.sessionUuid === selectedUuid)
    : null;

  const fmt = (iso) =>
    iso ? new Date(iso).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }) : '-';

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <div>
          <h1 style={styles.examTitle}>{examInfo.title}</h1>
          <span style={styles.timeRange}>{fmt(examInfo.startsAt)} ~ {fmt(examInfo.endsAt)}</span>
        </div>
        <div style={styles.statRow}>
          <StatBadge label="전체 대상" value={examInfo.rosterCount} />
          <div style={styles.divider} />
          <StatBadge label="현재 응시" value={examInfo.activeTakerCount} />
        </div>
      </header>

      <div style={styles.body}>
        <main style={styles.main}>
          {sortedStudents.length === 0 ? (
            <p style={styles.noStudent}>아직 응시 중인 학생이 없습니다.</p>
          ) : (
            <div style={styles.grid}>
              {sortedStudents.map((s) => (
                <StudentCard key={s.sessionUuid} student={s} onClick={handleCardClick} />
              ))}
            </div>
          )}
        </main>

        <aside style={styles.feedArea}>
          <EventFeed events={feedEvents} />
        </aside>
      </div>

      {selectedStudent && (
        <DetailPanel student={selectedStudent} onClose={handleClosePanel} />
      )}
    </div>
  );
}

function StatBadge({ label, value }) {
  return (
    <div style={{ textAlign: 'center', padding: '0 20px' }}>
      <div style={{ fontSize: 26, fontWeight: 700, color: '#1a1a1a' }}>{value}</div>
      <div style={{ fontSize: 12, color: '#888' }}>{label}</div>
    </div>
  );
}

const styles = {
  container: {
    display: 'flex', flexDirection: 'column', height: '100vh',
    background: '#f5f7fa', fontFamily: 'sans-serif',
  },
  center: { height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  header: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '16px 28px', background: '#fff', borderBottom: '1px solid #e0e0e0', flexShrink: 0,
  },
  examTitle: { fontSize: 20, fontWeight: 700, margin: '0 0 4px', color: '#1a1a1a' },
  timeRange: { fontSize: 13, color: '#888' },
  statRow: { display: 'flex', alignItems: 'center' },
  divider: { width: 1, height: 40, background: '#e0e0e0' },
  body: { display: 'flex', flex: 1, overflow: 'hidden' },
  main: { flex: 1, overflowY: 'auto', padding: '20px 24px' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16 },
  noStudent: { color: '#bbb', textAlign: 'center', marginTop: 60, fontSize: 15 },
  feedArea: {
    width: 300, borderLeft: '1px solid #e0e0e0', background: '#fff',
    padding: '16px', overflowY: 'auto', flexShrink: 0, display: 'flex', flexDirection: 'column',
  },
};
