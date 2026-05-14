import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Home from './pages/Home';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Dashboard from './pages/Dashboard';
import ExamCreate from './pages/ExamCreate';
import ExamEdit from './pages/ExamEdit';        // ← 신규
import RosterRegister from './pages/RosterRegister';
import ExamDetail from './pages/ExamDetail';

// 9번 PR 내용 (학생 플로우)
import ExamEnterCode from './pages/ExamEnterCode';
import ExamEnterStudent from './pages/ExamEnterStudent';
import ExamSession from './pages/ExamSession';
import ExamDone from './pages/ExamDone';

// 11번 PR 내용 (프로필 수정)
import ProfileEdit from './pages/ProfileEdit';  // ← 신규

// 백로그 11 (주관식 채점) 페이지
import SessionGrade from './pages/SessionGrade';

// 로그인된 사용자만 접근 가능한 라우트 보호
function PrivateRoute({ children }) {
    const token = localStorage.getItem('token');
    return token ? children : <Navigate to="/login" replace />;
}

export default function App() {
    return (
        <BrowserRouter>
            <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/login" element={<Login />} />
                <Route path="/signup" element={<Signup />} />
                <Route
                    path="/dashboard"
                    element={
                        <PrivateRoute>
                            <Dashboard />
                        </PrivateRoute>
                    }
                />
                <Route
                    path="/exam/create"
                    element={
                        <PrivateRoute>
                            <ExamCreate />
                        </PrivateRoute>
                    }
                />
                <Route
                    path="/exam/create/roster"
                    element={
                        <PrivateRoute>
                            <RosterRegister />
                        </PrivateRoute>
                    }
                />
                {/* 신규: 시험 수정 라우트 */}
                <Route
                    path="/exam/:id/edit"
                    element={
                        <PrivateRoute>
                            <ExamEdit />
                        </PrivateRoute>
                    }
                />
                <Route
                    path="/exam/:id"
                    element={
                        <PrivateRoute>
                            <ExamDetail />
                        </PrivateRoute>
                    }
                />
                {/* 백로그 11: 학생 답안 상세 + 주관식 채점 */}
                <Route
                    path="/exam/:examId/sessions/:sessionId"
                    element={
                        <PrivateRoute>
                            <SessionGrade />
                        </PrivateRoute>
                    }
                />

                {/* 학생 응시 플로우 (인증 불필요) */}
                <Route path="/exam" element={<ExamEnterCode />} />
                <Route path="/exam/enter" element={<ExamEnterStudent />} />
                <Route path="/exam/session" element={<ExamSession />} />
                <Route path="/exam/done" element={<ExamDone />} />

                {/* 신규: 프로필/계정 설정 라우트 */}
                <Route
                    path="/profile"
                    element={
                        <PrivateRoute>
                            <ProfileEdit />
                        </PrivateRoute>
                    }
                />
            </Routes>
        </BrowserRouter>
    );
}