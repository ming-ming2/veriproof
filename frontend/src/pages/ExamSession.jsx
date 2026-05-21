import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getSession, saveAnswer, submitExam, sendHeartbeat } from '../api/exam-session';
import { useFullscreen } from '../hooks/useFullscreen';
import { useExamGuard } from '../hooks/useExamGuard';
import { useExamWebsocket } from '../hooks/useExamWebsocket';
import { useBehaviorTracker } from '../hooks/useBehaviorTracker';

export default function ExamSession() {
  const navigate = useNavigate();
  const { requestFullscreen } = useFullscreen();
  const { violationCount, showWarning, lastViolationType, dismissWarning, deactivate } = useExamGuard({ requestFullscreen });

  const sessionTokenRef = useRef(sessionStorage.getItem('sessionToken'));

  const answersRef = useRef({});
  const questionsRef = useRef([]);
  const getAnswers = useCallback(() => answersRef.current, []);
  const getQuestions = useCallback(() => questionsRef.current, []);

  const { setCurrentQuestionId, deactivate: deactivateWs } = useExamWebsocket({
    sessionToken: sessionTokenRef.current,
  });
  const { trackKeystroke, trackChoiceChange, trackNavigation, flushBeforeSubmit } = useBehaviorTracker({
    sessionToken: sessionTokenRef.current,
    getAnswers,
    getQuestions,
  });

  const [loading, setLoading] = useState(true);
  const [sessionInfo, setSessionInfo] = useState(null); // { examTitle, endsAt, questions }
  const [answers, setAnswers] = useState({});           // { [questionId]: { answerText, selectedChoiceIds } }
  const [currentIndex, setCurrentIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [showSubmitDialog, setShowSubmitDialog] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [forcedOut, setForcedOut] = useState(false);

  const saveTimers = useRef({});
  const hasSubmitted = useRef(false);
  const isComposingRef = useRef(false);
  // IME 합성 시작 시점의 선택 영역 길이 — 합성 종료 후 그만큼을 먼저 delete 이벤트로 기록한다.
  const compositionSelLenRef = useRef(0);
  const deactivateRef = useRef(deactivate);
  deactivateRef.current = deactivate;
  const deactivateWsRef = useRef(deactivateWs);
  deactivateWsRef.current = deactivateWs;
  const flushBeforeSubmitRef = useRef(flushBeforeSubmit);
  flushBeforeSubmitRef.current = flushBeforeSubmit;
  const setCurrentQuestionIdRef = useRef(setCurrentQuestionId);
  setCurrentQuestionIdRef.current = setCurrentQuestionId;

  const doFinish = useCallback(async () => {
    if (hasSubmitted.current) return;
    hasSubmitted.current = true;
    deactivateRef.current();
    deactivateWsRef.current();
    sessionStorage.removeItem('sessionToken');
    sessionStorage.removeItem('sessionData');
    if (document.fullscreenElement) {
      try { await document.exitFullscreen(); } catch {}
    }
    navigate('/exam/done', { replace: true });
  }, [navigate]);

  const doSubmit = useCallback(async () => {
    if (hasSubmitted.current) return false;
    await flushBeforeSubmitRef.current();
    try {
      await submitExam(sessionTokenRef.current);
    } catch (err) {
      const errCode = err.response?.data?.error?.code;
      if (errCode !== 'SESSION_ALREADY_SUBMITTED') return false;
    }
    await doFinish();
    return true;
  }, [doFinish]);

  // 마운트 시 세션 조회
  useEffect(() => {
    if (!sessionTokenRef.current) {
      navigate('/exam', { replace: true });
      return;
    }

    getSession(sessionTokenRef.current)
      .then(({ data: res }) => {
        const d = res.data;
        questionsRef.current = d.questions;
        setSessionInfo({ examTitle: d.examTitle, endsAt: d.endsAt, questions: d.questions });

        // 이전 답안 복원
        const init = {};
        (d.drafts || []).forEach((draft) => {
          init[draft.questionId] = {
            answerText: draft.answerText || '',
            selectedChoiceIds: draft.selectedChoiceIds || [],
          };
        });
        answersRef.current = init;
        setAnswers(init);
        setLoading(false);
      })
      .catch((err) => {
        const errCode = err.response?.data?.error?.code;
        if (errCode === 'SESSION_ALREADY_SUBMITTED') {
          navigate('/exam/done', { replace: true });
        } else {
          sessionStorage.removeItem('sessionToken');
          sessionStorage.removeItem('sessionData');
          navigate('/exam', { replace: true });
        }
      });
  }, [navigate]);

  // 타이머 + heartbeat (sessionInfo 로딩 후 시작)
  useEffect(() => {
    if (!sessionInfo) return;

    const endsAt = new Date(sessionInfo.endsAt).getTime();

    const calcLeft = () => Math.max(0, Math.floor((endsAt - Date.now()) / 1000));
    setTimeLeft(calcLeft());

    const timerInterval = setInterval(() => {
      const left = calcLeft();
      setTimeLeft(left);
      if (left === 0) {
        clearInterval(timerInterval);
        doSubmit();
      }
    }, 1000);

    const heartbeatInterval = setInterval(() => {
      sendHeartbeat(sessionTokenRef.current).catch((err) => {
        const errCode = err.response?.data?.error?.code;
        if (errCode === 'CONCURRENT_SESSION' || errCode === 'INVALID_SESSION_TOKEN' || errCode === 'SESSION_NOT_FOUND') {
          setForcedOut(true);
          clearInterval(heartbeatInterval);
        }
      });
    }, 10000);

    return () => {
      clearInterval(timerInterval);
      clearInterval(heartbeatInterval);
    };
  }, [sessionInfo, doSubmit]);

  // currentIndex 변경 시 WS에 현재 문항 ID 갱신
  useEffect(() => {
    if (!sessionInfo?.questions) return;
    const q = sessionInfo.questions[currentIndex];
    if (q?.id) setCurrentQuestionIdRef.current(q.id);
  }, [currentIndex, sessionInfo]);

  // 문항 이동 + 네비게이션 추적
  const navigateTo = useCallback((newIndex) => {
    if (!sessionInfo?.questions) return;
    const fromQ = sessionInfo.questions[currentIndex];
    const toQ = sessionInfo.questions[newIndex];
    if (fromQ && toQ) trackNavigation(fromQ.id, toQ.id);
    setCurrentIndex(newIndex);
  }, [currentIndex, sessionInfo, trackNavigation]);

  const debounceSave = useCallback((questionId, data) => {
    clearTimeout(saveTimers.current[questionId]);
    saveTimers.current[questionId] = setTimeout(() => {
      saveAnswer(questionId, data, sessionTokenRef.current).catch(() => {});
    }, 1000);
  }, []);

  const handleTextChange = (questionId, value) => {
    const data = { answerText: value, selectedChoiceIds: [] };
    answersRef.current = { ...answersRef.current, [questionId]: data };
    setAnswers((prev) => ({ ...prev, [questionId]: data }));
    debounceSave(questionId, data);
  };

  const handleChoiceToggle = (questionId, choiceId) => {
    // StrictMode 대응: setState updater 내부에서 부수효과(trackChoiceChange 등)를 호출하면
    // dev 모드에서 두 번 실행되어 이벤트가 중복 기록되므로 모든 부수효과는 밖으로 분리한다.
    const cur = answersRef.current[questionId]?.selectedChoiceIds || [];
    const next = cur.includes(choiceId) ? cur.filter((id) => id !== choiceId) : [...cur, choiceId];
    const data = { answerText: '', selectedChoiceIds: next };
    answersRef.current = { ...answersRef.current, [questionId]: data };
    trackChoiceChange(questionId, cur, next);
    debounceSave(questionId, data);
    setAnswers((prev) => ({ ...prev, [questionId]: data }));
  };

  const handleSubmitConfirm = async () => {
    setSubmitting(true);
    const ok = await doSubmit();
    if (!ok) {
      setSubmitting(false);
      setShowSubmitDialog(false);
    }
  };

  const formatTime = (secs) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  // --- 렌더링 ---

  if (loading) {
    return (
      <div style={styles.centerScreen}>
        <p style={{ color: '#666', fontSize: 16 }}>시험 정보를 불러오는 중...</p>
      </div>
    );
  }

  if (forcedOut) {
    return (
      <div style={styles.centerScreen}>
        <div style={styles.warningBox}>
          <h2 style={{ color: '#e53935', margin: '0 0 12px' }}>응시 세션이 종료되었습니다</h2>
          <p style={{ color: '#555' }}>다른 기기에서 접속이 감지되어 현재 세션이 종료되었습니다.</p>
        </div>
      </div>
    );
  }

  const questions = sessionInfo?.questions || [];
  const currentQ = questions[currentIndex];
  const currentAnswer = answers[currentQ?.id] || { answerText: '', selectedChoiceIds: [] };
  const isWarningTime = timeLeft > 0 && timeLeft <= 300;

  return (
    <div style={styles.container}>
      {/* 헤더 */}
      <header style={styles.header}>
        <span style={styles.examTitle}>{sessionInfo?.examTitle}</span>
        <span style={{ ...styles.timer, color: isWarningTime ? '#e53935' : '#1a1a1a' }}>
          {isWarningTime && '⚠️ '}남은 시간: {formatTime(timeLeft)}
        </span>
        <button style={styles.submitBtn} onClick={() => setShowSubmitDialog(true)}>
          제출
        </button>
      </header>

      <div style={styles.body}>
        {/* 문항 번호 사이드바 */}
        <aside style={styles.sidebar}>
          <p style={styles.sidebarTitle}>문항 목록</p>
          <div style={styles.questionList}>
            {questions.map((q, i) => {
              const ans = answers[q.id];
              const answered = ans?.answerText?.trim() || ans?.selectedChoiceIds?.length > 0;
              const isActive = i === currentIndex;
              return (
                <button
                  key={q.id}
                  style={{
                    ...styles.questionNumBtn,
                    background: isActive ? '#1976d2' : answered ? '#e3f2fd' : '#f5f5f5',
                    color: isActive ? '#fff' : '#333',
                    fontWeight: isActive ? 700 : 400,
                    border: isActive ? '2px solid #1976d2' : answered ? '2px solid #90caf9' : '2px solid transparent',
                  }}
                  onClick={() => navigateTo(i)}
                >
                  {i + 1}
                </button>
              );
            })}
          </div>
        </aside>

        {/* 문항 영역 */}
        <main style={styles.main}>
          {currentQ ? (
            <>
              <div style={styles.questionHeader}>
                <span style={styles.questionNum}>
                  문항 {currentIndex + 1} / {questions.length}
                </span>
                <span style={styles.badge('#e3f2fd', '#1976d2')}>{currentQ.points}점</span>
                <span style={styles.badge('#f3f4f6', '#555')}>
                  {currentQ.questionType === 'SUBJECTIVE' ? '주관식' : '객관식'}
                </span>
              </div>

              <p style={styles.questionBody}>{currentQ.body}</p>

              {currentQ.images?.length > 0 && (
                <div style={styles.imageArea}>
                  {currentQ.images.map((img) => (
                    <img key={img.id} src={img.fileUrl} alt="문항 이미지" style={styles.questionImage} />
                  ))}
                </div>
              )}

              {currentQ.questionType === 'SUBJECTIVE' ? (
                <textarea
                  style={styles.textarea}
                  placeholder="답안을 입력하세요"
                  value={currentAnswer.answerText}
                  onChange={(e) => handleTextChange(currentQ.id, e.target.value)}
                  onKeyDown={(e) => {
                    // IME 합성 중에는 onKeyDown으로 잡지 않는다 (한글 등). e.key가 'Process'인 경우도 동일.
                    if (isComposingRef.current || e.key === 'Process') return;
                    const ta = e.currentTarget;
                    const selLen = Math.abs((ta.selectionEnd ?? 0) - (ta.selectionStart ?? 0));
                    if (e.ctrlKey || e.metaKey) {
                      // Ctrl/Cmd 조합인데 선택 영역이 있는 상태로 Backspace/Delete를 누르면
                      // 브라우저는 그 선택분을 한 번에 삭제한다. 그 길이만큼 delete 이벤트 발행.
                      // (Ctrl+A 후 Ctrl 떼지 않고 바로 Backspace 누르는 흔한 패턴)
                      if ((e.key === 'Backspace' || e.key === 'Delete') && selLen > 0) {
                        for (let i = 0; i < selLen; i++) {
                          trackKeystroke(currentQ.id, 'Backspace', 'delete');
                        }
                      }
                      // 그 외 Ctrl/Cmd 조합 (Ctrl+A, Ctrl+V, Ctrl+X 등)은 글자 입력이 아니므로 스킵
                      return;
                    }
                    if (e.key === 'Backspace' || e.key === 'Delete') {
                      const count = selLen > 0 ? selLen : 1;
                      for (let i = 0; i < count; i++) {
                        trackKeystroke(currentQ.id, e.key, 'delete');
                      }
                    } else if (e.key === 'Enter') {
                      for (let i = 0; i < selLen; i++) {
                        trackKeystroke(currentQ.id, 'Backspace', 'delete');
                      }
                      trackKeystroke(currentQ.id, '\n', 'insert');
                    } else if (e.key.length === 1) {
                      for (let i = 0; i < selLen; i++) {
                        trackKeystroke(currentQ.id, 'Backspace', 'delete');
                      }
                      trackKeystroke(currentQ.id, e.key, 'insert');
                    }
                  }}
                  onCompositionStart={(e) => {
                    isComposingRef.current = true;
                    const ta = e.currentTarget;
                    compositionSelLenRef.current = Math.abs((ta.selectionEnd ?? 0) - (ta.selectionStart ?? 0));
                  }}
                  onCompositionEnd={(e) => {
                    isComposingRef.current = false;
                    const selLen = compositionSelLenRef.current || 0;
                    compositionSelLenRef.current = 0;
                    for (let i = 0; i < selLen; i++) {
                      trackKeystroke(currentQ.id, 'Backspace', 'delete');
                    }
                    const text = e.data || '';
                    for (const ch of text) {
                      trackKeystroke(currentQ.id, ch, 'insert');
                    }
                  }}
                />
              ) : (
                <div style={styles.choicesArea}>
                  {(currentQ.choices || []).map((choice) => {
                    const selected = currentAnswer.selectedChoiceIds.includes(choice.id);
                    return (
                      <label
                        key={choice.id}
                        style={{
                          ...styles.choiceLabel,
                          background: selected ? '#e3f2fd' : '#fafafa',
                          borderColor: selected ? '#1976d2' : '#e0e0e0',
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={() => handleChoiceToggle(currentQ.id, choice.id)}
                          style={styles.checkbox}
                        />
                        <span>{choice.body}</span>
                      </label>
                    );
                  })}
                </div>
              )}

              <div style={styles.navButtons}>
                <button
                  style={{ ...styles.navBtn, opacity: currentIndex === 0 ? 0.35 : 1 }}
                  disabled={currentIndex === 0}
                  onClick={() => navigateTo(currentIndex - 1)}
                >
                  ◀ 이전 문항
                </button>
                <button
                  style={{ ...styles.navBtn, opacity: currentIndex === questions.length - 1 ? 0.35 : 1 }}
                  disabled={currentIndex === questions.length - 1}
                  onClick={() => navigateTo(currentIndex + 1)}
                >
                  다음 문항 ▶
                </button>
              </div>
            </>
          ) : (
            <p style={{ color: '#999' }}>문항을 불러올 수 없습니다.</p>
          )}
        </main>
      </div>

      {/* 이탈/부정행위 감지 경고 오버레이 */}
      {showWarning && (
        <div style={styles.overlay}>
          <div style={styles.dialogBox}>
            {lastViolationType === 'copy' ? (
              <>
                <h2 style={{ color: '#e53935', margin: '0 0 8px', fontSize: 22 }}>복사 감지</h2>
                <p style={{ color: '#555', margin: '0 0 6px', fontSize: 15 }}>
                  Ctrl+C(복사) 사용이 감지되었습니다.
                </p>
                <p style={{ color: '#555', margin: '0 0 6px', fontSize: 14 }}>
                  시험 중 복사는 부정행위로 기록됩니다.
                </p>
              </>
            ) : lastViolationType === 'paste' ? (
              <>
                <h2 style={{ color: '#e53935', margin: '0 0 8px', fontSize: 22 }}>붙여넣기 감지</h2>
                <p style={{ color: '#555', margin: '0 0 6px', fontSize: 15 }}>
                  Ctrl+V(붙여넣기) 사용이 감지되었습니다.
                </p>
                <p style={{ color: '#555', margin: '0 0 6px', fontSize: 14 }}>
                  시험 중 붙여넣기는 부정행위로 기록됩니다.
                </p>
              </>
            ) : (
              <>
                <h2 style={{ color: '#e53935', margin: '0 0 8px', fontSize: 22 }}>이탈 감지</h2>
                <p style={{ color: '#555', margin: '0 0 6px', fontSize: 15 }}>
                  다른 창 전환 또는 전체화면 해제가 감지되었습니다.
                </p>
              </>
            )}
            <p style={{ color: '#e53935', fontWeight: 700, margin: '0 0 28px', fontSize: 16 }}>
              누적 경고 횟수: {violationCount}회
            </p>
            <button style={styles.returnBtn} onClick={dismissWarning}>
              시험으로 돌아가기
            </button>
          </div>
        </div>
      )}

      {/* 제출 확인 다이얼로그 */}
      {showSubmitDialog && (
        <div style={styles.overlay}>
          <div style={styles.dialogBox}>
            <h2 style={{ margin: '0 0 12px', fontSize: 22 }}>제출하시겠습니까?</h2>
            <p style={{ color: '#666', margin: '0 0 28px', fontSize: 15 }}>
              제출 후에는 답안을 수정할 수 없습니다.
            </p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              <button
                style={styles.cancelBtn}
                onClick={() => setShowSubmitDialog(false)}
                disabled={submitting}
              >
                취소
              </button>
              <button style={styles.confirmBtn} onClick={handleSubmitConfirm} disabled={submitting}>
                {submitting ? '제출 중...' : '확인'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  container: { display: 'flex', flexDirection: 'column', height: '100vh', background: '#f5f7fa', fontFamily: 'sans-serif', overflow: 'hidden' },
  centerScreen: { height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  header: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '12px 24px', background: '#fff', borderBottom: '1px solid #e0e0e0',
    flexShrink: 0, zIndex: 10,
  },
  examTitle: { fontWeight: 700, fontSize: 18, color: '#1a1a1a', flex: 1 },
  timer: { fontWeight: 700, fontSize: 18, flex: 1, textAlign: 'center' },
  submitBtn: {
    padding: '10px 28px', background: '#e53935', color: '#fff',
    border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 15, cursor: 'pointer', flex: 0,
  },
  body: { display: 'flex', flex: 1, overflow: 'hidden' },
  sidebar: {
    width: 80, padding: '16px 8px', background: '#fff', borderRight: '1px solid #e0e0e0',
    overflowY: 'auto', flexShrink: 0,
  },
  sidebarTitle: { fontSize: 11, color: '#aaa', textAlign: 'center', margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: 1 },
  questionList: { display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'center' },
  questionNumBtn: {
    width: 44, height: 44, border: '2px solid transparent', borderRadius: 8,
    cursor: 'pointer', fontSize: 14, transition: 'all 0.15s',
  },
  main: { flex: 1, padding: '32px 48px', overflowY: 'auto' },
  questionHeader: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 },
  questionNum: { fontWeight: 700, fontSize: 18, color: '#1a1a1a' },
  badge: (bg, color) => ({
    background: bg, color, padding: '2px 10px', borderRadius: 12, fontSize: 13, fontWeight: 600,
  }),
  questionBody: { fontSize: 17, lineHeight: 1.75, color: '#222', marginBottom: 24, whiteSpace: 'pre-wrap' },
  imageArea: { marginBottom: 20, display: 'flex', flexWrap: 'wrap', gap: 12 },
  questionImage: { maxWidth: '100%', maxHeight: 400, borderRadius: 8, border: '1px solid #e0e0e0' },
  textarea: {
    width: '100%', minHeight: 180, padding: '14px', fontSize: 15,
    border: '2px solid #e0e0e0', borderRadius: 8, resize: 'vertical', outline: 'none',
    lineHeight: 1.6, boxSizing: 'border-box', fontFamily: 'inherit',
  },
  choicesArea: { display: 'flex', flexDirection: 'column', gap: 10 },
  choiceLabel: {
    display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px',
    border: '2px solid', borderRadius: 8, cursor: 'pointer', fontSize: 15,
    transition: 'all 0.15s', userSelect: 'none',
  },
  checkbox: { width: 18, height: 18, cursor: 'pointer', flexShrink: 0 },
  navButtons: { display: 'flex', justifyContent: 'space-between', marginTop: 40 },
  navBtn: {
    padding: '10px 24px', background: '#fff', border: '2px solid #e0e0e0',
    borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer', color: '#333',
  },
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
  },
  dialogBox: {
    background: '#fff', borderRadius: 16, padding: '44px 52px', textAlign: 'center',
    maxWidth: 440, width: '90%', boxShadow: '0 8px 40px rgba(0,0,0,0.25)',
  },
  returnBtn: {
    padding: '12px 36px', background: '#1976d2', color: '#fff',
    border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 16, cursor: 'pointer',
  },
  cancelBtn: {
    padding: '12px 28px', background: '#f5f5f5', color: '#333',
    border: '2px solid #e0e0e0', borderRadius: 8, fontWeight: 600, fontSize: 15, cursor: 'pointer',
  },
  confirmBtn: {
    padding: '12px 28px', background: '#1976d2', color: '#fff',
    border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 15, cursor: 'pointer',
  },
};
