import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { getExamMeta, getStudentList, getStudentDetail, getEventFeed } from '../api/proctor';
import { useProctorSSE } from '../hooks/useProctorSSE';
import StudentCard from '../components/proctor/StudentCard';
import DetailPanel from '../components/proctor/DetailPanel';
import EventFeed from '../components/proctor/EventFeed';

export default function ProctorDashboard() {
  const { token } = useParams();

  const [examInfo, setExamInfo] = useState(null);
  const [students, setStudents] = useState([]);
  const [feedEvents, setFeedEvents] = useState([]);
  const [selectedUuid, setSelectedUuid] = useState(null);
  const [detailData, setDetailData] = useState(null);
  const [error, setError] = useState(null);

  // 초기 데이터 로드: 시험 메타 + 학생 목록 + 이벤트 피드
  useEffect(() => {
    if (!token) return;
    Promise.all([getExamMeta(token), getStudentList(token), getEventFeed(token)])
      .then(([metaRes, studentsRes, feedRes]) => {
        const m = metaRes.data.data;
        setExamInfo({
          title: m.title,
          startsAt: m.startsAt,
          endsAt: m.endsAt,
          rosterCount: m.rosterCount,
          activeCount: m.activeCount,
        });
        setStudents(studentsRes.data.data || []);
        setFeedEvents(feedRes.data.data?.events || []);
      })
      .catch((err) => {
        setError(err.response?.data?.error?.code || 'LOAD_ERROR');
      });
  }, [token]);

  // SSE: student-event → 피드 prepend
  const handleStudentEvent = useCallback((data) => {
    setFeedEvents((prev) => [data, ...prev.slice(0, 99)]);
  }, []);

  // SSE: attention-update → 해당 학생 카드 점수/레벨 갱신
  const handleAttentionUpdate = useCallback((data) => {
    setStudents((prev) =>
      prev.map((s) =>
        s.sessionUuid === data.sessionUuid
          ? { ...s, attentionScore: data.score, attentionLevel: data.level }
          : s
      )
    );
  }, []);

  // SSE: session-status → 학생 상태 변경 (SUBMITTED 등)
  const handleSessionStatus = useCallback((data) => {
    setStudents((prev) =>
      prev.map((s) =>
        s.sessionUuid === data.sessionUuid ? { ...s, status: data.status } : s
      )
    );
  }, []);

  useProctorSSE({
    proctorToken: token,
    onStudentEvent: handleStudentEvent,
    onAttentionUpdate: handleAttentionUpdate,
    onSessionStatus: handleSessionStatus,
  });

  // 학생 상세 패널: 1초 폴링
  useEffect(() => {
    if (!selectedUuid || !token) return;
    const poll = async () => {
      try {
        const { data: res } = await getStudentDetail(token, selectedUuid);
        setDetailData(res.data);
      } catch {}
    };
    poll();
    const id = setInterval(poll, 1000);
    return () => clearInterval(id);
  }, [selectedUuid, token]);

  const handleCardClick = useCallback((student) => {
    setSelectedUuid(student.sessionUuid);
    setDetailData(null);
  }, []);

  const handleClosePanel = useCallback(() => {
    setSelectedUuid(null);
    setDetailData(null);
  }, []);

  if (error) {
    const msg = error === 'PROCTOR_TOKEN_INVALID'
      ? '유효하지 않은 감독관 토큰입니다.'
      : `오류: ${error}`;
    return <div style={styles.center}><p style={{ color: '#e53935' }}>{msg}</p></div>;
  }

  if (!examInfo) {
    return <div style={styles.center}><p style={{ color: '#666' }}>대시보드 로드 중...</p></div>;
  }

  // 주목도 점수 내림차순 정렬
  const sortedStudents = [...students].sort(
    (a, b) => (b.attentionScore ?? 0) - (a.attentionScore ?? 0)
  );

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
          <StatBadge label="현재 응시" value={examInfo.activeCount} />
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

      {selectedUuid && (
        <DetailPanel student={detailData} onClose={handleClosePanel} />
      )}
    </div>
  );
}

function StatBadge({ label, value }) {
  return (
    <div style={{ textAlign: 'center', padding: '0 20px' }}>
      <div style={{ fontSize: 26, fontWeight: 700, color: '#1a1a1a' }}>{value ?? '-'}</div>
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
