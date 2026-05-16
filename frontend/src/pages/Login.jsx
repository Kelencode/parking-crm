import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { login, getMe } from '../api/auth';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { setUser } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await login(email, password);
      localStorage.setItem('token', data.access_token);
      const me = await getMe();
      setUser(me.data);
      navigate('/dashboard', { replace: true });
    } catch {
      setError('Неверный email или пароль');
      setPassword('');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo">
          <svg width="28" height="28" viewBox="0 0 100 100">
            <rect width="100" height="100" rx="18" fill="#2563eb"/>
            <text x="50" y="72" textAnchor="middle" fontFamily="Arial" fontSize="62" fontWeight="bold" fill="white">P</text>
          </svg>
          Parking CRM
        </div>

        {error && <div className="login-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Email</label>
            <input
              type="email"
              className="form-ctrl"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="admin@parking.ru"
              required
            />
          </div>
          <div className="form-group">
            <label className="form-label">Пароль</label>
            <input
              type="password"
              className="form-ctrl"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>
          <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={loading}>
            {loading ? 'Вход...' : 'Войти'}
          </button>
        </form>
      </div>
    </div>
  );
}
