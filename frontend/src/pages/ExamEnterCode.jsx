import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { lookupExam } from '../api/exam-session';

export default function ExamEnterCode() {
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    const trimmed = code.trim().toUpperCase();
    if (trimmed.length !== 6) {
      setError('6자리 코드를 입력해주세요.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const { data: res } = await lookupExam(trimmed);
      navigate('/exam/enter', { state: { exam: res.data, examCode: trimmed } });
    } catch (err) {
      const errCode = err.response?.data?.error?.code;
      const messages = {
        EXAM_CODE_NOT_FOUND: '유효하지 않은 시험 코드입니다.',
        EXAM_NOT_STARTED: '시험이 아직 시작되지 않았습니다.\n시작 시간 이후 다시 시도해주세요.',
        EXAM_ENDED: '시험이 종료되었습니다.\n응시 가능한 시간이 지났습니다.',
      };
      const msg = messages[errCode] || '시험 코드 조회에 실패했습니다.';
      setError(msg);
      if (errCode === 'EXAM_NOT_STARTED' || errCode === 'EXAM_ENDED') {
        alert(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.title}>시험 입장</h1>
        <p style={styles.subtitle}>교수님께 받은 6자리 시험 코드를 입력하세요</p>
        <form onSubmit={handleSubmit} style={styles.form}>
          <input
            style={styles.input}
            type="text"
            placeholder="예) ABC123"
            value={code}
            onChange={(e) =>
              setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))
            }
            maxLength={6}
            autoFocus
            autoComplete="off"
          />
          {error && <p style={styles.error}>{error}</p>}
          <button style={styles.button} type="submit" disabled={loading || code.length !== 6}>
            {loading ? '확인 중...' : '입장'}
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
    width: 380,
    boxShadow: '0 4px 24px rgba(0,0,0,0.1)',
    textAlign: 'center',
  },
  title: { margin: '0 0 8px', fontSize: 28, fontWeight: 700, color: '#1a1a1a' },
  subtitle: { margin: '0 0 32px', color: '#666', fontSize: 14, lineHeight: 1.5 },
  form: { display: 'flex', flexDirection: 'column', gap: 12 },
  input: {
    padding: '16px',
    fontSize: 28,
    letterSpacing: 12,
    textAlign: 'center',
    border: '2px solid #e0e0e0',
    borderRadius: 8,
    outline: 'none',
    fontWeight: 700,
    fontFamily: 'monospace',
  },
  error: { color: '#e53935', fontSize: 14, margin: 0 },
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
    opacity: 1,
  },
};
