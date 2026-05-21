import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getExams, createExam } from "../api/exam";

export default function Dashboard() {
  const navigate = useNavigate();
  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [creatingTest, setCreatingTest] = useState(false);

  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const userName = user.name ? `${user.name} 교수` : "교수";

  // 테스트용 시험 자동 생성 (주관식·객관식·주관식 3문항, 시작 +3분, 종료 +10분)
  const handleCreateTestExam = async () => {
    if (creatingTest) return;
    setCreatingTest(true);
    try {
      const now = new Date();
      const startsAt = new Date(now.getTime() + 1 * 60 * 1000).toISOString();
      const endsAt = new Date(now.getTime() + 10 * 60 * 1000).toISOString();
      const stamp = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}:${String(now.getSeconds()).padStart(2, "0")}`;
      const payload = {
        title: `테스트 시험 ${stamp}`,
        startsAt,
        endsAt,
        questions: [
          {
            questionType: "SUBJECTIVE",
            body: "1번 문항 (주관식): 자유롭게 답안을 작성해 주세요.",
            correctAnswer: "",
            points: 10,
            displayOrder: 1,
            choices: [],
          },
          {
            questionType: "MULTIPLE_CHOICE",
            body: "2번 문항 (객관식): 다음 중 올바른 것을 고르시오.",
            correctAnswer: "",
            points: 10,
            displayOrder: 2,
            choices: [
              { body: "선택지 A", isCorrect: false, displayOrder: 1 },
              { body: "선택지 B", isCorrect: true, displayOrder: 2 },
              { body: "선택지 C", isCorrect: false, displayOrder: 3 },
              { body: "선택지 D", isCorrect: false, displayOrder: 4 },
            ],
          },
          {
            questionType: "SUBJECTIVE",
            body: "3번 문항 (주관식): 자유롭게 답안을 작성해 주세요.",
            correctAnswer: "",
            points: 10,
            displayOrder: 3,
            choices: [],
          },
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
      alert(
        err.response?.data?.error?.message ||
          "테스트 시험 생성에 실패했습니다."
      );
    } finally {
      setCreatingTest(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/login");
  };

  // 메뉴 외부 클릭 시 닫기
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (!e.target.closest("[data-user-menu]")) {
        setMenuOpen(false);
      }
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
        if (!cancelled) {
          setError(
            err.response?.data?.error?.message ||
              "시험 목록을 불러오지 못했습니다."
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const formatDate = (iso) => {
    if (!iso) return "-";
    const d = new Date(iso);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  };

  return (
    <div style={styles.page}>
      <nav style={styles.nav}>
        <span style={styles.navTitle}>시험 플랫폼</span>

        {/* 사용자 메뉴 (드롭다운) */}
        <div style={styles.navRight} data-user-menu>
          <button
            style={styles.userBtn}
            onClick={(e) => {
              e.stopPropagation();
              setMenuOpen(!menuOpen);
            }}
          >
            <span style={styles.navUser}>{userName}</span>
            <span style={styles.caret}>▾</span>
          </button>

          {menuOpen && (
            <div style={styles.dropdown}>
              <button
                style={styles.dropdownItem}
                onClick={() => {
                  setMenuOpen(false);
                  navigate("/profile");
                }}
              >
                계정 설정
              </button>
              <div style={styles.dropdownDivider} />
              <button
                style={{ ...styles.dropdownItem, color: "#c0392b" }}
                onClick={handleLogout}
              >
                로그아웃
              </button>
            </div>
          )}
        </div>
      </nav>

      <div style={styles.content}>
        <div style={styles.pageHeader}>
          <h1 style={styles.pageTitle}>내 시험 목록</h1>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              style={{ ...styles.testBtn, opacity: creatingTest ? 0.6 : 1 }}
              onClick={handleCreateTestExam}
              disabled={creatingTest}
              title="주관식·객관식·주관식 3문항, 시작 +1분 / 종료 +10분"
            >
              {creatingTest ? "생성 중..." : "테스트 시험 생성"}
            </button>
            <button
              style={styles.createBtn}
              onClick={() => navigate("/exam/create")}
            >
              + 새 시험 만들기
            </button>
          </div>
        </div>

        {loading && <div style={styles.loadingText}>불러오는 중...</div>}
        {!loading && error && <div style={styles.errorText}>{error}</div>}

        {!loading && !error && exams.length > 0 && (
          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={{ ...styles.th, width: "32%" }}>시험명</th>
                  <th style={{ ...styles.th, width: "14%" }}>코드</th>
                  <th style={{ ...styles.th, width: "20%" }}>시작 시각</th>
                  <th style={{ ...styles.th, width: "10%" }}>문항</th>
                  <th style={{ ...styles.th, width: "10%" }}>명단</th>
                  <th style={{ ...styles.th, width: "10%" }}>응시</th>
                  <th style={{ ...styles.th, width: "8%" }}></th>
                </tr>
              </thead>
              <tbody>
                {exams.map((exam) => (
                  <tr
                    key={exam.id}
                    style={styles.tr}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.background = "#fafafa")
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.background = "transparent")
                    }
                  >
                    <td style={styles.tdMain}>{exam.title}</td>
                    <td style={styles.tdCode}>{exam.examCode}</td>
                    <td style={styles.td}>{formatDate(exam.startsAt)}</td>
                    <td style={styles.td}>{exam.questionCount}개</td>
                    <td style={styles.td}>{exam.rosterCount}명</td>
                    <td style={styles.td}>{exam.takerCount}명</td>
                    <td style={styles.td}>
                      <button
                        style={styles.detailBtn}
                        onClick={() => navigate(`/exam/${exam.id}`)}
                      >
                        상세
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!loading && !error && exams.length === 0 && (
          <div style={styles.emptyState}>
            <div style={styles.emptyIcon}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <rect
                  x="3"
                  y="4"
                  width="18"
                  height="16"
                  rx="3"
                  stroke="#bbb"
                  strokeWidth="1.5"
                />
                <path
                  d="M7 10h10M7 14h6"
                  stroke="#bbb"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
            </div>
            <p style={styles.emptyText}>개설된 시험이 없습니다</p>
            <button
              style={styles.emptyCreateBtn}
              onClick={() => navigate("/exam/create")}
            >
              + 새 시험 만들기
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    background: "#f7f7f8",
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
  nav: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "12px 24px",
    borderBottom: "1px solid #e5e5e5",
    background: "#fff",
  },
  navTitle: { fontSize: 16, fontWeight: 500 },
  navRight: { position: "relative" },
  userBtn: {
    display: "flex",
    alignItems: "center",
    gap: 4,
    padding: "5px 12px",
    border: "1px solid #ddd",
    borderRadius: 6,
    background: "#fff",
    cursor: "pointer",
  },
  navUser: { fontSize: 13, color: "#444" },
  caret: { fontSize: 10, color: "#888" },

  // 드롭다운
  dropdown: {
    position: "absolute",
    top: "calc(100% + 4px)",
    right: 0,
    background: "#fff",
    border: "1px solid #e5e5e5",
    borderRadius: 8,
    boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
    minWidth: 140,
    padding: "4px 0",
    zIndex: 100,
  },
  dropdownItem: {
    display: "block",
    width: "100%",
    padding: "8px 14px",
    fontSize: 13,
    color: "#444",
    background: "transparent",
    border: "none",
    textAlign: "left",
    cursor: "pointer",
  },
  dropdownDivider: {
    borderTop: "1px solid #f0f0f0",
    margin: "4px 0",
  },

  content: { maxWidth: 920, margin: "0 auto", padding: "32px 20px" },

  pageHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  pageTitle: { fontSize: 20, fontWeight: 500, margin: 0 },
  createBtn: {
    fontSize: 13,
    padding: "8px 16px",
    border: "none",
    borderRadius: 8,
    background: "#185FA5",
    color: "#fff",
    cursor: "pointer",
    fontWeight: 500,
  },
  testBtn: {
    fontSize: 13,
    padding: "8px 16px",
    border: "1px dashed #888",
    borderRadius: 8,
    background: "#fff",
    color: "#555",
    cursor: "pointer",
    fontWeight: 500,
  },

  loadingText: {
    fontSize: 14,
    color: "#999",
    textAlign: "center",
    padding: 40,
  },
  errorText: {
    fontSize: 14,
    color: "#c0392b",
    textAlign: "center",
    padding: 40,
  },

  tableWrap: {
    border: "1px solid #e5e5e5",
    borderRadius: 10,
    overflow: "hidden",
    background: "#fff",
  },
  table: { width: "100%", borderCollapse: "collapse", tableLayout: "fixed" },
  th: {
    fontSize: 12,
    fontWeight: 500,
    color: "#888",
    textAlign: "left",
    padding: "10px 16px",
    background: "#fafafa",
    borderBottom: "1px solid #e5e5e5",
  },
  tr: { transition: "background 0.1s" },
  td: {
    fontSize: 13,
    color: "#666",
    padding: "12px 16px",
    borderBottom: "1px solid #f0f0f0",
  },
  tdMain: {
    fontSize: 13,
    fontWeight: 500,
    color: "#222",
    padding: "12px 16px",
    borderBottom: "1px solid #f0f0f0",
  },
  tdCode: {
    fontSize: 13,
    color: "#444",
    padding: "12px 16px",
    borderBottom: "1px solid #f0f0f0",
    fontFamily: '"SF Mono", "Fira Code", monospace',
    letterSpacing: "0.05em",
  },
  detailBtn: {
    fontSize: 12,
    color: "#185FA5",
    background: "none",
    border: "none",
    cursor: "pointer",
    fontWeight: 500,
  },

  emptyState: {
    textAlign: "center",
    padding: "60px 20px",
    background: "#fff",
    border: "1px solid #e5e5e5",
    borderRadius: 10,
  },
  emptyIcon: { marginBottom: 12 },
  emptyText: { fontSize: 15, color: "#666", margin: "0 0 16px" },
  emptyCreateBtn: {
    fontSize: 13,
    padding: "8px 16px",
    border: "none",
    borderRadius: 8,
    background: "#185FA5",
    color: "#fff",
    cursor: "pointer",
    fontWeight: 500,
  },
};
