import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getExams, createExam } from "../api/exam";

// 시험 상태 계산 헬퍼
function getExamStatus(exam) {
  const now = new Date();
  const start = new Date(exam.startsAt);
  const end = new Date(exam.endsAt);
  if (now < start) return "upcoming";
  if (now >= start && now <= end) return "live";
  return "done";
}

const STATUS_CONFIG = {
  live:     { label: "진행 중", dotColor: "#639922", dotShadow: "#EAF3DE", badgeBg: "#EAF3DE", badgeColor: "#3B6D11" },
  upcoming: { label: "예정",   dotColor: "#185FA5", dotShadow: "#E6F1FB", badgeBg: "#E6F1FB", badgeColor: "#185FA5" },
  done:     { label: "종료",   dotColor: "#aaa",    dotShadow: "#F1EFE8", badgeBg: "#F1EFE8", badgeColor: "#888" },
};

function getDday(startsAt) {
  const now = new Date();
  const start = new Date(startsAt);
  const diff = Math.ceil((start - now) / (1000 * 60 * 60 * 24));
  if (diff === 0) return "오늘";
  if (diff > 0) return `D-${diff}`;
  return null;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [creatingTest, setCreatingTest] = useState(false);
  const [filter, setFilter] = useState("all");
  const [hoveredRow, setHoveredRow] = useState(null);

  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const userName = user.name ? `${user.name} 교수` : "교수";
  const initials = user.name ? user.name.slice(0, 1) : "교";

  // 통계 계산
  const liveExams = exams.filter((e) => getExamStatus(e) === "live");
  const nextExam = exams
    .filter((e) => getExamStatus(e) === "upcoming")
    .sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt))[0] || null;
  // 백로그 24: 제출됐으나 채점 미완료(ungradedCount)인 답안 합계 — 시험 상태 무관
  const ungradedTotal = exams.reduce((sum, e) => sum + (e.ungradedCount || 0), 0);

  // 필터링
  const filtered =
    filter === "all" ? exams : exams.filter((e) => getExamStatus(e) === filter);

  // 테스트 시험 생성 (기존 로직 유지)
  const handleCreateTestExam = async () => {
    if (creatingTest) return;
    setCreatingTest(true);
    try {
      const now = new Date();
      const startsAt = new Date(now.getTime()).toISOString();
      const endsAt = new Date(now.getTime() + 10 * 60 * 1000).toISOString();
      const stamp = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}:${String(now.getSeconds()).padStart(2, "0")}`;
      const payload = {
        title: `테스트 시험 ${stamp}`,
        startsAt,
        endsAt,
        questions: [
          { questionType: "SUBJECTIVE", body: "1번 문항 (주관식): 자유롭게 답안을 작성해 주세요.", correctAnswer: "", points: 10, displayOrder: 1, choices: [] },
          { questionType: "MULTIPLE_CHOICE", body: "2번 문항 (객관식): 다음 중 올바른 것을 고르시오.", correctAnswer: "", points: 10, displayOrder: 2, choices: [{ body: "선택지 A", isCorrect: false, displayOrder: 1 }, { body: "선택지 B", isCorrect: true, displayOrder: 2 }, { body: "선택지 C", isCorrect: false, displayOrder: 3 }, { body: "선택지 D", isCorrect: false, displayOrder: 4 }] },
          { questionType: "SUBJECTIVE", body: "3번 문항 (주관식): 자유롭게 답안을 작성해 주세요.", correctAnswer: "", points: 10, displayOrder: 3, choices: [] },
        ],
        roster: [
          { studentNumber: "60212229", studentName: "임기연" },
          { studentNumber: "20240001", studentName: "테스트학생1" },
          { studentNumber: "20240002", studentName: "테스트학생2" },
        ],
      };
      const { data: res } = await createExam(payload);
      navigate(`/exam/${res.data.id}`);
    } catch (err) {
      alert(err.response?.data?.error?.message || "테스트 시험 생성에 실패했습니다.");
    } finally {
      setCreatingTest(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/login");
  };

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (!e.target.closest("[data-user-menu]")) setMenuOpen(false);
    };
    if (menuOpen) {
      document.addEventListener("click", handleClickOutside);
      return () => document.removeEventListener("click", handleClickOutside);
    }
  }, [menuOpen]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data: res } = await getExams();
        if (!cancelled) setExams(res.data || []);
      } catch (err) {
        if (!cancelled) setError(err.response?.data?.error?.message || "시험 목록을 불러오지 못했습니다.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const formatDate = (iso) => {
    if (!iso) return "-";
    const d = new Date(iso);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  };

  return (
    <div style={s.page}>
      {/* ── NAV ── */}
      <nav style={s.nav}>
        <span style={s.navLogo}>시험 플랫폼</span>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button style={s.createBtn} onClick={() => navigate("/exam/create")}>
            + 새 시험 만들기
          </button>
          <div style={s.navRight} data-user-menu>
            <button
              style={s.userBtn}
              onClick={(e) => { e.stopPropagation(); setMenuOpen(!menuOpen); }}
            >
              <div style={s.avatar}>{initials}</div>
              <span style={s.navUser}>{userName}</span>
              <span style={s.caret}>▾</span>
            </button>
            {menuOpen && (
              <div style={s.dropdown}>
                <button style={s.dropdownItem} onClick={() => { setMenuOpen(false); navigate("/profile"); }}>
                  계정 설정
                </button>
                <div style={s.dropdownDivider} />
                <button style={{ ...s.dropdownItem, color: "#c0392b" }} onClick={handleLogout}>
                  로그아웃
                </button>
              </div>
            )}
          </div>
        </div>
      </nav>

      <div style={s.content}>
        {/* ── 인사말 ── */}
        <div style={{ marginBottom: 24 }}>
          <p style={{ fontSize: 13, color: "#999", margin: "0 0 2px" }}>안녕하세요,</p>
          <p style={{ fontSize: 20, fontWeight: 500, margin: 0 }}>{userName}님 👋</p>
        </div>

        {/* ── 요약 카드 3개 ── */}
        {!loading && (
          <div style={s.statsRow}>

            {/* 다음 시험 */}
            <div style={s.statCard}>
              <p style={s.statLabel}>다음 시험</p>
              {nextExam ? (
                <>
                  <p style={{ ...s.statValue, fontSize: 15, marginBottom: 4 }}>{nextExam.title}</p>
                  <p style={s.statSub}>{getDday(nextExam.startsAt)} · {formatDate(nextExam.startsAt)}</p>
                </>
              ) : (
                <p style={s.statSub}>예정된 시험 없음</p>
              )}
            </div>

            {/* 진행 중 */}
            <div
              style={{ ...s.statCard, ...(liveExams.length > 0 ? s.statCardLive : {}), ...(liveExams.length > 0 ? { cursor: "pointer" } : {}) }}
              onClick={() => liveExams.length > 0 && navigate(`/exam/${liveExams[0].id}`)}
            >
              <p style={{ ...s.statLabel, ...(liveExams.length > 0 ? { color: "#3B6D11" } : {}) }}>진행 중</p>
              {liveExams.length > 0 ? (
                <>
                  <p style={{ ...s.statValue, fontSize: 15, color: "#3B6D11", marginBottom: 4 }}>{liveExams[0].title}</p>
                  <p style={{ ...s.statSub, color: "#3B6D11" }}>총 {liveExams.length}개 · 클릭하여 상세 보기</p>
                </>
              ) : (
                <p style={s.statSub}>진행 중인 시험 없음</p>
              )}
            </div>

            {/* 채점 확인 필요 (백로그 24: ungradedCount 기반) */}
            <div style={{ ...s.statCard, ...(ungradedTotal > 0 ? s.statCardWarn : {}) }}>
              <p style={{ ...s.statLabel, ...(ungradedTotal > 0 ? { color: "#BA7517" } : {}) }}>채점 확인 필요</p>
              {ungradedTotal > 0 ? (
                <>
                  <p style={{ ...s.statValue, color: "#BA7517", margin: "0 0 2px" }}>{ungradedTotal}건</p>
                  <p style={s.statSub}>미채점 제출 답안</p>
                </>
              ) : (
                <p style={s.statSub}>확인 필요 없음</p>
              )}
            </div>

          </div>
        )}

        {/* ── 헤더 + 테스트 버튼 ── */}
        <div style={s.sectionHeader}>
          <p style={s.sectionTitle}>내 시험 목록</p>
          <button
            style={{ ...s.testBtn, opacity: creatingTest ? 0.6 : 1 }}
            onClick={handleCreateTestExam}
            disabled={creatingTest}
            title="주관식·객관식·주관식 3문항, 시작 즉시 / 종료 +10분"
          >
            {creatingTest ? "생성 중..." : "테스트 시험 생성"}
          </button>
        </div>

        {/* ── 탭 필터 ── */}
        <div style={s.tabs}>
          {[
            { key: "all",      label: "전체" },
            { key: "live",     label: "진행 중" },
            { key: "upcoming", label: "예정" },
            { key: "done",     label: "종료" },
          ].map((t) => (
            <button
              key={t.key}
              style={{ ...s.tab, ...(filter === t.key ? s.tabActive : {}) }}
              onClick={() => setFilter(t.key)}
            >
              {t.label}
              {t.key !== "all" && (
                <span style={{ ...s.tabCount, ...(filter === t.key ? s.tabCountActive : {}) }}>
                  {exams.filter((e) => getExamStatus(e) === t.key).length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ── 상태 ── */}
        {loading && <div style={s.stateText}>불러오는 중...</div>}
        {!loading && error && <div style={{ ...s.stateText, color: "#c0392b" }}>{error}</div>}

        {/* ── 시험 카드 목록 ── */}
        {!loading && !error && filtered.length > 0 && (
          <div style={s.examList}>
            {filtered.map((exam) => {
              const status = getExamStatus(exam);
              const cfg = STATUS_CONFIG[status];
              const dday = status === "upcoming" ? getDday(exam.startsAt) : null;
              const isHovered = hoveredRow === exam.id;

              return (
                <div
                  key={exam.id}
                  style={{ ...s.examCard, ...(isHovered ? s.examCardHover : {}) }}
                  onMouseEnter={() => setHoveredRow(exam.id)}
                  onMouseLeave={() => setHoveredRow(null)}
                  onClick={() => navigate(`/exam/${exam.id}`)}
                >
                  <div style={{ ...s.statusDot, background: cfg.dotColor, boxShadow: `0 0 0 4px ${cfg.dotShadow}` }} />
                  <div style={{ flex: 1 }}>
                    <p style={s.examTitle}>{exam.title}</p>
                    <div style={s.examMeta}>
                      <span>📋 {exam.examCode}</span>
                      <span>🕐 {formatDate(exam.startsAt)}</span>
                    </div>
                  </div>
                  <div style={s.examStats}>
                    <div style={s.examStat}>
                      <span style={s.examStatVal}>{exam.questionCount ?? "-"}</span>
                      <span style={s.examStatLbl}>문항</span>
                    </div>
                    <div style={s.divider} />
                    <div style={s.examStat}>
                      <span style={s.examStatVal}>{exam.rosterCount ?? "-"}</span>
                      <span style={s.examStatLbl}>명단</span>
                    </div>
                    <div style={s.divider} />
                    <div style={s.examStat}>
                      <span style={s.examStatVal}>{exam.takerCount ?? "-"}</span>
                      <span style={s.examStatLbl}>응시</span>
                    </div>
                  </div>
                  <div style={s.examActions}>
                    <span style={{ ...s.badge, background: cfg.badgeBg, color: cfg.badgeColor }}>
                      {dday ?? cfg.label}
                    </span>
                    {status === "live" && (
                      <button style={s.actionBtn} onClick={(e) => { e.stopPropagation(); navigate(`/exam/${exam.id}`); }}>
                        상세 보기
                      </button>
                    )}
                    {status === "done" && (
                      <button style={s.actionBtn} onClick={(e) => { e.stopPropagation(); navigate(`/exam/${exam.id}`); }}>
                        리포트
                      </button>
                    )}
                    {status === "upcoming" && (
                      <button style={s.actionBtn} onClick={(e) => { e.stopPropagation(); navigate(`/exam/${exam.id}/edit`); }}>
                        편집
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── 빈 상태 ── */}
        {!loading && !error && filtered.length === 0 && (
          <div style={s.emptyState}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" style={{ marginBottom: 12 }}>
              <rect x="3" y="4" width="18" height="16" rx="3" stroke="#ccc" strokeWidth="1.5" />
              <path d="M7 10h10M7 14h6" stroke="#ccc" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <p style={{ fontSize: 14, color: "#888", margin: "0 0 16px" }}>
              {filter === "all" ? "개설된 시험이 없습니다" : `${STATUS_CONFIG[filter]?.label} 시험이 없습니다`}
            </p>
            {filter === "all" && (
              <button style={s.createBtn} onClick={() => navigate("/exam/create")}>
                + 새 시험 만들기
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

const FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';

const s = {
  page: { minHeight: "100vh", background: "#f4f5f7", fontFamily: FONT },
  nav: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0 24px", height: 56, borderBottom: "1px solid #e5e5e5", background: "#fff" },
  navLogo: { fontSize: 15, fontWeight: 600, color: "#111" },
  navRight: { position: "relative" },
  userBtn: { display: "flex", alignItems: "center", gap: 8, padding: "5px 10px", border: "1px solid #e0e0e0", borderRadius: 8, background: "#fff", cursor: "pointer" },
  avatar: { width: 26, height: 26, borderRadius: "50%", background: "#dbeafe", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 600, color: "#1e40af" },
  navUser: { fontSize: 13, color: "#444" },
  caret: { fontSize: 10, color: "#aaa" },
  dropdown: { position: "absolute", top: "calc(100% + 6px)", right: 0, background: "#fff", border: "1px solid #e5e5e5", borderRadius: 10, boxShadow: "0 4px 16px rgba(0,0,0,0.08)", minWidth: 144, padding: "4px 0", zIndex: 100 },
  dropdownItem: { display: "block", width: "100%", padding: "9px 14px", fontSize: 13, color: "#444", background: "transparent", border: "none", textAlign: "left", cursor: "pointer" },
  dropdownDivider: { borderTop: "1px solid #f0f0f0", margin: "4px 0" },
  content: { maxWidth: 900, margin: "0 auto", padding: "32px 20px" },

  // stats
  statsRow: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 28 },
  statCard: { background: "#fff", border: "1px solid #e8e8e8", borderRadius: 12, padding: "16px 18px" },
  statCardLive: { borderColor: "#bbf7d0" },
  statCardWarn: { borderColor: "#fde68a" },
  statLabel: { fontSize: 12, color: "#999", margin: "0 0 8px" },
  statValue: { fontSize: 24, fontWeight: 600, color: "#111", margin: "0 0 2px" },
  statSub: { fontSize: 12, color: "#bbb", margin: 0 },

  // section header
  sectionHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  sectionTitle: { fontSize: 15, fontWeight: 600, margin: 0, color: "#111" },

  // buttons
  createBtn: { fontSize: 13, padding: "8px 16px", border: "none", borderRadius: 8, background: "#185FA5", color: "#fff", cursor: "pointer", fontWeight: 500 },
  testBtn: { fontSize: 12, padding: "7px 14px", border: "1px dashed #bbb", borderRadius: 8, background: "#fff", color: "#777", cursor: "pointer" },

  // tabs
  tabs: { display: "flex", gap: 4, marginBottom: 14, paddingBottom: 0 },
  tab: { padding: "8px 14px", fontSize: 13, color: "#888", background: "none", border: "none", outline: "none", cursor: "pointer", borderBottom: "2px solid transparent", display: "flex", alignItems: "center", gap: 6 },
  tabActive: { color: "#185FA5", borderBottom: "2px solid #185FA5", fontWeight: 500 },
  tabCount: { fontSize: 11, background: "#f0f0f0", color: "#888", borderRadius: 99, padding: "1px 7px" },
  tabCountActive: { background: "#dbeafe", color: "#185FA5" },

  // state text
  stateText: { fontSize: 14, color: "#999", textAlign: "center", padding: "40px 0" },

  // exam list
  examList: { display: "flex", flexDirection: "column", gap: 10 },
  examCard: { background: "#fff", border: "1px solid #e8e8e8", borderRadius: 12, padding: "14px 18px", display: "flex", alignItems: "center", gap: 16, cursor: "pointer", transition: "border-color 0.15s, box-shadow 0.15s" },
  examCardHover: { borderColor: "#c0d8f5", boxShadow: "0 2px 8px rgba(24,95,165,0.06)" },
  statusDot: { width: 9, height: 9, borderRadius: "50%", flexShrink: 0 },
  examTitle: { fontSize: 14, fontWeight: 500, color: "#111", margin: "0 0 4px" },
  examMeta: { display: "flex", gap: 14, fontSize: 12, color: "#999" },
  examStats: { display: "flex", alignItems: "center", gap: 16 },
  examStat: { display: "flex", flexDirection: "column", alignItems: "center" },
  examStatVal: { fontSize: 15, fontWeight: 600, color: "#222" },
  examStatLbl: { fontSize: 11, color: "#bbb" },
  divider: { width: 1, height: 28, background: "#ebebeb" },
  examActions: { display: "flex", alignItems: "center", gap: 10, flexShrink: 0 },
  badge: { fontSize: 11, fontWeight: 500, padding: "3px 10px", borderRadius: 999 },
  actionBtn: { fontSize: 12, padding: "5px 12px", border: "1px solid #e0e0e0", borderRadius: 8, background: "#fff", color: "#555", cursor: "pointer" },

  // empty
  emptyState: { background: "#fff", border: "1px solid #e8e8e8", borderRadius: 12, padding: "48px 20px", textAlign: "center" },
};
