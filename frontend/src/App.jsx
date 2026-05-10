import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Home from './pages/Home';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Dashboard from './pages/Dashboard';
import ExamCreate from './pages/ExamCreate';
import ExamEdit from './pages/ExamEdit';        // ← 신규
import RosterRegister from './pages/RosterRegister';
import ExamDetail from './pages/ExamDetail';
import ProfileEdit from './pages/ProfileEdit';  // ← 신규

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
