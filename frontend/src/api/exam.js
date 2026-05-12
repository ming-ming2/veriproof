import axiosInstance from './axiosInstance';

// 대시보드 시험 목록 조회 (백로그 3)
export const getExams = () => axiosInstance.get('/dashboard');

// 시험 상세 조회 (백로그 6)
export const getExamDetail = (examId) => axiosInstance.get(`/exams/${examId}`);

// 시험 개설 (백로그 4-5)
export const createExam = (payload) => axiosInstance.post('/exams', payload);

// 시험 수정 (전체 교체)
export const updateExam = (examId, payload) =>
  axiosInstance.put(`/exams/${examId}`, payload);

// 시험 삭제
export const deleteExam = (examId) => axiosInstance.delete(`/exams/${examId}`);

// 학생 답안 상세 조회 (백로그 11)
export const getSessionAnswers = (examId, sessionId) =>
  axiosInstance.get(`/exams/${examId}/sessions/${sessionId}/answers`);

// 주관식 답안 채점 (백로그 11)
export const gradeSubjective = (examId, sessionId, questionId, earnedScore) =>
  axiosInstance.put(
    `/exams/${examId}/sessions/${sessionId}/questions/${questionId}/grade`,
    { earnedScore }
  );

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
