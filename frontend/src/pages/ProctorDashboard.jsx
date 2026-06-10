import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { getExamMeta, getStudentList, getStudentDetail, getEventFeed } from '../api/proctor';
import { useProctorSSE } from '../hooks/useProctorSSE';
import { useIsMobile } from '../hooks/useIsMobile';
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
  const isMobile = useIsMobile();

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
          // 좌석 미사용 시험이면 null → 배치도 탭이 표시되지 않음 (백로그 25)
          seatRows: m.seatRows ?? null,
          seatCols: m.seatCols ?? null,
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

  // 학생 목록 + 메타 3초 폴링 — 새로 입장한 학생/응시 인원 자동 반영
  // (이벤트·주목도·상태는 SSE로 1초 내 갱신, 목록 자체는 폴링으로 보강)
  useEffect(() => {
    if (!token) return;
    const poll = async () => {
      try {
        const [metaRes, studentsRes] = await Promise.all([
          getExamMeta(token),
          getStudentList(token),
        ]);
        const m = metaRes.data.data;
        setExamInfo((prev) =>
          prev
            ? {
                ...prev,
                rosterCount: m.rosterCount,
                activeCount: m.activeCount,
                seatRows: m.seatRows ?? null,
                seatCols: m.seatCols ?? null,
              }
            : prev
        );
        setStudents(studentsRes.data.data || []);
      } catch {}
    };
    const id = setInterval(poll, 3000);
    return () => clearInterval(id);
  }, [token]);

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
      <header style={{ ...styles.header, ...(isMobile && mStyles.header) }}>
        <div style={styles.headerLeft}>
          <h1 style={styles.examTitle}>{examInfo.title}</h1>
          <span style={styles.timeRange}>
            {fmt(examInfo.startsAt)} ~ {fmt(examInfo.endsAt)}
          </span>
        </div>
        <div style={{ ...styles.statRow, ...(isMobile && mStyles.statRow) }}>
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

      <div style={{ ...styles.body, ...(isMobile && mStyles.body) }}>
        {/* 학생 그리드 */}
        <main style={{ ...styles.main, ...(isMobile && mStyles.main) }}>
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
                      <div style={{ ...styles.grid, ...(isMobile && mStyles.grid) }}>
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
                  <div style={{ ...styles.grid, ...(isMobile && mStyles.grid) }}>
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

        {/* 이벤트 피드 */}
        <aside style={{ ...styles.feedArea, ...(isMobile && mStyles.feedArea) }}>
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

      {/* 좌석 그리드 — 좁은 화면에서는 셀 최소폭을 두고 가로 스크롤 */}
      <div style={{ overflowX: 'auto', paddingBottom: 4 }}>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${seatCols}, minmax(96px, 1fr))`, gap: 8 }}>
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

// 모바일(좁은 화면) 오버라이드 — 인라인 스타일이라 미디어쿼리 대신 런타임 병합
const mStyles = {
  header: { padding: '12px 14px', flexWrap: 'wrap', gap: 10, alignItems: 'flex-start' },
  statRow: { flexWrap: 'wrap' },
  // 가로 2분할 → 세로 스택: 학생 목록 위, 이벤트 피드 아래
  body: { flexDirection: 'column' },
  main: { padding: '14px' },
  feedArea: {
    width: 'auto',
    height: '34vh',
    flexShrink: 0,
    borderLeft: 'none',
    borderTop: '1px solid #e5e5e5',
    padding: '12px 14px',
  },
  grid: { gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))' },
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
  tabRow: { display: 'flex', gap: 0, borderBottom: '1px solid #e0e0e0', marginBottom: 20 },
  tab: { padding: '8px 18px', fontSize: 13, color: '#888', background: 'none', border: 'none', borderBottom: '2px solid transparent', cursor: 'pointer', fontWeight: 400 },
  tabActive: { color: '#185FA5', borderBottomColor: '#185FA5', fontWeight: 500 },

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
