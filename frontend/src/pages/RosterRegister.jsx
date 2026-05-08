import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { createExam, getExamDetail, uploadQuestionImage } from "../api/exam";

// datetime-local 입력값을 ISO-8601 (UTC)로 변환
const toIsoWithOffset = (localDateTime) => {
  if (!localDateTime) return null;
  return new Date(localDateTime).toISOString();
};

const toQuestionType = (uiType) =>
  uiType === "objective" ? "MULTIPLE_CHOICE" : "SUBJECTIVE";

// 일괄 입력 텍스트를 명단 row 배열로 파싱
// - 한 줄에 한 명
// - 구분자: 콤마, 탭, 공백 다수 (placeholder는 콤마지만 관대하게)
const parseBulkText = (text) => {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const parts = line.split(/[,\t]|\s{2,}|\s+/).filter(Boolean);
      const studentNumber = (parts[0] || "").trim();
      const studentName = parts.slice(1).join(" ").trim();
      return { studentNumber, studentName };
    })
    .filter((row) => row.studentNumber && row.studentName);
};

// ─────────────────────────────────────────────
// 메인: 응시자 명단 등록 (Step 2)
// ─────────────────────────────────────────────
export default function RosterRegister() {
  const navigate = useNavigate();
  const location = useLocation();

  // 이전 페이지에서 넘어온 데이터 (없으면 가드 발동)
  const examMeta = location.state?.examMeta;
  const questions = location.state?.questions;

  const [tab, setTab] = useState("individual"); // 'individual' | 'bulk'
  const [individualNumber, setIndividualNumber] = useState("");
  const [individualName, setIndividualName] = useState("");
  const [bulkText, setBulkText] = useState("");
  const [bulkFeedback, setBulkFeedback] = useState("");
  const [roster, setRoster] = useState([]); // 미리보기 목록
  const [duplicateError, setDuplicateError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  // 직접 진입 / 새로고침 가드: 시험 정보가 없으면 안내 후 복귀
  useEffect(() => {
    if (!examMeta || !questions) {
      const t = setTimeout(() => navigate("/exam/create", { replace: true }), 1500);
      return () => clearTimeout(t);
    }
  }, [examMeta, questions, navigate]);

  if (!examMeta || !questions) {
    return (
      <div style={styles.page}>
        <nav style={styles.nav}>
          <span style={styles.navTitle}>시험 플랫폼</span>
        </nav>
        <div style={styles.guardBox}>
          <p style={styles.guardText}>
            시험 정보가 유실되었습니다. 시험 정보 입력 화면으로 돌아갑니다…
          </p>
        </div>
      </div>
    );
  }

  // ─── 명단 조작 헬퍼 ───
  const addRosterRow = (rows) => {
    setDuplicateError("");
    const existing = new Set(roster.map((r) => r.studentNumber));
    const accepted = [];
    const dups = [];
    for (const r of rows) {
      if (existing.has(r.studentNumber) || accepted.some((a) => a.studentNumber === r.studentNumber)) {
        dups.push(r.studentNumber);
        continue;
      }
      accepted.push({ ...r, id: Date.now() + Math.random() });
    }
    if (accepted.length > 0) {
      setRoster([...roster, ...accepted]);
    }
    return { addedCount: accepted.length, dupCount: dups.length, dups };
  };

  // ─── 개별 추가 ───
  const handleAddIndividual = () => {
    if (!individualNumber.trim() || !individualName.trim()) {
      setDuplicateError("학번과 이름을 모두 입력하세요.");
      return;
    }
    const result = addRosterRow([
      { studentNumber: individualNumber.trim(), studentName: individualName.trim() },
    ]);
    if (result.dupCount > 0) {
      setDuplicateError(`이미 등록된 학번입니다: ${result.dups.join(", ")}`);
      return;
    }
    setIndividualNumber("");
    setIndividualName("");
  };

  // ─── 일괄 명단 추출 ───
  const handleExtractBulk = () => {
    setBulkFeedback("");
    setDuplicateError("");
    const parsed = parseBulkText(bulkText);
    if (parsed.length === 0) {
      setBulkFeedback("추출 가능한 항목이 없습니다. 한 줄에 \"학번,이름\" 형식으로 입력하세요.");
      return;
    }
    const result = addRosterRow(parsed);
    const parts = [`${result.addedCount}명 추가`];
    if (result.dupCount > 0) parts.push(`${result.dupCount}명 중복 제외`);
    setBulkFeedback(parts.join(" · "));
    if (result.addedCount > 0) setBulkText("");
  };

  const removeRosterRow = (id) =>
    setRoster(roster.filter((r) => r.id !== id));

  // ─── 시험 개설 완료 ───
  const handleComplete = async () => {
    setSubmitError("");
    if (roster.length === 0) {
      setSubmitError("응시자 명단을 최소 1명 이상 등록하세요.");
      return;
    }

    const payload = {
      title: examMeta.title,
      startsAt: toIsoWithOffset(examMeta.startAt),
      endsAt: toIsoWithOffset(examMeta.endAt),
      questions: questions.map((q, idx) => {
        const questionType = toQuestionType(q.type);
        const filledChoices =
          questionType === "MULTIPLE_CHOICE"
            ? q.options
                .filter((opt) => opt.body.trim())
                .map((opt, optIdx) => ({
                  body: opt.body.trim(),
                  isCorrect: !!opt.isCorrect,
                  displayOrder: optIdx + 1,
                }))
            : null;
        return {
          questionType,
          body: q.content.trim(),
          correctAnswer:
            questionType === "SUBJECTIVE" && q.correctAnswer.trim()
              ? q.correctAnswer.trim()
              : null,
          points: Number(q.score),
          displayOrder: idx + 1,
          choices: filledChoices,
        };
      }),
      roster: roster.map((r) => ({
        studentNumber: r.studentNumber,
        studentName: r.studentName,
      })),
    };

    setIsSubmitting(true);
    try {
      const { data: res } = await createExam(payload);
      const created = res.data;

      // 문항별 이미지 업로드 (questionId는 상세 조회로 displayOrder 매칭)
      const questionsWithImages = questions.filter((q) => q.imageFile);
      if (questionsWithImages.length > 0) {
        try {
          const { data: detailRes } = await getExamDetail(created.id);
          const detail = detailRes.data;
          await Promise.all(
            questionsWithImages.map(async (q) => {
              const idx = questions.indexOf(q);
              const displayOrder = idx + 1;
              const matched = detail.questions.find(
                (dq) => dq.displayOrder === displayOrder
              );
              if (!matched) return;
              await uploadQuestionImage(created.id, matched.id, q.imageFile);
            })
          );
        } catch (uploadErr) {
          console.warn("이미지 업로드 일부 실패:", uploadErr);
        }
      }

      navigate(`/exam/${created.id}`, { replace: true });
    } catch (err) {
      const code = err.response?.data?.error?.code;
      const message =
        err.response?.data?.error?.message || "시험 개설에 실패했습니다.";
      setSubmitError(code ? `[${code}] ${message}` : message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={styles.page}>
      <nav style={styles.nav}>
        <span style={styles.navTitle}>시험 플랫폼</span>
        <button
          type="button"
          style={styles.cancelBtn}
          onClick={() => navigate("/dashboard")}
        >
          목록으로
        </button>
      </nav>

      <div style={styles.content}>
        <div style={styles.stepIndicator}>
          <span style={styles.stepDone}>1. 시험 정보 · 문항</span>
          <span style={styles.stepArrow}>›</span>
          <span style={styles.stepActive}>2. 응시자 명단</span>
        </div>

        <h1 style={styles.pageTitle}>응시자 명단 등록</h1>
        <p style={styles.subtitle}>
          {examMeta.title} · 문항 {questions.length}개
        </p>

        {/* 탭 */}
        <div style={styles.tabBar}>
          <button
            type="button"
            onClick={() => setTab("individual")}
            style={{
              ...styles.tabBtn,
              ...(tab === "individual" ? styles.tabBtnActive : {}),
            }}
          >
            개별 추가
          </button>
          <button
            type="button"
            onClick={() => setTab("bulk")}
            style={{
              ...styles.tabBtn,
              ...(tab === "bulk" ? styles.tabBtnActive : {}),
            }}
          >
            일괄 추가
          </button>
        </div>

        {/* 탭 내용 */}
        <div style={styles.tabPanel}>
          {tab === "individual" && (
            <div>
              <div style={styles.individualRow}>
                <input
                  type="text"
                  placeholder="학번 (예: 20230001)"
                  value={individualNumber}
                  onChange={(e) => {
                    setIndividualNumber(e.target.value);
                    setDuplicateError("");
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddIndividual();
                    }
                  }}
                  style={{ ...styles.input, flex: 1 }}
                />
                <input
                  type="text"
                  placeholder="이름 (예: 홍길동)"
                  value={individualName}
                  onChange={(e) => {
                    setIndividualName(e.target.value);
                    setDuplicateError("");
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddIndividual();
                    }
                  }}
                  style={{ ...styles.input, flex: 2 }}
                />
                <button
                  type="button"
                  onClick={handleAddIndividual}
                  style={styles.primaryBtn}
                >
                  추가
                </button>
              </div>
              {duplicateError && (
                <p style={styles.inlineError}>{duplicateError}</p>
              )}
            </div>
          )}

          {tab === "bulk" && (
            <div>
              <p style={styles.bulkHint}>
                한 줄에 한 명. <code>학번,이름</code> 또는{" "}
                <code>학번 이름</code> (탭/공백) 모두 인식.
              </p>
              <textarea
                placeholder={"20230001,홍길동\n20230002,이영희\n20230003,박민수"}
                value={bulkText}
                onChange={(e) => {
                  setBulkText(e.target.value);
                  setBulkFeedback("");
                }}
                rows={8}
                style={styles.bulkTextarea}
              />
              <div style={styles.bulkActions}>
                <button
                  type="button"
                  onClick={handleExtractBulk}
                  style={styles.primaryBtn}
                >
                  명단 추출
                </button>
                {bulkFeedback && (
                  <span style={styles.bulkFeedback}>{bulkFeedback}</span>
                )}
              </div>
              {duplicateError && (
                <p style={styles.inlineError}>{duplicateError}</p>
              )}
            </div>
          )}
        </div>

        {/* 등록 예정자 미리보기 */}
        <div style={styles.sectionLabel}>
          등록 예정자 ({roster.length}명)
        </div>
        {roster.length === 0 ? (
          <div style={styles.emptyPreview}>
            아직 추가된 학생이 없습니다. 위에서 개별 또는 일괄 추가하세요.
          </div>
        ) : (
          <div style={styles.previewTable}>
            <div style={styles.previewHeader}>
              <div style={{ ...styles.previewHeaderCell, flex: 1 }}>학번</div>
              <div style={{ ...styles.previewHeaderCell, flex: 2 }}>이름</div>
              <div style={{ ...styles.previewHeaderCell, width: 50 }}></div>
            </div>
            {roster.map((r) => (
              <div key={r.id} style={styles.previewRow}>
                <div style={{ ...styles.previewCell, flex: 1, fontFamily: '"SF Mono", monospace' }}>
                  {r.studentNumber}
                </div>
                <div style={{ ...styles.previewCell, flex: 2 }}>
                  {r.studentName}
                </div>
                <button
                  type="button"
                  onClick={() => removeRosterRow(r.id)}
                  style={styles.previewDeleteBtn}
                  title="삭제"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}

        {submitError && <p style={styles.errorMsg}>{submitError}</p>}

        <div style={styles.actions}>
          <button
            type="button"
            style={styles.cancelBtn}
            onClick={() => navigate(-1)}
            disabled={isSubmitting}
          >
            ← 이전
          </button>
          <button
            type="button"
            onClick={handleComplete}
            disabled={isSubmitting || roster.length === 0}
            style={{
              ...styles.submitBtn,
              opacity: isSubmitting || roster.length === 0 ? 0.5 : 1,
              cursor: isSubmitting || roster.length === 0 ? "not-allowed" : "pointer",
            }}
          >
            {isSubmitting ? "개설 중..." : "시험 개설 완료"}
          </button>
        </div>
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

  guardBox: {
    maxWidth: 480,
    margin: "60px auto",
    background: "#fff",
    border: "1px solid #e5e5e5",
    borderRadius: 10,
    padding: 24,
    textAlign: "center",
  },
  guardText: { fontSize: 14, color: "#555", margin: 0 },

  stepIndicator: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    fontSize: 12,
    marginBottom: 12,
  },
  stepActive: { color: "#185FA5", fontWeight: 600 },
  stepDone: { color: "#777" },
  stepArrow: { color: "#ccc" },

  pageTitle: { fontSize: 20, fontWeight: 500, margin: "0 0 4px" },
  subtitle: { fontSize: 13, color: "#888", margin: "0 0 24px" },

  // 탭
  tabBar: {
    display: "flex",
    borderBottom: "1px solid #e5e5e5",
    marginBottom: 16,
  },
  tabBtn: {
    padding: "10px 20px",
    fontSize: 14,
    background: "none",
    border: "none",
    borderBottom: "2px solid transparent",
    color: "#888",
    cursor: "pointer",
    fontWeight: 500,
  },
  tabBtnActive: {
    color: "#185FA5",
    borderBottomColor: "#185FA5",
  },

  tabPanel: {
    background: "#fff",
    border: "1px solid #e5e5e5",
    borderRadius: 10,
    padding: 16,
    marginBottom: 24,
  },

  // 개별 추가
  individualRow: { display: "flex", gap: 8, alignItems: "center" },
  input: {
    padding: "8px 12px",
    fontSize: 14,
    border: "1px solid #ddd",
    borderRadius: 8,
    outline: "none",
    boxSizing: "border-box",
  },

  // 일괄 추가
  bulkHint: {
    fontSize: 12,
    color: "#888",
    margin: "0 0 8px",
  },
  bulkTextarea: {
    width: "100%",
    padding: "10px 12px",
    fontSize: 13,
    border: "1px solid #ddd",
    borderRadius: 8,
    outline: "none",
    fontFamily: '"SF Mono", monospace',
    boxSizing: "border-box",
    resize: "vertical",
    marginBottom: 8,
  },
  bulkActions: {
    display: "flex",
    alignItems: "center",
    gap: 12,
  },
  bulkFeedback: {
    fontSize: 13,
    color: "#2c8e41",
  },

  primaryBtn: {
    padding: "8px 18px",
    fontSize: 13,
    border: "none",
    borderRadius: 8,
    background: "#185FA5",
    color: "#fff",
    cursor: "pointer",
    fontWeight: 500,
    whiteSpace: "nowrap",
  },

  inlineError: {
    fontSize: 12,
    color: "#c0392b",
    margin: "8px 0 0",
  },

  // 미리보기
  sectionLabel: {
    fontSize: 13,
    fontWeight: 500,
    color: "#555",
    marginBottom: 8,
  },
  emptyPreview: {
    background: "#fff",
    border: "1px dashed #ddd",
    borderRadius: 10,
    padding: "30px 20px",
    textAlign: "center",
    fontSize: 13,
    color: "#aaa",
  },
  previewTable: {
    background: "#fff",
    border: "1px solid #e5e5e5",
    borderRadius: 10,
    overflow: "hidden",
  },
  previewHeader: {
    display: "flex",
    background: "#fafafa",
    borderBottom: "1px solid #e5e5e5",
    padding: "8px 12px",
    gap: 8,
  },
  previewHeaderCell: {
    fontSize: 12,
    fontWeight: 500,
    color: "#888",
  },
  previewRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "10px 12px",
    borderBottom: "1px solid #f0f0f0",
  },
  previewCell: {
    fontSize: 13,
    color: "#333",
  },
  previewDeleteBtn: {
    width: 50,
    fontSize: 14,
    color: "#aaa",
    background: "none",
    border: "none",
    cursor: "pointer",
  },

  errorMsg: {
    fontSize: 13,
    color: "#c0392b",
    background: "#fdecea",
    border: "1px solid #f5c2bd",
    borderRadius: 8,
    padding: "10px 14px",
    margin: "16px 0 0",
  },

  actions: {
    display: "flex",
    justifyContent: "space-between",
    gap: 10,
    marginTop: 24,
    paddingTop: 20,
    borderTop: "1px solid #e5e5e5",
  },
  cancelBtn: {
    padding: "8px 20px",
    fontSize: 14,
    border: "1px solid #ddd",
    borderRadius: 8,
    background: "#fff",
    color: "#666",
    cursor: "pointer",
  },
  submitBtn: {
    padding: "8px 24px",
    fontSize: 14,
    border: "none",
    borderRadius: 8,
    background: "#185FA5",
    color: "#fff",
    fontWeight: 500,
  },
};
