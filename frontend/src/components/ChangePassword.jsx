import { useState } from 'react';
import { changePassword } from '../api/users';
import { useAuth } from '../context/AuthContext';

export default function ChangePassword() {
  const { setUser } = useAuth();
  const [newPassword, setNewPassword]     = useState('');
  const [confirmPassword, setConfirm]     = useState('');
  const [error, setError]                 = useState('');
  const [busy, setBusy]                   = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (newPassword.length < 6) {
      setError('Пароль должен быть не менее 6 символов');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Пароли не совпадают');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await changePassword({ new_password: newPassword });
      setUser(u => ({ ...u, must_change_password: false }));
    } catch (e) {
      setError(e.response?.data?.detail ?? 'Ошибка сохранения');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(0,0,0,0.65)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        background: 'var(--c-surface)', borderRadius: 12, padding: 32,
        width: 360, boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
      }}>
        <h2 style={{ margin: '0 0 8px', fontSize: 18 }}>Смена пароля</h2>
        <p style={{ margin: '0 0 20px', fontSize: 13, color: 'var(--c-muted)' }}>
          Администратор установил временный пароль. Придумайте новый, чтобы продолжить работу.
        </p>
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 14 }}>
            <label className="form-label">Новый пароль</label>
            <input
              className="form-input"
              type="password"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              placeholder="Не менее 6 символов"
              required
              autoFocus
            />
          </div>
          <div style={{ marginBottom: 20 }}>
            <label className="form-label">Подтверждение пароля</label>
            <input
              className="form-input"
              type="password"
              value={confirmPassword}
              onChange={e => setConfirm(e.target.value)}
              placeholder="Повторите пароль"
              required
            />
          </div>
          {error && (
            <div style={{ color: '#f87171', fontSize: 13, marginBottom: 14 }}>{error}</div>
          )}
          <button className="btn btn-primary" style={{ width: '100%' }} disabled={busy}>
            {busy ? 'Сохранение...' : 'Сохранить пароль'}
          </button>
        </form>
      </div>
    </div>
  );
}
