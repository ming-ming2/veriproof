import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { login as loginApi, signup as signupApi } from '../api/auth';

// 로그인/회원가입 공통 로직을 담은 커스텀 훅
export function useAuth() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (formData) => {
    setLoading(true);
    setError('');
    try {
      const { data: res } = await loginApi(formData);
      localStorage.setItem('token', res.data.token);
      localStorage.setItem('user', JSON.stringify(res.data.professor));
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.error?.message || '로그인에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (formData) => {
    setLoading(true);
    setError('');
    try {
      await signupApi(formData);
      navigate('/login', { state: { signupSuccess: true } });
    } catch (err) {
      setError(err.response?.data?.error?.message || '회원가입에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return { loading, error, handleLogin, handleSignup };
}
