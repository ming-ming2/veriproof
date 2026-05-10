//import axiosInstance from './axiosInstance';

// 내 프로필 조회
//export const getProfile = () => axiosInstance.get('/me');

// 프로필 수정 (이름, 소속)
//export const updateProfile = (data) => axiosInstance.patch('/me', data);

// 비밀번호 변경
//export const changePassword = (data) => axiosInstance.post('/me/password', data);

// 계정 탈퇴
//export const deleteAccount = (data) => axiosInstance.delete('/me', { data });


// ─────────────────────────────────────────────
// MOCK: 백엔드 API 합쳐지면 상단 코드로 전체 교체
// ─────────────────────────────────────────────

// localStorage에 저장된 사용자 정보 기반 mock 프로필
const getMockProfile = () => {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    return {
        email: user.email || 'professor@example.com',
        name: user.name || '홍길동',
        affiliation: user.affiliation || '컴퓨터공학과',
    };
};

// 내 프로필 조회 (mock)
export const getProfile = () => {
    console.log('[MOCK] 프로필 조회');
    return new Promise((resolve) => {
        setTimeout(() => {
            resolve({ data: { data: getMockProfile() } });
        }, 300);
    });
    // 실제 API 연동 시:
    // import axiosInstance from './axiosInstance';
    // return axiosInstance.get('/me');
};

// 프로필 수정 (mock) - 이름/소속
export const updateProfile = (data) => {
    console.log('[MOCK] 프로필 수정', data);
    return new Promise((resolve) => {
        setTimeout(() => {
            // localStorage에 변경사항 반영해서 새로고침해도 유지되게
            const user = JSON.parse(localStorage.getItem('user') || '{}');
            const updated = { ...user, ...data };
            localStorage.setItem('user', JSON.stringify(updated));
            resolve({ data: { data: updated } });
        }, 500);
    });
    // 실제 API 연동 시:
    // return axiosInstance.patch('/me', data);
};

// 비밀번호 변경 (mock)
export const changePassword = (data) => {
    console.log('[MOCK] 비밀번호 변경', { currentPassword: '***', newPassword: '***' });
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            // 빈 값이면 실패 시뮬레이션
            if (!data.currentPassword || !data.newPassword) {
                reject({
                    response: {
                        data: { error: { message: '비밀번호를 입력해주세요.' } },
                    },
                });
                return;
            }
            resolve({ data: { success: true, message: '비밀번호가 변경되었습니다 (mock)' } });
        }, 500);
    });
    // 실제 API 연동 시:
    // return axiosInstance.post('/me/password', data);
};

// 계정 탈퇴 (mock)
export const deleteAccount = (data) => {
    console.log('[MOCK] 계정 탈퇴', { password: '***' });
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            if (!data.password) {
                reject({
                    response: {
                        data: { error: { message: '비밀번호를 입력해주세요.' } },
                    },
                });
                return;
            }
            resolve({ data: { success: true, message: '계정이 탈퇴되었습니다 (mock)' } });
        }, 500);
    });
    // 실제 API 연동 시:
    // return axiosInstance.delete('/me', { data });
};