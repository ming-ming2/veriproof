
import axiosInstance from './axiosInstance';

// 대시보드 시험 목록 조회 (백로그 1-3)
export const getExams = () => axiosInstance.get('/dashboard');

// 시험 상세 조회 (백로그 1-5)
export const getExamDetail = (examId) => axiosInstance.get(`/exams/${examId}`);

// 시험 개설 (백로그 1-4)
export const createExam = (payload) => axiosInstance.post('/exams', payload);

// 문항 이미지 업로드 (시험 개설 후 문항별 이미지 첨부 시 사용)
export const uploadQuestionImage = (examId, questionId, file) => {
  const formData = new FormData();
  formData.append('file', file);
  return axiosInstance.post(
    `/exams/${examId}/questions/${questionId}/images`,
    formData,
    { headers: { 'Content-Type': 'multipart/form-data' } }
  );
};




/*
// 시험 수정
export const updateExam = (id, data) => axiosInstance.put(`/exams/${id}`, data);

// 시험 삭제
export const deleteExam = (id) => axiosInstance.delete(`/exams/${id}`);

import axiosInstance from './axiosInstance';
*/

// ─────────────────────────────────────────────
// MOCK: 백엔드 API 합쳐지면 상단 코드로  교체
// ─────────────────────────────────────────────

// 시험 수정 (mock)
export const updateExam = (id, data) => {
  console.log('[MOCK] 시험 수정 호출됨', { id, data });
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({ data: { success: true, message: '시험이 수정되었습니다 (mock)' } });
    }, 500);
  });
  // 실제 API 연동 시:
  // return axiosInstance.put(`/exams/${id}`, data);
};

// 시험 삭제 (mock)
export const deleteExam = (id) => {
  console.log('[MOCK] 시험 삭제 호출됨', { id });
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({ data: { success: true, message: '시험이 삭제되었습니다 (mock)' } });
    }, 500);
  });
  // 실제 API 연동 시:
  // return axiosInstance.delete(`/exams/${id}`);
};

