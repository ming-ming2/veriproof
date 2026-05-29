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

  // SSE: session-status → 학생 상태 변경
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
    const msg =
      error === 'PROCTOR_TOKEN_INVALID'
        ? '유효하지 않은 감독관 토큰입니다.'
        : `오류: ${error}`;
    return (
      <div style={styles.center}>
        <p style={{ color: '#e53935' }}>{msg}</p>
      </div>
    );
  }

  if (!examInfo) {
    return (
      <div style={styles.center}>
        <p style={{ color: '#999' }}>대시보드 로드 중...</p>
      </div>
    );
  }

  // 주목도 점수 내림차순 정렬
  const sortedStudents = [...students].sort(
    (a, b) => (b.attentionScore ?? 0) - (a.attentionScore ?? 0)
  );

  // 레벨별 그룹
  const active = sortedStudents.filter((s) => s.status !== 'SUBMITTED');
  const submitted = sortedStudents.filter((s) => s.status === 'SUBMITTED');
  const groups = [
    {
      key: 'high',
      label: '위험',
      color: '#e53935',
      bg: '#fff5f5',
      students: active.filter((s) => s.attentionLevel === 'HIGH'),
    },
    {
      key: 'mid',
      label: '주의',
      color: '#f57c00',
      bg: '#fff8f0',
      students: active.filter(
        (s) => s.attentionLevel === 'MID' || s.attentionLevel === 'LOW'
      ),
    },
    {
      key: 'normal',
      label: '정상',
      color: '#9e9e9e',
      bg: 'transparent',
      students: active.filter(
        (s) => s.attentionLevel === 'NORMAL' || !s.attentionLevel
      ),
    },
  ];

  // 헤더 레벨 카운트
  const highCount = groups[0].students.length;
  const midCount = groups[1].students.length;

  const fmt = (iso) =>
    iso
      ? new Date(iso).toLocaleTimeString('ko-KR', {
          hour: '2-digit',
          minute: '2-digit',
        })
      : '-';

  return (
    <div style={styles.container}>
      {/* 헤더 */}
      <header style={styles.header}>
        <div style={styles.headerLeft}>
          <h1 style={styles.examTitle}>{examInfo.title}</h1>
          <span style={styles.timeRange}>
            {fmt(examInfo.startsAt)} ~ {fmt(examInfo.endsAt)}
          </span>
        </div>
        <div style={styles.statRow}>
          <StatChip label="명단" value={examInfo.rosterCount} color="#555" />
          <StatChip label="응시" value={examInfo.activeCount} color="#185FA5" />
          {highCount > 0 && (
            <StatChip label="위험" value={highCount} color="#e53935" accent />
          )}
          {midCount > 0 && (
            <StatChip label="주의" value={midCount} color="#f57c00" />
          )}
          {submitted.length > 0 && (
            <StatChip label="제출" value={submitted.length} color="#9e9e9e" />
          )}
        </div>
      </header>

      <div style={styles.body}>
        {/* 학생 그리드 */}
        <main style={styles.main}>
          {sortedStudents.length === 0 ? (
            <p style={styles.empty}>아직 응시 중인 학생이 없습니다.</p>
          ) : (
            <>
              {groups.map(
                (group) =>
                  group.students.length > 0 && (
                    <section key={group.key} style={{ marginBottom: 20 }}>
                      <SectionDivider
                        label={group.label}
                        count={group.students.length}
                        color={group.color}
                      />
                      <div style={styles.grid}>
                        {group.students.map((s) => (
                          <StudentCard
                            key={s.sessionUuid}
                            student={s}
                            onClick={handleCardClick}
                          />
                        ))}
                      </div>
                    </section>
                  )
              )}

              {submitted.length > 0 && (
                <section style={{ marginBottom: 20 }}>
                  <SectionDivider
                    label="제출 완료"
                    count={submitted.length}
                    color="#bdbdbd"
                  />
                  <div style={styles.grid}>
                    {submitted.map((s) => (
                      <StudentCard
                        key={s.sessionUuid}
                        student={s}
                        onClick={handleCardClick}
                      />
                    ))}
                  </div>
                </section>
              )}
            </>
          )}
        </main>

        {/* 이벤트 피드 */}
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

function StatChip({ label, value, color, accent }) {
  return (
    <div
      style={{
        ...chipStyles.chip,
        background: accent ? '#fff5f5' : '#f5f5f5',
        border: accent ? '1px solid #fcc' : '1px solid #e5e5e5',
      }}
    >
      <span style={{ ...chipStyles.value, color }}>{value ?? '-'}</span>
      <span style={chipStyles.label}>{label}</span>
    </div>
  );
}

const chipStyles = {
  chip: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '6px 14px',
    borderRadius: 8,
    minWidth: 52,
  },
  value: { fontSize: 18, fontWeight: 700, lineHeight: 1 },
  label: { fontSize: 11, color: '#999', marginTop: 2 },
};

function SectionDivider({ label, count, color }) {
  return (
    <div style={divStyles.row}>
      <div style={divStyles.line} />
      <span style={{ ...divStyles.label, color }}>
        {label}
        <span style={divStyles.count}>{count}명</span>
      </span>
      <div style={divStyles.line} />
    </div>
  );
}

const divStyles = {
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  line: { flex: 1, height: 1, background: '#e5e5e5' },
  label: {
    fontSize: 12,
    fontWeight: 700,
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    gap: 4,
  },
  count: {
    fontSize: 11,
    fontWeight: 400,
    color: '#aaa',
  },
};

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    background: '#f5f7fa',
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
  center: {
    height: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '14px 24px',
    background: '#fff',
    borderBottom: '1px solid #e5e5e5',
    flexShrink: 0,
    gap: 16,
  },
  headerLeft: { minWidth: 0 },
  examTitle: {
    fontSize: 17,
    fontWeight: 700,
    margin: '0 0 2px',
    color: '#1a1a1a',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  timeRange: { fontSize: 12, color: '#999' },
  statRow: { display: 'flex', gap: 8, flexShrink: 0 },

  body: { display: 'flex', flex: 1, overflow: 'hidden' },
  main: { flex: 1, overflowY: 'auto', padding: '20px 24px' },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
    gap: 10,
  },
  empty: { color: '#bbb', textAlign: 'center', marginTop: 60, fontSize: 14 },

  feedArea: {
    width: 260,
    borderLeft: '1px solid #e5e5e5',
    background: '#fff',
    padding: '16px',
    overflowY: 'auto',
    flexShrink: 0,
    display: 'flex',
    flexDirection: 'column',
  },
};
