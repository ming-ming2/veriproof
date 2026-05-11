import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getExamDetail, updateExam } from "../api/exam";

// ─────────────────────────────────────────────
// 이미지 업로드 컴포넌트
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
    handleFile(e.dataTransfer.files[0]);
  };
  const handleFileSelect = (e) => handleFile(e.target.files[0]);

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
      <span style={styles.dropText}>이미지를 드래그하거나 클릭해서 선택</span>
    </div>
  );
}

// ─────────────────────────────────────────────
// 문항 카드
// ─────────────────────────────────────────────
function QuestionCard({ question, index, onChange, onDelete, isOnly }) {
  const update = (field, value) => onChange({ ...question, [field]: value });

  const updateOption = (optIdx, value) => {
    const newOptions = [...question.options];
    newOptions[optIdx] = value;
    update("options", newOptions);
  };

  const addOption = () => update("options", [...question.options, ""]);
  const removeOption = (optIdx) => {
    if (question.options.length <= 2) return;
    update("options", question.options.filter((_, i) => i !== optIdx));
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
            <button type="button" onClick={onDelete} style={styles.deleteQBtn}>
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

      {question.type === "objective" && (
        <div style={styles.optionsSection}>
          <div style={styles.optionsLabel}>선택지</div>
          {question.options.map((opt, optIdx) => (
            <div key={optIdx} style={styles.optionRow}>
              <span style={styles.optionNum}>{optIdx + 1}</span>
              <input
                type="text"
                placeholder={`선택지 ${optIdx + 1}`}
                value={opt}
                onChange={(e) => updateOption(optIdx, e.target.value)}
                style={styles.optionInput}
              />
              {question.options.length > 2 && (
                <button
                  type="button"
                  onClick={() => removeOption(optIdx)}
                  style={styles.optionDeleteBtn}
                >
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
            min="0"
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
// 응시 명단 관리 컴포넌트 (신규)
// ─────────────────────────────────────────────
function RosterSection({ roster, onAdd, onRemove }) {
  const [studentNumber, setStudentNumber] = useState("");
  const [studentName, setStudentName] = useState("");

  const handleAdd = () => {
    if (!studentNumber.trim() || !studentName.trim()) return;
    // 중복 학번 체크
    if (roster.some((r) => r.studentNumber === studentNumber.trim())) {
      alert("이미 등록된 학번입니다.");
      return;
    }
    onAdd({
      // 새로 추가된 항목은 임시 id (음수) 부여
      id: -Date.now(),
      studentNumber: studentNumber.trim(),
      studentName: studentName.trim(),
    });
    setStudentNumber("");
    setStudentName("");
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAdd();
    }
  };

  return (
    <div>
      {/* 입력 영역 */}
      <div style={styles.rosterInputRow}>
        <input
          type="text"
          placeholder="학번"
          value={studentNumber}
          onChange={(e) => setStudentNumber(e.target.value)}
          onKeyDown={handleKeyDown}
          style={{ ...styles.input, flex: 1 }}
        />
        <input
          type="text"
          placeholder="이름"
          value={studentName}
          onChange={(e) => setStudentName(e.target.value)}
          onKeyDown={handleKeyDown}
          style={{ ...styles.input, flex: 1 }}
        />
        <button
          type="button"
          onClick={handleAdd}
          style={styles.rosterAddBtn}
        >
          + 추가
        </button>
      </div>

      {/* 명단 표시 */}
      {roster.length === 0 ? (
        <div style={styles.rosterEmpty}>등록된 학생이 없습니다.</div>
      ) : (
        <div style={styles.rosterList}>
          {roster.map((r) => (
            <div key={r.id} style={styles.rosterRow}>
              <span style={styles.rosterNumber}>{r.studentNumber}</span>
              <span style={styles.rosterName}>{r.studentName}</span>
              <button
                type="button"
                onClick={() => onRemove(r.id)}
                style={styles.rosterDeleteBtn}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
      <p style={styles.rosterHint}>
        총 {roster.length}명의 학생이 등록되어 있습니다.
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────
// 메인: 시험 수정 페이지
// ─────────────────────────────────────────────
export default function ExamEdit() {
  const navigate = useNavigate();
  const { id: examId } = useParams();

  const [title, setTitle] = useState("");
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");
  const [questions, setQuestions] = useState([]);
  const [roster, setRoster] = useState([]); // 응시 명단
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 기존 시험 데이터 불러오기
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data: res } = await getExamDetail(examId);
        if (cancelled) return;
        const exam = res.data;

        setTitle(exam.title);
        setStartAt(exam.startsAt?.slice(0, 16) || "");
        setEndAt(exam.endsAt?.slice(0, 16) || "");

        const formQuestions = exam.questions
          .slice()
          .sort((a, b) => a.displayOrder - b.displayOrder)
          .map((q) => ({
            id: q.id,
            type: q.questionType === "MULTIPLE_CHOICE" ? "objective" : "subjective",
            content: q.body || "",
            score: q.points?.toString() || "",
            options: q.choices?.map((c) => c.body) || ["", "", "", ""],
            imageFile: null,
            imagePreview: q.images?.[0]?.fileUrl || null,
          }));
        setQuestions(formQuestions.length > 0 ? formQuestions : [createEmpty()]);

        // 응시 명단 불러오기
        setRoster(exam.roster || []);
      } catch (err) {
        if (!cancelled) {
          setError(
            err.response?.data?.error?.message ||
              "시험 정보를 불러오지 못했습니다."
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

  const createEmpty = () => ({
    id: Date.now() + Math.random(),
    type: "subjective",
    content: "",
    score: "",
    options: ["", "", "", ""],
    imageFile: null,
    imagePreview: null,
  });

  const addQuestion = () => setQuestions([...questions, createEmpty()]);
  const deleteQuestion = (id) =>
    setQuestions(questions.filter((q) => q.id !== id));
  const updateQuestion = (id, updated) =>
    setQuestions(questions.map((q) => (q.id === id ? updated : q)));

  // 응시 명단 추가/삭제
  const addStudent = (student) => setRoster([...roster, student]);
  const removeStudent = (id) => setRoster(roster.filter((r) => r.id !== id));

  const handleSubmit = async (e) => {
    e.preventDefault();

    setIsSubmitting(true);
    try {
      const payload = {
        title,
        startsAt: startAt,
        endsAt: endAt,
        questions: questions.map((q, idx) => ({
          id: typeof q.id === "number" && q.id < 1e10 ? q.id : null,
          questionType:
            q.type === "objective" ? "MULTIPLE_CHOICE" : "SUBJECTIVE",
          body: q.content,
          points: Number(q.score) || 0,
          displayOrder: idx,
          choices:
            q.type === "objective"
              ? q.options.map((opt, i) => ({
                  body: opt,
                  displayOrder: i,
                }))
              : [],
        })),
        // 명단도 같이 보냄 (백엔드 명세 받으면 조정 필요)
        roster: roster.map((r) => ({
          id: r.id > 0 ? r.id : null, // 음수면 신규 추가된 항목
          studentNumber: r.studentNumber,
          studentName: r.studentName,
        })),
      };

      await updateExam(examId, payload);
      navigate(`/exam/${examId}`);
    } catch (err) {
      alert(err.response?.data?.error?.message || "시험 수정에 실패했습니다.");
      setIsSubmitting(false);
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

  if (error) {
    return (
      <div style={styles.page}>
        <nav style={styles.nav}>
          <span style={styles.navTitle}>시험 플랫폼</span>
        </nav>
        <div style={styles.content}>
          <p style={styles.errorText}>{error}</p>
          <button
            style={styles.cancelBtn}
            onClick={() => navigate("/dashboard")}
          >
            대시보드로
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <nav style={styles.nav}>
        <span style={styles.navTitle}>시험 플랫폼</span>
      </nav>

      <form onSubmit={handleSubmit} style={styles.content}>
        <h1 style={styles.pageTitle}>시험 수정</h1>

        {/* 기본 정보 */}
        <section style={styles.section}>
          <div style={styles.fieldGroup}>
            <label style={styles.label}>시험명</label>
            <input
              type="text"
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

        <hr style={styles.divider} />

        {/* 응시 명단 (신규) */}
        <section style={styles.section}>
          <div style={styles.sectionHeader}>
            <h2 style={styles.sectionTitle}>응시 명단</h2>
          </div>
          <RosterSection
            roster={roster}
            onAdd={addStudent}
            onRemove={removeStudent}
          />
        </section>

        {/* 액션 */}
        <div style={styles.actions}>
          <button
            type="button"
            style={styles.cancelBtn}
            onClick={() => navigate(`/exam/${examId}`)}
          >
            취소
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            style={{
              ...styles.submitBtn,
              opacity: isSubmitting ? 0.6 : 1,
            }}
          >
            {isSubmitting ? "수정 중..." : "수정 완료"}
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

  content: { maxWidth: 640, margin: "0 auto", padding: "32px 20px" },
  loadingText: { fontSize: 14, color: "#999", textAlign: "center", padding: 60 },
  errorText: { fontSize: 14, color: "#c0392b", padding: 20, textAlign: "center" },
  pageTitle: { fontSize: 20, fontWeight: 500, marginBottom: 24 },

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
  label: {
    display: "block",
    fontSize: 13,
    fontWeight: 500,
    color: "#555",
    marginBottom: 4,
  },
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
  deleteQBtn: {
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

  optionsSection: { marginBottom: 10 },
  optionsLabel: { fontSize: 12, color: "#888", marginBottom: 6 },
  optionRow: { display: "flex", alignItems: "center", gap: 8, marginBottom: 6 },
  optionNum: {
    fontSize: 12,
    fontWeight: 500,
    color: "#aaa",
    minWidth: 16,
    textAlign: "center",
  },
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

  dropZone: {
    border: "1.5px dashed #d0d0d0",
    borderRadius: 8,
    padding: "16px 12px",
    textAlign: "center",
    cursor: "pointer",
    transition: "all 0.15s",
  },
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

  // 응시 명단
  rosterInputRow: {
    display: "flex",
    gap: 8,
    marginBottom: 12,
  },
  rosterAddBtn: {
    padding: "8px 16px",
    fontSize: 13,
    border: "none",
    borderRadius: 8,
    background: "#185FA5",
    color: "#fff",
    cursor: "pointer",
    fontWeight: 500,
    whiteSpace: "nowrap",
  },
  rosterEmpty: {
    textAlign: "center",
    padding: 24,
    background: "#fafafa",
    border: "1px dashed #ddd",
    borderRadius: 8,
    fontSize: 13,
    color: "#999",
  },
  rosterList: {
    background: "#fff",
    border: "1px solid #e5e5e5",
    borderRadius: 8,
    overflow: "hidden",
    maxHeight: 240,
    overflowY: "auto",
  },
  rosterRow: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "10px 14px",
    borderBottom: "1px solid #f0f0f0",
  },
  rosterNumber: {
    fontSize: 13,
    fontFamily: '"SF Mono", "Fira Code", monospace',
    color: "#444",
    minWidth: 100,
  },
  rosterName: { fontSize: 13, color: "#222", flex: 1 },
  rosterDeleteBtn: {
    fontSize: 14,
    color: "#999",
    background: "none",
    border: "none",
    cursor: "pointer",
    padding: 4,
  },
  rosterHint: {
    fontSize: 12,
    color: "#888",
    marginTop: 6,
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
