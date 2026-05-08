import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getExams } from "../api/exam";

export default function Dashboard() {
  const navigate = useNavigate();
  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const userName = user.name ? `${user.name} 교수` : "교수";

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/login");
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data: res } = await getExams();
        if (!cancelled) setExams(res.data || []);
      } catch (err) {
        if (!cancelled) {
          setError(err.response?.data?.error?.message || "시험 목록을 불러오지 못했습니다.");
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
        <div style={styles.navRight}>
          <span style={styles.navUser}>{userName}</span>
          <button style={styles.logoutBtn} onClick={handleLogout}>로그아웃</button>
        </div>
      </nav>

      <div style={styles.content}>
        <div style={styles.pageHeader}>
          <h1 style={styles.pageTitle}>내 시험 목록</h1>
          <button
            style={styles.createBtn}
            onClick={() => navigate("/exam/create")}
          >
            + 새 시험 만들기
          </button>
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
  navRight: { display: "flex", alignItems: "center", gap: 12 },
  navUser: { fontSize: 13, color: "#888" },
  logoutBtn: {
    fontSize: 12,
    padding: "5px 12px",
    border: "1px solid #ddd",
    borderRadius: 6,
    background: "#fff",
    color: "#666",
    cursor: "pointer",
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
