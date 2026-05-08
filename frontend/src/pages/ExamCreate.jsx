import { useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";

// 빈 문항 생성 헬퍼
const createEmptyQuestion = () => ({
  id: Date.now() + Math.random(),
  type: "subjective",                  // 'subjective' | 'objective' (UI 표기)
  content: "",
  score: "",
  correctAnswer: "",                   // 주관식 참조용 정답 (백로그 1-4)
  options: [
    { body: "", isCorrect: false },
    { body: "", isCorrect: false },
    { body: "", isCorrect: false },
    { body: "", isCorrect: false },
  ],
  imageFile: null,
  imagePreview: null,
});

// ─────────────────────────────────────────────
// 이미지 업로드 컴포넌트 (드래그앤드롭 + 파일선택)
// ─────────────────────────────────────────────
function ImageUploader({ imagePreview, onImageChange, onImageRemove }) {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);

  const handleFile = useCallback(
    (file) => {
      if (!file || !file.type.startsWith("image/")) return;
      const reader = new FileReader();
      reader.onload = (e) => onImageChange(file, e.target.result);
      reader.readAsDataURL(file);
    },
    [onImageChange]
  );

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };
  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };
  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    handleFile(file);
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    handleFile(file);
  };

  if (imagePreview) {
    return (
      <div style={styles.previewWrap}>
        <img src={imagePreview} alt="첨부 이미지" style={styles.previewImg} />
        <button type="button" onClick={onImageRemove} style={styles.removeBtn}>
          삭제
        </button>
      </div>
    );
  }

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={() => fileInputRef.current?.click()}
      style={{
        ...styles.dropZone,
        borderColor: isDragging ? "#378ADD" : "#d0d0d0",
        background: isDragging ? "#f0f7ff" : "#fafafa",
      }}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        style={{ display: "none" }}
      />
      <div style={styles.dropIcon}>
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <path d="M10 3v10M6 7l4-4 4 4" stroke="#999" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M3 14v2a1 1 0 001 1h12a1 1 0 001-1v-2" stroke="#999" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <span style={styles.dropText}>이미지를 드래그하거나 클릭해서 선택</span>
    </div>
  );
}

