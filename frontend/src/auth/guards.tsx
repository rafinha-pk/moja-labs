import { Navigate, Outlet } from 'react-router-dom';
import { Loading } from '../components/Loading';
import { useAuth } from './AuthContext';

export function RequireAuth() {
  const { user, loading } = useAuth();
  if (loading) return <Loading />;
  return user ? <Outlet /> : <Navigate to="/login" replace />;
}

export function GuestOnly() {
  const { user, loading } = useAuth();
  if (loading) return <Loading />;
  return user ? <Navigate to="/" replace /> : <Outlet />;
}

export function RequireSuperadmin() {
  const { user } = useAuth();
  return user?.is_superadmin ? <Outlet /> : <Navigate to="/" replace />;
}
