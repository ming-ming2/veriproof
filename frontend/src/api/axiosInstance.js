import axios from 'axios';

// 모든 API 요청에 공통으로 사용할 axios 인스턴스
const axiosInstance = axios.create({
  baseURL: '/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
});

// 요청 인터셉터: localStorage의 토큰을 Authorization 헤더에 자동 삽입
axiosInstance.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// 응답 인터셉터: 401(토큰 만료/무효) 발생 시 로그아웃 + 로그인 페이지로 이동
// 단, 로그인 시도 자체의 401(자격증명 오류)은 호출 측에서 메시지로 보여줘야 하므로 제외
axiosInstance.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const url = error.config?.url || '';
    const isAuthEndpoint = url.includes('/auth/login') || url.includes('/auth/signup');

    if (status === 401 && !isAuthEndpoint) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      if (window.location.pathname !== '/login') {
        window.location.replace('/login');
      }
    }
    return Promise.reject(error);
  }
);

export default axiosInstance;