// ─────────────────────────────────────────────
// 문항 카드
// ─────────────────────────────────────────────
function QuestionCard({ question, index, onChange, onDelete, isOnly }) {
  const update = (field, value) => onChange({ ...question, [field]: value });

  // 선택지 본문 변경
  const updateOptionBody = (optIdx, body) => {
    const newOptions = question.options.map((opt, i) =>
      i === optIdx ? { ...opt, body } : opt
    );
    update("options", newOptions);
  };

  // 선택지 정답 토글
  const toggleOptionCorrect = (optIdx) => {
    const newOptions = question.options.map((opt, i) =>
      i === optIdx ? { ...opt, isCorrect: !opt.isCorrect } : opt
    );
    update("options", newOptions);
  };

  // 선택지 추가/삭제 (최소 2개 유지)
  const addOption = () =>
    update("options", [...question.options, { body: "", isCorrect: false }]);
  const removeOption = (optIdx) => {
    if (question.options.length <= 2) return;
    update(
      "options",
      question.options.filter((_, i) => i !== optIdx)
    );
  };

  return (
    <div style={styles.questionCard}>
      <div style={styles.qHeader}>
        <span style={styles.qNumber}>문항 {index + 1}</span>
        <div style={styles.qHeaderRight}>
          <div style={styles.typeToggle}>
            <button
              type="button"
              onClick={() => update("type", "subjective")}
              style={{
                ...styles.typeBtn,
                borderRadius: "6px 0 0 6px",
                ...(question.type === "subjective" ? styles.typeBtnActive : {}),
              }}
            >
              주관식
            </button>
            <button
              type="button"
              onClick={() => update("type", "objective")}
              style={{
                ...styles.typeBtn,
                borderRadius: "0 6px 6px 0",
                borderLeft: "none",
                ...(question.type === "objective" ? styles.typeBtnActive : {}),
              }}
            >
              객관식
            </button>
          </div>
          {!isOnly && (
            <button type="button" onClick={onDelete} style={styles.deleteBtn}>
              삭제
            </button>
          )}
        </div>
      </div>

      <textarea
        placeholder="문항 내용을 입력하세요"
        value={question.content}
        onChange={(e) => update("content", e.target.value)}
        rows={2}
        style={styles.textarea}
      />

      {/* 주관식: 참조용 정답 입력 */}
      {question.type === "subjective" && (
        <div style={styles.fieldGroup}>
          <label style={styles.smallLabel}>참조용 정답 (수동 채점 시 참고)</label>
          <input
            type="text"
            placeholder="정답 또는 모범답안"
            value={question.correctAnswer}
            onChange={(e) => update("correctAnswer", e.target.value)}
            style={styles.input}
          />
        </div>
      )}

      {/* 객관식: 선택지 + 정답 체크박스 */}
      {question.type === "objective" && (
        <div style={styles.optionsSection}>
          <div style={styles.optionsLabel}>선택지 (정답을 1개 이상 체크)</div>
          {question.options.map((opt, optIdx) => (
            <div key={optIdx} style={styles.optionRow}>
              <input
                type="checkbox"
                checked={opt.isCorrect}
                onChange={() => toggleOptionCorrect(optIdx)}
                style={styles.optionCheckbox}
                title="정답 여부"
              />
              <span style={styles.optionNum}>{optIdx + 1}</span>
              <input
                type="text"
                placeholder={`선택지 ${optIdx + 1}`}
                value={opt.body}
                onChange={(e) => updateOptionBody(optIdx, e.target.value)}
                style={styles.optionInput}
              />
              {question.options.length > 2 && (
                <button type="button" onClick={() => removeOption(optIdx)} style={styles.optionDeleteBtn}>
                  ✕
                </button>
              )}
            </div>
          ))}
          <button type="button" onClick={addOption} style={styles.addOptionBtn}>
            + 선택지 추가
          </button>
        </div>
      )}

      <div style={styles.qFooter}>
        <div style={styles.scoreWrap}>
          <label style={styles.scoreLabel}>배점</label>
          <input
            type="number"
            min="1"
            placeholder="0"
            value={question.score}
            onChange={(e) => update("score", e.target.value)}
            style={styles.scoreInput}
          />
        </div>
      </div>

      <ImageUploader
        imagePreview={question.imagePreview}
        onImageChange={(file, preview) =>
          onChange({ ...question, imageFile: file, imagePreview: preview })
        }
        onImageRemove={() =>
          onChange({ ...question, imageFile: null, imagePreview: null })
        }
      />
    </div>
  );
}

