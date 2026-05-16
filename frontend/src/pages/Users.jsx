import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { getUsers, createUser, updateUser, resetPassword } from '../api/users';

const ROLE_LABELS = { admin: 'Администратор', dispatcher: 'Диспетчер', tech: 'Техник' };
const ROLE_OPTIONS = [
  { value: 'tech',       label: 'Техник' },
  { value: 'dispatcher', label: 'Диспетчер' },
  { value: 'admin',      label: 'Администратор' },
];

function formatDate(dt) {
  if (!dt) return '—';
  return new Date(dt).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

// ─── Modal ──────────────────────────────────────────────────────────────────
function Modal({ title, onClose, children }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{
        background: 'var(--c-surface)', borderRadius: 10, padding: 28,
        width: 420, maxWidth: '95vw', boxShadow: '0 4px 24px rgba(0,0,0,0.25)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h3 style={{ margin: 0, fontSize: 16 }}>{title}</h3>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', fontSize: 20,
            cursor: 'pointer', color: 'var(--c-muted)', lineHeight: 1,
          }}>×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ─── Create / Edit form ──────────────────────────────────────────────────────
function UserForm({ initial, onSave, onClose, isSelf }) {
  const isEdit = !!initial;
  const [form, setForm] = useState({
    name:       initial?.name  ?? '',
    email:      initial?.email ?? '',
    password:   '',
    role:       initial?.role  ?? 'tech',
    is_active:  initial?.is_active ?? true,
  });
  const [error, setError] = useState('');
  const [busy,  setBusy]  = useState(false);

  function set(key, val) { setForm(f => ({ ...f, [key]: val })); }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!isEdit && form.password.length < 6) {
      setError('Пароль должен быть не менее 6 символов'); return;
    }
    setBusy(true); setError('');
    try {
      if (isEdit) {
        const patch = {};
        if (form.name      !== initial.name)      patch.name      = form.name;
        if (form.role      !== initial.role)       patch.role      = form.role;
        if (form.is_active !== initial.is_active)  patch.is_active = form.is_active;
        await updateUser(initial.id, patch);
      } else {
        await createUser({ name: form.name, email: form.email, password: form.password, role: form.role });
      }
      onSave();
    } catch (e) {
      setError(e.response?.data?.detail ?? 'Ошибка сохранения');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <div style={{ marginBottom: 14 }}>
        <label className="form-label">Имя</label>
        <input className="form-input" value={form.name} onChange={e => set('name', e.target.value)} required />
      </div>
      {!isEdit && (
        <>
          <div style={{ marginBottom: 14 }}>
            <label className="form-label">Email</label>
            <input className="form-input" type="email" value={form.email} onChange={e => set('email', e.target.value)} required />
          </div>
          <div style={{ marginBottom: 14 }}>
            <label className="form-label">Пароль (временный)</label>
            <input className="form-input" type="password" value={form.password}
              onChange={e => set('password', e.target.value)} placeholder="Не менее 6 символов" required />
          </div>
        </>
      )}
      <div style={{ marginBottom: 14 }}>
        <label className="form-label">Роль</label>
        <select className="form-input" value={form.role}
          onChange={e => set('role', e.target.value)}
          disabled={isSelf}>
          {ROLE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        {isSelf && (
          <div style={{ fontSize: 12, color: 'var(--c-muted)', marginTop: 4 }}>
            Нельзя изменить роль для своей учётной записи
          </div>
        )}
      </div>
      {isEdit && (
        <div style={{ marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10 }}>
          <input id="is_active" type="checkbox" checked={form.is_active}
            onChange={e => set('is_active', e.target.checked)} disabled={isSelf} />
          <label htmlFor="is_active" style={{ fontSize: 14, cursor: isSelf ? 'default' : 'pointer' }}>
            Активен
          </label>
          {isSelf && (
            <span style={{ fontSize: 12, color: 'var(--c-muted)' }}>
              (нельзя деактивировать себя)
            </span>
          )}
        </div>
      )}
      {error && <div style={{ color: '#f87171', fontSize: 13, marginBottom: 12 }}>{error}</div>}
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
        <button type="button" className="btn btn-secondary" onClick={onClose}>Отмена</button>
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? 'Сохранение...' : isEdit ? 'Сохранить' : 'Создать'}
        </button>
      </div>
    </form>
  );
}

