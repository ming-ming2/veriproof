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
  const [activeTab, setActiveTab] = useState('list'); // list | seating

  // 더미 데이터 (백엔드 seatNumber 연동 전 테스트용)
  const DUMMY_SEAT_STUDENTS = [
    { sessionUuid: 'd1', studentNumber: '202094926', studentName: '김나은',   seatNumber: 1,  attentionScore: 0, attentionLevel: 'NORMAL', status: 'IN_PROGRESS', currentQuestionId: 2, lastActivityAt: new Date().toISOString() },
    { sessionUuid: 'd2', studentNumber: '202322678', studentName: '서다은',   seatNumber: 2,  attentionScore: 2, attentionLevel: 'MID',    status: 'IN_PROGRESS', currentQuestionId: 1, lastActivityAt: new Date().toISOString() },
    { sessionUuid: 'd3', studentNumber: '202097419', studentName: '서민준',   seatNumber: 3,  attentionScore: 5, attentionLevel: 'HIGH',   status: 'IN_PROGRESS', currentQuestionId: 3, lastActivityAt: new Date().toISOString() },
    { sessionUuid: 'd4', studentNumber: '201928948', studentName: '신유진',   seatNumber: 4,  attentionScore: 0, attentionLevel: 'NORMAL', status: 'IN_PROGRESS', currentQuestionId: 2, lastActivityAt: new Date().toISOString() },
    { sessionUuid: 'd5', studentNumber: '202241287', studentName: '신민준',   seatNumber: 5,  attentionScore: 1, attentionLevel: 'LOW',    status: 'IN_PROGRESS', currentQuestionId: 1, lastActivityAt: new Date().toISOString() },
    { sessionUuid: 'd6', studentNumber: '202116753', studentName: '신태양',   seatNumber: 6,  attentionScore: 0, attentionLevel: 'NORMAL', status: 'SUBMITTED',   currentQuestionId: 3, lastActivityAt: new Date().toISOString() },
    { sessionUuid: 'd7', studentNumber: '183798000', studentName: '강민서',   seatNumber: 7,  attentionScore: 3, attentionLevel: 'MID',    status: 'IN_PROGRESS', currentQuestionId: 2, lastActivityAt: new Date().toISOString() },
    { sessionUuid: 'd8', studentNumber: '202235322', studentName: '박지원',   seatNumber: 8,  attentionScore: 0, attentionLevel: 'NORMAL', status: 'IN_PROGRESS', currentQuestionId: 1, lastActivityAt: new Date().toISOString() },
    { sessionUuid: 'd9', studentNumber: '202116709', studentName: '임예린',   seatNumber: 9,  attentionScore: 4, attentionLevel: 'HIGH',   status: 'IN_PROGRESS', currentQuestionId: 3, lastActivityAt: new Date().toISOString() },
    { sessionUuid: 'd10', studentNumber: '201913435', studentName: '임준혁',  seatNumber: 10, attentionScore: 0, attentionLevel: 'NORMAL', status: 'IN_PROGRESS', currentQuestionId: 2, lastActivityAt: new Date().toISOString() },
    { sessionUuid: 'd11', studentNumber: '202214409', studentName: '윤지호',  seatNumber: 11, attentionScore: 1, attentionLevel: 'LOW',    status: 'IN_PROGRESS', currentQuestionId: 1, lastActivityAt: new Date().toISOString() },
    { sessionUuid: 'd12', studentNumber: '202437349', studentName: '김시우',  seatNumber: 12, attentionScore: 0, attentionLevel: 'NORMAL', status: 'IN_PROGRESS', currentQuestionId: 2, lastActivityAt: new Date().toISOString() },
    { sessionUuid: 'd13', studentNumber: '201942069', studentName: '정예린',  seatNumber: 13, attentionScore: 2, attentionLevel: 'MID',    status: 'IN_PROGRESS', currentQuestionId: 3, lastActivityAt: new Date().toISOString() },
    { sessionUuid: 'd14', studentNumber: '202238488', studentName: '조하은',  seatNumber: 14, attentionScore: 0, attentionLevel: 'NORMAL', status: 'IN_PROGRESS', currentQuestionId: 1, lastActivityAt: new Date().toISOString() },
    { sessionUuid: 'd15', studentNumber: '201928000', studentName: '장재원',  seatNumber: 15, attentionScore: 6, attentionLevel: 'HIGH',   status: 'IN_PROGRESS', currentQuestionId: 2, lastActivityAt: new Date().toISOString() },
  ];

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
          seatRows: m.seatRows ?? 3,
          seatCols: m.seatCols ?? 5,
        });
        // 백엔드에서 seatNumber 안 내려오면 더미 데이터로 대체
        const studentsData = studentsRes.data.data || [];
        const hasSeatData = studentsData.some((s) => s.seatNumber != null);
        setStudents(hasSeatData ? studentsData : DUMMY_SEAT_STUDENTS);
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
          {/* 탭 — 좌석 배치 설정된 경우에만 배치도 탭 표시 */}
          {examInfo.seatRows && examInfo.seatCols && (
            <div style={styles.tabRow}>
              <button
                style={{ ...styles.tab, ...(activeTab === 'list' ? styles.tabActive : {}) }}
                onClick={() => setActiveTab('list')}
              >
                학생 목록
              </button>
              <button
                style={{ ...styles.tab, ...(activeTab === 'seating' ? styles.tabActive : {}) }}
                onClick={() => setActiveTab('seating')}
              >
                배치도
              </button>
            </div>
          )}

          {/* 학생 목록 탭 */}
          {activeTab === 'list' && (
            sortedStudents.length === 0 ? (
              <p style={styles.noStudent}>아직 응시 중인 학생이 없습니다.</p>
            ) : (
              <div style={styles.grid}>
                {sortedStudents.map((s) => (
                  <StudentCard key={s.sessionUuid} student={s} onClick={handleCardClick} />
                ))}
              </div>
            )
          )}

          {/* 배치도 탭 */}
          {activeTab === 'seating' && examInfo.seatRows && examInfo.seatCols && (
            <SeatingMap
              students={students}
              seatRows={examInfo.seatRows}
              seatCols={examInfo.seatCols}
              onCardClick={handleCardClick}
            />
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

// 좌석 번호 → 행/열 변환 (1-based)
function seatToRowCol(seatNumber, seatCols) {
  const row = Math.ceil(seatNumber / seatCols);
  const col = ((seatNumber - 1) % seatCols) + 1;
  return { row, col };
}

const LEVEL_COLORS = {
  HIGH:   { border: '#e53935', bg: '#ffebee', badge: '#e53935', badgeBg: '#ffcdd2' },
  MID:    { border: '#f57c00', bg: '#fff3e0', badge: '#e65100', badgeBg: '#ffe0b2' },
  LOW:    { border: '#f9a825', bg: '#fffde7', badge: '#f57f17', badgeBg: '#fff9c4' },
  NORMAL: { border: '#e0e0e0', bg: '#fafafa', badge: '#888',    badgeBg: '#f0f0f0' },
};

function SeatingMap({ students, seatRows, seatCols, onCardClick }) {
  const totalSeats = seatRows * seatCols;

  // seatNumber → student 맵
  const seatMap = {};
  students.forEach((s) => {
    if (s.seatNumber) seatMap[s.seatNumber] = s;
  });

  const seats = Array.from({ length: totalSeats }, (_, i) => i + 1);

  return (
    <div>
      {/* 범례 */}
      <div style={{ display: 'flex', gap: 14, marginBottom: 14, flexWrap: 'wrap' }}>
        {[
          { level: 'HIGH', label: '이상 징후' },
          { level: 'MID',  label: '주의' },
          { level: 'LOW',  label: '보통' },
          { level: 'NORMAL', label: '정상' },
        ].map(({ level, label }) => (
          <div key={level} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#666' }}>
            <div style={{ width: 10, height: 10, borderRadius: 3, background: LEVEL_COLORS[level].border }} />
            {label}
          </div>
        ))}
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#666' }}>
          <div style={{ width: 10, height: 10, borderRadius: 3, background: '#e0e0e0', border: '1px dashed #bbb' }} />
          빈 좌석
        </div>
      </div>

      {/* 칠판 */}
      <div style={{ background: '#37474f', borderRadius: 6, padding: '6px 12px', textAlign: 'center', fontSize: 12, color: '#b0bec5', marginBottom: 14 }}>
        칠판 / 강단
      </div>

      {/* 좌석 그리드 */}
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${seatCols}, 1fr)`, gap: 8 }}>
        {seats.map((seatNum) => {
          const { row, col } = seatToRowCol(seatNum, seatCols);
          const student = seatMap[seatNum];

          if (!student) {
            return (
              <div key={seatNum} style={{ border: '1px dashed #ccc', borderRadius: 8, padding: '8px', background: '#f9f9f9', minHeight: 70 }}>
                <div style={{ fontSize: 10, color: '#ccc', marginBottom: 2 }}>{row}행 {col}열</div>
              </div>
            );
          }

          const level = student.attentionLevel || 'NORMAL';
          const cfg = LEVEL_COLORS[level];
          const isSubmitted = student.status === 'SUBMITTED';

          return (
            <div
              key={seatNum}
              style={{
                border: `1.5px solid ${cfg.border}`,
                borderRadius: 8,
                padding: '8px',
                background: cfg.bg,
                cursor: isSubmitted ? 'default' : 'pointer',
                opacity: isSubmitted ? 0.6 : 1,
                minHeight: 70,
              }}
              onClick={() => !isSubmitted && onCardClick(student)}
            >
              <div style={{ fontSize: 10, color: '#999', marginBottom: 2 }}>{row}행 {col}열</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#1a1a1a', marginBottom: 1 }}>{student.studentName}</div>
              <div style={{ fontSize: 11, color: '#888', fontFamily: 'monospace' }}>{student.studentNumber}</div>
              {student.attentionScore > 0 && (
                <div style={{ marginTop: 4, fontSize: 10, background: cfg.badgeBg, color: cfg.badge, borderRadius: 4, padding: '1px 6px', display: 'inline-block' }}>
                  {student.attentionScore}점
                </div>
              )}
              {isSubmitted && (
                <div style={{ marginTop: 4, fontSize: 10, color: '#9e9e9e' }}>제출 완료</div>
              )}
            </div>
          );
        })}
      </div>
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
  tabRow: { display: 'flex', gap: 0, borderBottom: '1px solid #e0e0e0', marginBottom: 20 },
  tab: { padding: '8px 18px', fontSize: 13, color: '#888', background: 'none', border: 'none', borderBottom: '2px solid transparent', cursor: 'pointer', fontWeight: 400 },
  tabActive: { color: '#185FA5', borderBottomColor: '#185FA5', fontWeight: 500 },
  feedArea: {
    width: 300, borderLeft: '1px solid #e0e0e0', background: '#fff',
    padding: '16px', overflowY: 'auto', flexShrink: 0, display: 'flex', flexDirection: 'column',
  },
};
