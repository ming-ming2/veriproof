import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getExamDetail } from "../api/exam";

export default function ExamDetail() {
  const navigate = useNavigate();
  const { id: examId } = useParams();
  const [exam, setExam] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [codeCopied, setCodeCopied] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data: res } = await getExamDetail(examId);
        if (!cancelled) setExam(res.data);
      } catch (err) {
        if (!cancelled) {
          setError(
            err.response?.data?.error?.message ||
              "시험 상세 정보를 불러오지 못했습니다."
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [examId]);

  const formatDate = (iso) => {
    if (!iso) return "-";
    const d = new Date(iso);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  };

  const copyToClipboard = async (text, setter) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
    }
    setter(true);
    setTimeout(() => setter(false), 2000);
  };

  const sessionStatusLabel = (status) => {
    switch (status) {
      case "IN_PROGRESS":
        return "응시 중";
      case "SUBMITTED":
        return "제출 완료";
      case "EXPIRED":
        return "만료";
      default:
        return status || "-";
    }
  };

  if (loading) {
    return (
      <div style={styles.page}>
        <nav style={styles.nav}>
          <span style={styles.navTitle}>시험 플랫폼</span>
        </nav>
        <div style={styles.loadingText}>불러오는 중...</div>
      </div>
    );
  }

  if (error || !exam) {
    return (
      <div style={styles.page}>
        <nav style={styles.nav}>
          <span style={styles.navTitle}>시험 플랫폼</span>
        </nav>
        <div style={styles.content}>
          <div style={styles.emptyState}>
            <p style={styles.emptyText}>{error || "시험을 찾을 수 없습니다."}</p>
            <button
              style={styles.backBtn}
              onClick={() => navigate("/dashboard")}
            >
              목록으로
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 코드를 3글자씩 나눠서 표시 (A1B2C3 → A1B 2C3)
  const displayCode = exam.examCode.match(/.{1,3}/g)?.join(" ") || exam.examCode;

  return (
    <div style={styles.page}>
      <nav style={styles.nav}>
        <span style={styles.navTitle}>시험 플랫폼</span>
        <button
          style={styles.backBtn}
          onClick={() => navigate("/dashboard")}
        >
          목록으로
        </button>
      </nav>

      <div style={styles.content}>
        <div style={styles.pageHeader}>
          <div>
            <p style={styles.breadcrumb}>{exam.title}</p>
            <h1 style={styles.pageTitle}>시험 상세</h1>
          </div>
        </div>

        {/* 시험 시간 */}
        <div style={styles.statGrid}>
          <div style={styles.statCard}>
            <div style={styles.statLabel}>시작 시각</div>
            <div style={styles.statValue}>{formatDate(exam.startsAt)}</div>
          </div>
          <div style={styles.statCard}>
            <div style={styles.statLabel}>종료 시각</div>
            <div style={styles.statValue}>{formatDate(exam.endsAt)}</div>
          </div>
          <div style={styles.statCard}>
            <div style={styles.statLabel}>문항 수</div>
            <div style={styles.statValueBig}>{exam.questions.length}개</div>
          </div>
          <div style={styles.statCard}>
            <div style={styles.statLabel}>응시 명단</div>
            <div style={styles.statValueBig}>{exam.roster.length}명</div>
          </div>
        </div>

        {/* 시험 코드 */}
        <div style={styles.sectionLabel}>시험 코드</div>
        <div style={styles.codeBox}>
          <span style={styles.codeValue}>{displayCode}</span>
          <button
            style={styles.copyBtn}
            onClick={() => copyToClipboard(exam.examCode, setCodeCopied)}
          >
            {codeCopied ? "복사됨!" : "복사"}
          </button>
        </div>

        {/* 감독관 링크 */}
        <div style={styles.sectionLabel}>감독관 링크</div>
        <div style={styles.linkBox}>
          <span style={styles.linkValue}>{exam.proctorLink}</span>
          <button
            style={styles.copyBtn}
            onClick={() => copyToClipboard(exam.proctorLink, setLinkCopied)}
          >
            {linkCopied ? "복사됨!" : "복사"}
          </button>
        </div>

        {/* 문항 목록 (정답 데이터 포함, 교수만 조회) */}
        <div style={styles.sectionLabel}>문항 목록</div>
        <div style={styles.questionList}>
          {exam.questions
            .slice()
            .sort((a, b) => a.displayOrder - b.displayOrder)
            .map((q, idx) => (
              <div key={q.id} style={styles.questionItem}>
                <div style={styles.questionItemHeader}>
                  <span style={styles.questionItemNumber}>문항 {idx + 1}</span>
                  <span style={styles.questionItemTypeBadge}>
                    {q.questionType === "MULTIPLE_CHOICE" ? "객관식" : "주관식"}
                  </span>
                  <span style={styles.questionItemPoints}>{q.points}점</span>
                </div>
                <div style={styles.questionItemBody}>{q.body}</div>

                {q.images && q.images.length > 0 && (
                  <div style={styles.questionImageRow}>
                    {q.images.map((img) => (
                      <img
                        key={img.id}
                        src={img.fileUrl}
                        alt="문항 이미지"
                        style={styles.questionImage}
                      />
                    ))}
                  </div>
                )}

                {q.questionType === "MULTIPLE_CHOICE" && (
                  <ul style={styles.choiceList}>
                    {q.choices
                      .slice()
                      .sort((a, b) => a.displayOrder - b.displayOrder)
                      .map((c) => (
                        <li
                          key={c.id}
                          style={{
                            ...styles.choiceItem,
                            ...(c.isCorrect ? styles.choiceItemCorrect : {}),
                          }}
                        >
                          {c.isCorrect ? "✔ " : ""}
                          {c.body}
                        </li>
                      ))}
                  </ul>
                )}

                {q.questionType === "SUBJECTIVE" && q.correctAnswer && (
                  <div style={styles.correctAnswerBox}>
                    <span style={styles.correctAnswerLabel}>참조용 정답</span>
                    <span style={styles.correctAnswerText}>{q.correctAnswer}</span>
                  </div>
                )}
              </div>
            ))}
        </div>

        {/* 응시 명단 */}
        <div style={styles.sectionLabel}>응시 명단 ({exam.roster.length}명)</div>
        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>학번</th>
                <th style={styles.th}>이름</th>
              </tr>
            </thead>
            <tbody>
              {exam.roster.map((r) => (
                <tr key={r.id}>
                  <td style={styles.tdMono}>{r.studentNumber}</td>
                  <td style={styles.td}>{r.studentName}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* 응시 학생 (실제로 응시한 세션) */}
        <div style={styles.sectionLabel}>
          응시 학생 ({exam.sessions.length}명)
        </div>
        {exam.sessions.length > 0 ? (
          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>학번</th>
                  <th style={styles.th}>이름</th>
                  <th style={styles.th}>상태</th>
                  <th style={styles.th}>총점</th>
                  <th style={styles.th}>응시 시각</th>
                  <th style={styles.th}>제출 시각</th>
                </tr>
              </thead>
              <tbody>
                {exam.sessions.map((s) => (
                  <tr key={s.sessionUuid}>
                    <td style={styles.tdMono}>{s.studentNumber}</td>
                    <td style={styles.td}>{s.studentName}</td>
                    <td style={styles.td}>{sessionStatusLabel(s.status)}</td>
                    <td style={styles.td}>{s.totalScore ?? "-"}</td>
                    <td style={styles.td}>{formatDate(s.startedAt)}</td>
                    <td style={styles.td}>{formatDate(s.submittedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={styles.emptySessionBox}>아직 응시한 학생이 없습니다.</div>
        )}
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    background: "#f7f7f8",
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
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

  content: { maxWidth: 720, margin: "0 auto", padding: "32px 20px" },
  loadingText: { fontSize: 14, color: "#999", textAlign: "center", padding: 60 },

  pageHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 20,
  },
  breadcrumb: { fontSize: 13, color: "#888", margin: "0 0 2px" },
  pageTitle: { fontSize: 20, fontWeight: 500, margin: 0 },
  backBtn: {
    fontSize: 12,
    padding: "6px 14px",
    border: "1px solid #ddd",
    borderRadius: 6,
    background: "#fff",
    color: "#666",
    cursor: "pointer",
  },

  // 통계 카드
  statGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 10,
    marginBottom: 24,
  },
  statCard: {
    background: "#fff",
    border: "1px solid #e5e5e5",
    borderRadius: 10,
    padding: "14px 16px",
  },
  statLabel: { fontSize: 12, color: "#888", marginBottom: 4 },
  statValue: { fontSize: 14, fontWeight: 500, color: "#333" },
  statValueBig: { fontSize: 22, fontWeight: 500, color: "#222" },

  // 시험 코드
  sectionLabel: {
    fontSize: 13,
    fontWeight: 500,
    color: "#555",
    marginBottom: 8,
    marginTop: 18,
  },
  codeBox: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    background: "#fff",
    border: "1px solid #e5e5e5",
    borderRadius: 10,
    padding: "16px 20px",
    marginBottom: 8,
  },
  codeValue: {
    fontSize: 28,
    fontWeight: 500,
    fontFamily: '"SF Mono", "Fira Code", monospace',
    letterSpacing: "0.15em",
    color: "#222",
  },
  linkBox: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    background: "#fff",
    border: "1px solid #e5e5e5",
    borderRadius: 10,
    padding: "12px 16px",
    gap: 12,
  },
  linkValue: {
    flex: 1,
    fontSize: 12,
    color: "#444",
    fontFamily: '"SF Mono", "Fira Code", monospace',
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  copyBtn: {
    fontSize: 12,
    padding: "6px 14px",
    border: "1px solid #ddd",
    borderRadius: 6,
    background: "#fff",
    color: "#666",
    cursor: "pointer",
    fontWeight: 500,
  },

  // 문항 목록
  questionList: { display: "flex", flexDirection: "column", gap: 10 },
  questionItem: {
    background: "#fff",
    border: "1px solid #e5e5e5",
    borderRadius: 10,
    padding: 14,
  },
  questionItemHeader: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  questionItemNumber: { fontSize: 13, fontWeight: 600, color: "#333" },
  questionItemTypeBadge: {
    fontSize: 11,
    padding: "2px 8px",
    borderRadius: 4,
    background: "#eef4ff",
    color: "#185FA5",
  },
  questionItemPoints: { fontSize: 12, color: "#888", marginLeft: "auto" },
  questionItemBody: {
    fontSize: 13,
    color: "#333",
    whiteSpace: "pre-wrap",
    marginBottom: 8,
  },
  questionImageRow: { display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 },
  questionImage: {
    maxWidth: 200,
    maxHeight: 140,
    borderRadius: 6,
    border: "1px solid #eee",
  },
  choiceList: { listStyle: "none", padding: 0, margin: 0 },
  choiceItem: {
    fontSize: 13,
    color: "#555",
    padding: "4px 0",
  },
  choiceItemCorrect: { color: "#185FA5", fontWeight: 600 },
  correctAnswerBox: {
    marginTop: 6,
    padding: "8px 10px",
    background: "#fafafa",
    borderRadius: 6,
    display: "flex",
    gap: 8,
  },
  correctAnswerLabel: {
    fontSize: 11,
    color: "#888",
    fontWeight: 500,
  },
  correctAnswerText: {
    fontSize: 12,
    color: "#444",
  },

  // 테이블
  tableWrap: {
    border: "1px solid #e5e5e5",
    borderRadius: 10,
    overflow: "hidden",
    background: "#fff",
  },
  table: { width: "100%", borderCollapse: "collapse" },
  th: {
    fontSize: 12,
    fontWeight: 500,
    color: "#888",
    textAlign: "left",
    padding: "10px 14px",
    background: "#fafafa",
    borderBottom: "1px solid #e5e5e5",
  },
  td: {
    fontSize: 13,
    color: "#444",
    padding: "10px 14px",
    borderBottom: "1px solid #f0f0f0",
  },
  tdMono: {
    fontSize: 13,
    color: "#444",
    padding: "10px 14px",
    borderBottom: "1px solid #f0f0f0",
    fontFamily: '"SF Mono", "Fira Code", monospace',
  },
  emptySessionBox: {
    textAlign: "center",
    padding: 24,
    background: "#fff",
    border: "1px solid #e5e5e5",
    borderRadius: 10,
    fontSize: 13,
    color: "#999",
  },

  emptyState: { textAlign: "center", padding: "60px 20px" },
  emptyText: { fontSize: 15, color: "#666", marginBottom: 16 },
};