// ─── Reset password form ─────────────────────────────────────────────────────
function ResetPasswordForm({ user, onSave, onClose }) {
  const [newPass, setNewPass] = useState('');
  const [error, setError]     = useState('');
  const [busy, setBusy]       = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (newPass.length < 6) { setError('Не менее 6 символов'); return; }
    setBusy(true); setError('');
    try {
      await resetPassword(user.id, { new_password: newPass });
      onSave();
    } catch (e) {
      setError(e.response?.data?.detail ?? 'Ошибка');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <p style={{ margin: '0 0 16px', fontSize: 14, color: 'var(--c-muted)' }}>
        Пользователь: <strong>{user.name}</strong> ({user.email})
      </p>
      <div style={{ marginBottom: 16 }}>
        <label className="form-label">Новый пароль</label>
        <input className="form-input" type="password" value={newPass}
          onChange={e => setNewPass(e.target.value)} placeholder="Не менее 6 символов"
          autoFocus required />
      </div>
      <p style={{ margin: '0 0 16px', fontSize: 12, color: 'var(--c-muted)' }}>
        После сброса пользователь будет обязан сменить пароль при следующем входе.
      </p>
      {error && <div style={{ color: '#f87171', fontSize: 13, marginBottom: 12 }}>{error}</div>}
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
        <button type="button" className="btn btn-secondary" onClick={onClose}>Отмена</button>
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? 'Сброс...' : 'Сбросить пароль'}
        </button>
      </div>
    </form>
  );
}

// ─── Main page ───────────────────────────────────────────────────────────────
export default function Users() {
  const { user: me } = useAuth();
  const [users,   setUsers]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal,   setModal]   = useState(null); // null | 'create' | {mode:'edit'|'reset', user}

  async function load() {
    setLoading(true);
    try {
      const r = await getUsers();
      setUsers(r.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  function closeModal() { setModal(null); }
  function onSaved()    { closeModal(); load(); }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Сотрудники</h1>
        <button className="btn btn-primary" onClick={() => setModal('create')}>
          + Добавить сотрудника
        </button>
      </div>

      {loading ? (
        <div className="loading">Загрузка...</div>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Имя</th>
                <th>Email</th>
                <th>Роль</th>
                <th>Статус</th>
                <th>Создан</th>
                <th style={{ width: 180 }}>Действия</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} style={{ opacity: u.is_active ? 1 : 0.5 }}>
                  <td>
                    {u.name}
                    {u.id === me?.id && (
                      <span style={{ fontSize: 11, color: 'var(--c-muted)', marginLeft: 6 }}>(вы)</span>
                    )}
                    {u.must_change_password && (
                      <span title="Ожидает смены пароля" style={{
                        fontSize: 10, background: '#fef3c7', color: '#92400e',
                        borderRadius: 4, padding: '1px 5px', marginLeft: 6,
                      }}>
                        врем. пароль
                      </span>
                    )}
                  </td>
                  <td style={{ fontSize: 13 }}>{u.email}</td>
                  <td>{ROLE_LABELS[u.role] ?? u.role}</td>
                  <td>
                    <span style={{
                      fontSize: 12, fontWeight: 600,
                      color: u.is_active ? '#22c55e' : '#f87171',
                    }}>
                      {u.is_active ? 'Активен' : 'Отключён'}
                    </span>
                  </td>
                  <td style={{ fontSize: 13 }}>{formatDate(u.created_at)}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        className="btn btn-secondary"
                        style={{ fontSize: 12, padding: '4px 10px' }}
                        onClick={() => setModal({ mode: 'edit', user: u })}
                      >
                        Изменить
                      </button>
                      <button
                        className="btn btn-secondary"
                        style={{ fontSize: 12, padding: '4px 10px' }}
                        onClick={() => setModal({ mode: 'reset', user: u })}
                      >
                        Пароль
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modal === 'create' && (
        <Modal title="Добавить сотрудника" onClose={closeModal}>
          <UserForm onSave={onSaved} onClose={closeModal} isSelf={false} />
        </Modal>
      )}

      {modal?.mode === 'edit' && (
        <Modal title="Редактировать сотрудника" onClose={closeModal}>
          <UserForm
            initial={modal.user}
            onSave={onSaved}
            onClose={closeModal}
            isSelf={modal.user.id === me?.id}
          />
        </Modal>
      )}

      {modal?.mode === 'reset' && (
        <Modal title="Сброс пароля" onClose={closeModal}>
          <ResetPasswordForm user={modal.user} onSave={onSaved} onClose={closeModal} />
        </Modal>
      )}
    </div>
  );
}
