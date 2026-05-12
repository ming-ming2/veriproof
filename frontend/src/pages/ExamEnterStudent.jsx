import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { startSession } from '../api/exam-session';
import { useFullscreen } from '../hooks/useFullscreen';

export default function ExamEnterStudent() {
  const navigate = useNavigate();
  const location = useLocation();
  const { exam, examCode } = location.state || {};
  const { requestFullscreen } = useFullscreen();

  const [form, setForm] = useState({ studentNumber: '', studentName: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!exam || !examCode) {
    navigate('/exam', { replace: true });
    return null;
  }

  const formatDatetime = (iso) => {
    const d = new Date(iso);
    const h = String(d.getHours()).padStart(2, '0');
    const m = String(d.getMinutes()).padStart(2, '0');
    return `${h}:${m}`;
  };

  const handleChange = (e) => {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.studentNumber.trim() || !form.studentName.trim()) {
      setError('학번과 이름을 모두 입력해주세요.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const { data: res } = await startSession(examCode, {
        studentNumber: form.studentNumber.trim(),
        studentName: form.studentName.trim(),
      });

      sessionStorage.setItem('sessionToken', res.data.sessionToken);
      sessionStorage.setItem('sessionData', JSON.stringify(res.data));

      const ok = await requestFullscreen();
      if (!ok) {
        setError('전체 화면 모드가 필요합니다. 브라우저에서 전체화면을 허용해주세요.');
        sessionStorage.removeItem('sessionToken');
        sessionStorage.removeItem('sessionData');
        setLoading(false);
        return;
      }
      navigate('/exam/session', { replace: true });
    } catch (err) {
      const errCode = err.response?.data?.error?.code;
      const messages = {
        EXAM_NOT_STARTED: `시험이 아직 시작되지 않았습니다 (시작 시간: ${formatDatetime(exam.startsAt)})`,
        EXAM_ENDED: '시험이 종료되었습니다.',
        STUDENT_NOT_IN_ROSTER: '응시 권한이 없습니다.',
        CONCURRENT_SESSION: '이미 다른 기기에서 응시 중입니다.\n약 30초 후 다시 시도해주세요.',
        SESSION_ALREADY_SUBMITTED: '이미 제출된 시험입니다.',
        EXAM_CODE_NOT_FOUND: '시험 코드를 찾을 수 없습니다.',
        LOCK_UNAVAILABLE: '현재 서버 상태가 불안정합니다. 잠시 후 다시 시도해주세요.',
      };
      const msg = messages[errCode] || '입장에 실패했습니다. 다시 시도해주세요.';
      setError(msg);
      // 학생이 inline 메시지를 놓치지 않도록 critical 차단 사유는 알림창으로도 안내
      const alertCodes = ['CONCURRENT_SESSION', 'SESSION_ALREADY_SUBMITTED', 'EXAM_ENDED', 'LOCK_UNAVAILABLE'];
      if (alertCodes.includes(errCode)) {
        alert(msg);
      }
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.examTitle}>{exam.title}</h1>
        <div style={styles.meta}>
          <span>
            {formatDatetime(exam.startsAt)} ~ {formatDatetime(exam.endsAt)}
          </span>
          <span>|</span>
          <span>{exam.questionCount}문항</span>
        </div>

        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.fieldGroup}>
            <label style={styles.label}>학번</label>
            <input
              style={styles.input}
              name="studentNumber"
              type="text"
              placeholder="학번을 입력하세요"
              value={form.studentNumber}
              onChange={handleChange}
              autoComplete="off"
            />
          </div>
          <div style={styles.fieldGroup}>
            <label style={styles.label}>이름</label>
            <input
              style={styles.input}
              name="studentName"
              type="text"
              placeholder="이름을 입력하세요"
              value={form.studentName}
              onChange={handleChange}
              autoComplete="off"
            />
          </div>

          {error && <p style={styles.error}>{error}</p>}

          <p style={styles.notice}>
            ⚠️ 시험 시작 후 다른 창 전환 또는 전체화면 해제 시 이탈로 기록됩니다.
          </p>

          <button
            style={styles.button}
            type="submit"
            disabled={loading || !form.studentNumber.trim() || !form.studentName.trim()}
          >
            {loading ? '입장 중...' : '시험 시작'}
          </button>
        </form>
      </div>
    </div>
  );
}

const styles = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#f0f2f5',
  },
  card: {
    background: '#fff',
    borderRadius: 12,
    padding: '48px 40px',
    width: 420,
    boxShadow: '0 4px 24px rgba(0,0,0,0.1)',
  },
  examTitle: { margin: '0 0 8px', fontSize: 22, fontWeight: 700, color: '#1a1a1a', textAlign: 'center' },
  meta: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    color: '#666',
    fontSize: 14,
    marginBottom: 32,
  },
  form: { display: 'flex', flexDirection: 'column', gap: 12 },
  fieldGroup: { display: 'flex', flexDirection: 'column', gap: 4 },
  label: { fontSize: 14, fontWeight: 600, color: '#333' },
  input: {
    padding: '12px 14px',
    fontSize: 15,
    border: '2px solid #e0e0e0',
    borderRadius: 8,
    outline: 'none',
  },
  error: { color: '#e53935', fontSize: 14, margin: '4px 0 0', textAlign: 'center' },
  notice: {
    fontSize: 13,
    color: '#f57c00',
    background: '#fff8e1',
    border: '1px solid #ffe082',
    borderRadius: 8,
    padding: '10px 14px',
    margin: '4px 0',
    lineHeight: 1.5,
  },
  button: {
    padding: '14px',
    fontSize: 16,
    fontWeight: 600,
    background: '#1976d2',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    cursor: 'pointer',
    marginTop: 4,
  },
};
