import axiosInstance from './axiosInstance';

const h = (token) => ({ 'X-Proctor-Token': token });

export const getDashboard = (proctorToken) =>
  axiosInstance.get('/proctor/dashboard', { headers: h(proctorToken) });

export const getStudentDetail = (sessionUuid, proctorToken) =>
  axiosInstance.get(`/proctor/students/${sessionUuid}`, { headers: h(proctorToken) });
