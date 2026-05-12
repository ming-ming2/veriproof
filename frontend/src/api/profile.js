import axiosInstance from './axiosInstance';

// 내 프로필 조회 — 응답: { username, name, affiliation }
export const getProfile = () => axiosInstance.get('/auth/me');

// 프로필 수정 (이름, 소속)
export const updateProfile = (data) => axiosInstance.patch('/auth/update', data);

// 비밀번호 변경 — { currentPassword, newPassword }
export const changePassword = (data) =>
  axiosInstance.patch('/auth/pwupdate', data);

// 계정 탈퇴 (body 없음)
export const deleteAccount = () => axiosInstance.delete('/auth/delete');