// ─────────────────────────────────────────────
// 메인: 시험 개설 페이지 (Step 1 — 시험 정보 + 문항)
// 다음 단계인 응시자 명단 등록은 /exam/create/roster 에서 진행
// ─────────────────────────────────────────────
export default function ExamCreate() {
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");
  const [questions, setQuestions] = useState([createEmptyQuestion()]);
  const [validationError, setValidationError] = useState("");

  // 문항 CRUD
  const addQuestion = () => setQuestions([...questions, createEmptyQuestion()]);
  const deleteQuestion = (id) => setQuestions(questions.filter((q) => q.id !== id));
  const updateQuestion = (id, updated) =>
    setQuestions(questions.map((q) => (q.id === id ? updated : q)));

  // 다음 단계로 이동 (페이로드는 RosterRegister에서 명단까지 합쳐 최종 전송)
  const handleNext = (e) => {
    e.preventDefault();
    setValidationError("");

    if (!title.trim()) return setValidationError("시험명을 입력하세요.");
    if (!startAt) return setValidationError("시작 시각을 입력하세요.");
    if (!endAt) return setValidationError("종료 시각을 입력하세요.");
    if (new Date(endAt) <= new Date(startAt))
      return setValidationError("종료 시각은 시작 시각보다 이후여야 합니다.");

    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!q.content.trim())
        return setValidationError(`문항 ${i + 1}의 본문을 입력하세요.`);
      if (!q.score || Number(q.score) < 1)
        return setValidationError(`문항 ${i + 1}의 배점은 1점 이상이어야 합니다.`);
      if (q.type === "objective") {
        const filledChoices = q.options.filter((opt) => opt.body.trim());
        if (filledChoices.length < 2)
          return setValidationError(`문항 ${i + 1}의 선택지를 2개 이상 작성하세요.`);
        if (!q.options.some((opt) => opt.body.trim() && opt.isCorrect))
          return setValidationError(`문항 ${i + 1}의 정답을 1개 이상 체크하세요.`);
      }
    }

    // 다음 페이지로 시험 정보 + 문항 전달
    // (이미지 File 객체는 navigate state에만 담김 — 새로고침 시 유실되지만
    //  RosterRegister에서 가드로 처리)
    navigate("/exam/create/roster", {
      state: {
        examMeta: {
          title: title.trim(),
          startAt,
          endAt,
        },
        questions,
      },
    });
  };

  return (
    <div style={styles.page}>
      <nav style={styles.nav}>
        <span style={styles.navTitle}>시험 플랫폼</span>
        <button
          style={styles.cancelBtn}
          onClick={() => navigate("/dashboard")}
          type="button"
        >
          목록으로
        </button>
      </nav>

      <form onSubmit={handleNext} style={styles.content}>
        <div style={styles.stepIndicator}>
          <span style={styles.stepActive}>1. 시험 정보 · 문항</span>
          <span style={styles.stepArrow}>›</span>
          <span style={styles.stepInactive}>2. 응시자 명단</span>
        </div>

        <h1 style={styles.pageTitle}>새 시험 만들기</h1>

        {/* 시험 기본 정보 */}
        <section style={styles.section}>
          <div style={styles.fieldGroup}>
            <label style={styles.label}>시험명</label>
            <input
              type="text"
              placeholder="예: 2026 봄학기 중간고사"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              style={styles.input}
            />
          </div>
          <div style={styles.row}>
            <div style={{ flex: 1 }}>
              <label style={styles.label}>시작 시각</label>
              <input
                type="datetime-local"
                value={startAt}
                onChange={(e) => setStartAt(e.target.value)}
                style={styles.input}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={styles.label}>종료 시각</label>
              <input
                type="datetime-local"
                value={endAt}
                onChange={(e) => setEndAt(e.target.value)}
                style={styles.input}
              />
            </div>
          </div>
        </section>

        <hr style={styles.divider} />

        {/* 문항 */}
        <section style={styles.section}>
          <div style={styles.sectionHeader}>
            <h2 style={styles.sectionTitle}>문항 ({questions.length}개)</h2>
            <span style={styles.totalScore}>
              총 배점: {questions.reduce((s, q) => s + (Number(q.score) || 0), 0)}점
            </span>
          </div>

          {questions.map((q, idx) => (
            <QuestionCard
              key={q.id}
              question={q}
              index={idx}
              onChange={(updated) => updateQuestion(q.id, updated)}
              onDelete={() => deleteQuestion(q.id)}
              isOnly={questions.length === 1}
            />
          ))}

          <button type="button" onClick={addQuestion} style={styles.addQBtn}>
            + 문항 추가
          </button>
        </section>

        {validationError && <p style={styles.errorMsg}>{validationError}</p>}

        <div style={styles.actions}>
          <button
            type="button"
            style={styles.cancelBtn}
            onClick={() => navigate("/dashboard")}
          >
            취소
          </button>
          <button type="submit" style={styles.submitBtn}>
            응시자 명단 등록 →
          </button>
        </div>
      </form>
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
  pageTitle: { fontSize: 20, fontWeight: 500, marginBottom: 24 },

  stepIndicator: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    fontSize: 12,
    marginBottom: 12,
  },
  stepActive: {
    color: "#185FA5",
    fontWeight: 600,
  },
  stepInactive: {
    color: "#aaa",
  },
  stepArrow: {
    color: "#ccc",
  },

  section: { marginBottom: 24 },
  sectionHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  sectionTitle: { fontSize: 16, fontWeight: 500, margin: 0 },
  totalScore: { fontSize: 13, color: "#666" },

  fieldGroup: { marginBottom: 12 },
  label: { display: "block", fontSize: 13, fontWeight: 500, color: "#555", marginBottom: 4 },
  smallLabel: { display: "block", fontSize: 12, color: "#888", marginBottom: 4 },
  input: {
    width: "100%",
    padding: "8px 12px",
    fontSize: 14,
    border: "1px solid #ddd",
    borderRadius: 8,
    outline: "none",
    boxSizing: "border-box",
  },
  row: { display: "flex", gap: 12 },
  divider: { border: "none", borderTop: "1px solid #e5e5e5", margin: "24px 0" },

  // 문항 카드
  questionCard: {
    background: "#fff",
    border: "1px solid #e5e5e5",
    borderRadius: 10,
    padding: 16,
    marginBottom: 12,
  },
  qHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  qNumber: { fontSize: 13, fontWeight: 500, color: "#333" },
  qHeaderRight: { display: "flex", alignItems: "center", gap: 10 },
  typeToggle: { display: "flex" },
  typeBtn: {
    fontSize: 12,
    padding: "4px 12px",
    border: "1px solid #ddd",
    background: "#fff",
    color: "#888",
    cursor: "pointer",
  },
  typeBtnActive: {
    background: "#eef4ff",
    color: "#185FA5",
    borderColor: "#85B7EB",
  },
  deleteBtn: {
    fontSize: 12,
    color: "#e24b4a",
    background: "none",
    border: "none",
    cursor: "pointer",
  },
  textarea: {
    width: "100%",
    padding: "8px 12px",
    fontSize: 14,
    border: "1px solid #ddd",
    borderRadius: 8,
    resize: "vertical",
    outline: "none",
    fontFamily: "inherit",
    boxSizing: "border-box",
    marginBottom: 10,
  },

  // 객관식 선택지
  optionsSection: { marginBottom: 10 },
  optionsLabel: { fontSize: 12, color: "#888", marginBottom: 6 },
  optionRow: { display: "flex", alignItems: "center", gap: 8, marginBottom: 6 },
  optionCheckbox: { width: 16, height: 16, cursor: "pointer", accentColor: "#185FA5" },
  optionNum: { fontSize: 12, fontWeight: 500, color: "#aaa", minWidth: 16, textAlign: "center" },
  optionInput: {
    flex: 1,
    padding: "6px 10px",
    fontSize: 13,
    border: "1px solid #ddd",
    borderRadius: 6,
    outline: "none",
  },
  optionDeleteBtn: {
    fontSize: 12,
    color: "#ccc",
    background: "none",
    border: "none",
    cursor: "pointer",
    padding: 4,
  },
  addOptionBtn: {
    fontSize: 12,
    color: "#185FA5",
    background: "none",
    border: "none",
    cursor: "pointer",
    marginTop: 2,
  },

  qFooter: { display: "flex", alignItems: "center", gap: 12, marginBottom: 10 },
  scoreWrap: { display: "flex", alignItems: "center", gap: 6 },
  scoreLabel: { fontSize: 12, color: "#888" },
  scoreInput: {
    width: 60,
    padding: "5px 8px",
    fontSize: 13,
    border: "1px solid #ddd",
    borderRadius: 6,
    outline: "none",
    textAlign: "center",
  },

  // 이미지 업로드
  dropZone: {
    border: "1.5px dashed #d0d0d0",
    borderRadius: 8,
    padding: "16px 12px",
    textAlign: "center",
    cursor: "pointer",
    transition: "all 0.15s",
  },
  dropIcon: { marginBottom: 4 },
  dropText: { fontSize: 12, color: "#999" },
  previewWrap: { position: "relative", display: "inline-block", marginTop: 4 },
  previewImg: {
    maxWidth: "100%",
    maxHeight: 160,
    borderRadius: 8,
    border: "1px solid #eee",
  },
  removeBtn: {
    position: "absolute",
    top: 6,
    right: 6,
    fontSize: 11,
    padding: "2px 8px",
    background: "rgba(0,0,0,0.55)",
    color: "#fff",
    border: "none",
    borderRadius: 4,
    cursor: "pointer",
  },

  errorMsg: {
    fontSize: 13,
    color: "#c0392b",
    background: "#fdecea",
    border: "1px solid #f5c2bd",
    borderRadius: 8,
    padding: "10px 14px",
    margin: "12px 0",
  },

  addQBtn: {
    width: "100%",
    padding: 12,
    fontSize: 13,
    border: "1.5px dashed #ccc",
    borderRadius: 8,
    background: "transparent",
    color: "#888",
    cursor: "pointer",
  },
  actions: {
    display: "flex",
    justifyContent: "flex-end",
    gap: 10,
    marginTop: 20,
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
    cursor: "pointer",
    fontWeight: 500,
  },
};
