import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function PrivateRoute({ allowedRoles, children }) {
  const { user, loading } = useAuth();

  if (loading) return <div className="loading">Загрузка...</div>;
  if (!user)   return <Navigate to="/login" replace />;
  if (allowedRoles && !allowedRoles.includes(user.role))
    return <Navigate to="/dashboard" replace />;

  return children ?? <Outlet />;
}
