import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import PrivateRoute from './components/PrivateRoute';
import Layout from './components/Layout';
import ChangePassword from './components/ChangePassword';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Incidents from './pages/Incidents';
import NewIncident from './pages/NewIncident';
import History from './pages/History';
import AuditLog from './pages/AuditLog';
import Users from './pages/Users';
import ParkingLots from './pages/ParkingLots';
import Reports from './pages/Reports';
import Journal from './pages/Journal';

function AppShell() {
  const { user } = useAuth();
  return (
    <div className="app-layout">
      <Layout />
      <main className="main-content">
        <Routes>
          <Route path="dashboard"    element={<Dashboard />} />
          <Route path="incidents"    element={<Incidents />} />
          <Route path="new-incident" element={
            <PrivateRoute allowedRoles={['dispatcher', 'admin']}>
              <NewIncident />
            </PrivateRoute>
          } />
          <Route path="journal" element={
            <PrivateRoute allowedRoles={['dispatcher', 'admin', 'tech']}>
              <Journal />
            </PrivateRoute>
          } />
          <Route path="history" element={<History />} />
          <Route path="audit-log" element={
            <PrivateRoute allowedRoles={['admin']}>
              <AuditLog />
            </PrivateRoute>
          } />
          <Route path="users" element={
            <PrivateRoute allowedRoles={['admin']}>
              <Users />
            </PrivateRoute>
          } />
          <Route path="parking-lots" element={<ParkingLots />} />
          <Route path="reports" element={
            <PrivateRoute allowedRoles={['dispatcher', 'admin']}>
              <Reports />
            </PrivateRoute>
          } />
          <Route path="*" element={<Navigate to="dashboard" replace />} />
        </Routes>
      </main>
      {user?.must_change_password && <ChangePassword />}
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<PrivateRoute><AppShell /></PrivateRoute>}>
            <Route index element={<Navigate to="dashboard" replace />} />
          </Route>
          <Route path="/*" element={
            <PrivateRoute>
              <AppShell />
            </PrivateRoute>
          } />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
    </ThemeProvider>
  );
}
