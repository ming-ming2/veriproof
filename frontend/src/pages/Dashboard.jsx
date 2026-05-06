import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

// ──────────────────────────────────────────
// TODO: API 연동 시 아래 mock 데이터를 제거하고
// import { getExams } from "../api/exam"; 사용
// ──────────────────────────────────────────
const mockExams = [
  {
    id: 1,
    title: "중간고사",
    startAt: "2025-05-01T09:00:00",
    applicantCount: 32,
    code: "A1B2C3",
  },
  {
    id: 2,
    title: "기말고사",
    startAt: "2025-06-15T09:00:00",
    applicantCount: 0,
    code: "D4E5F6",
  },
];

export default function Dashboard() {
  const navigate = useNavigate();
  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(true);

  // 기존 HEAD에 있던 유저 정보 로직 살림
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const userName = user.name ? `${user.name} 교수` : "교수";

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/login");
  };

  useEffect(() => {
    // TODO: API 연동 시 교체
    // const fetchExams = async () => {
    //   const res = await getExams();
    //   setExams(res.data.exams);
    //   setLoading(false);
    // };
    // fetchExams();

    // mock: 0.5초 후 데이터 로드
    setTimeout(() => {
      setExams(mockExams);
      setLoading(false);
    }, 500);
  }, []);

  // 날짜 포맷 헬퍼
  const formatDate = (iso) => {
    const d = new Date(iso);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  };

  return (
    <div style={styles.page}>
      {/* 네비게이션 */}
      <nav style={styles.nav}>
        <span style={styles.navTitle}>시험 플랫폼</span>
        <div style={styles.navRight}>
          <span style={styles.navUser}>{userName}</span>
          <button style={styles.logoutBtn} onClick={handleLogout}>로그아웃</button>
        </div>
      </nav>

      <div style={styles.content}>
        {/* 페이지 헤더 */}
        <div style={styles.pageHeader}>
          <h1 style={styles.pageTitle}>내 시험 목록</h1>
          <button
            style={styles.createBtn}
            onClick={() => navigate("/exam/create")}
          >
            + 새 시험 만들기
          </button>
        </div>

        {/* 로딩 */}
        {loading && <div style={styles.loadingText}>불러오는 중...</div>}

        {/* 시험 목록 테이블 */}
        {!loading && exams.length > 0 && (
          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={{ ...styles.th, width: "40%" }}>시험명</th>
                  <th style={{ ...styles.th, width: "28%" }}>시작 시각</th>
                  <th style={{ ...styles.th, width: "18%" }}>응시자 수</th>
                  <th style={{ ...styles.th, width: "14%" }}></th>
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
                    <td style={styles.td}>{formatDate(exam.startAt)}</td>
                    <td style={styles.td}>{exam.applicantCount}명</td>
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

        {/* 빈 상태 */}
        {!loading && exams.length === 0 && (
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
            <p style={styles.emptySubText}>
              위의 "새 시험 만들기" 버튼으로 시작하세요
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// 스타일
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

  content: { maxWidth: 720, margin: "0 auto", padding: "32px 20px" },

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
  emptyText: { fontSize: 15, color: "#666", margin: "0 0 4px" },
  emptySubText: { fontSize: 13, color: "#aaa", margin: 0 },
};
