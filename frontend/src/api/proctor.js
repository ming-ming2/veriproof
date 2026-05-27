import axiosInstance from './axiosInstance';

// 백로그 16: 대시보드 메타
export const getExamMeta = (proctorToken) =>
  axiosInstance.get(`/proctor/exams/${proctorToken}`);

// 백로그 16, 17: 학생 카드 목록 (?sort=attention|studentNumber)
export const getStudentList = (proctorToken, sort = 'attention') =>
  axiosInstance.get(`/proctor/exams/${proctorToken}/students?sort=${sort}`);

// 백로그 17: 학생 상세
export const getStudentDetail = (proctorToken, sessionUuid) =>
  axiosInstance.get(`/proctor/exams/${proctorToken}/students/${sessionUuid}`);

// 백로그 18: 이벤트 피드 (SSE 초기 적재 + 재연결 갭 보충)
export const getEventFeed = (proctorToken, since, limit = 50) => {
  const params = new URLSearchParams({ limit });
  if (since) params.set('since', since);
  return axiosInstance.get(`/proctor/exams/${proctorToken}/events?${params}`);
};
