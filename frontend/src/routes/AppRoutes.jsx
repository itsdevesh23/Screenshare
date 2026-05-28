import { Navigate, Route, Routes } from 'react-router-dom';
import { InspectorDashboard } from '../pages/InspectorDashboard.jsx';
import { LoginPage } from '../pages/LoginPage.jsx';
import { SbuDashboard } from '../pages/SbuDashboard.jsx';
import { useAuth } from '../services/AuthContext.jsx';

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/sbu/dashboard"
        element={
          <RequireRole role="SBU">
            <SbuDashboard />
          </RequireRole>
        }
      />
      <Route
        path="/inspector/dashboard"
        element={
          <RequireRole role="INSPECTOR">
            <InspectorDashboard />
          </RequireRole>
        }
      />
      <Route path="/" element={<HomeRedirect />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function RequireRole({ role, children }) {
  const { user, loading, isAuthenticated } = useAuth();

  if (loading) {
    return null;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (user.role !== role) {
    return <Navigate to="/" replace />;
  }

  return children;
}

function HomeRedirect() {
  const { user, loading, isAuthenticated } = useAuth();

  if (loading) {
    return null;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <Navigate to={user.role === 'SBU' ? '/sbu/dashboard' : '/inspector/dashboard'} replace />;
}

