import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { getParkingLots, updateParkingLot } from '../api/parkingLots';

const LOT_TYPE_LABELS = { 'город': 'Городская', 'перехват': 'Перехватывающая' };
const SOFTWARE_LABELS = { 'курсус': 'Курсус', 'птп': 'ПТП', 'интерво': 'Интерво' };

// ─── Modal ───────────────────────────────────────────────────────────────────
function Modal({ title, onClose, children }) {
  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div style={{
        background: 'var(--c-surface)', borderRadius: 10, padding: 28,
        width: 440, maxWidth: '95vw', boxShadow: '0 4px 24px rgba(0,0,0,0.25)',
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

// ─── Config form ─────────────────────────────────────────────────────────────
function ConfigForm({ lot, onSave, onClose }) {
  const [form, setForm] = useState({
    is_active: lot.is_active ?? true,
    notes:     lot.notes ?? '',
  });
  const [error, setError] = useState('');
  const [busy,  setBusy]  = useState(false);

  function set(key, val) { setForm(f => ({ ...f, [key]: val })); }

  async function handleSubmit(e) {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      await updateParkingLot(lot.id, {
        is_active: form.is_active,
        notes:     form.notes || null,
      });
      onSave();
    } catch (e) {
      setError(e.response?.data?.detail ?? 'Ошибка сохранения');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <p style={{ margin: '0 0 16px', fontSize: 13, color: 'var(--c-muted)' }}>
        {lot.name}
        {lot.lot_type && ` · ${LOT_TYPE_LABELS[lot.lot_type] ?? lot.lot_type}`}
        {lot.software && ` · ${SOFTWARE_LABELS[lot.software] ?? lot.software}`}
      </p>

      <div style={{ marginBottom: 14, display: 'flex', alignItems: 'center', gap: 10 }}>
        <input
          id="is_active"
          type="checkbox"
          checked={form.is_active}
          onChange={e => set('is_active', e.target.checked)}
        />
        <label htmlFor="is_active" style={{ fontSize: 14, cursor: 'pointer' }}>
          Стоянка активна
        </label>
        {!form.is_active && (
          <span style={{ fontSize: 11, color: '#f87171' }}>
            — не будет появляться при создании заявки
          </span>
        )}
      </div>

      <div style={{ marginBottom: 20 }}>
        <label className="form-label" style={{ display: 'block', marginBottom: 6 }}>Заметки</label>
        <textarea
          className="form-input"
          rows={3}
          value={form.notes}
          onChange={e => set('notes', e.target.value)}
          placeholder="Например: Только абонементы, Закрыта на ремонт..."
          style={{ display: 'block', width: '100%', minHeight: 80, resize: 'vertical', boxSizing: 'border-box' }}
        />
      </div>

      {error && <div style={{ color: '#f87171', fontSize: 13, marginBottom: 12 }}>{error}</div>}
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
        <button type="button" className="btn btn-secondary" onClick={onClose}>Отмена</button>
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? 'Сохранение...' : 'Сохранить'}
        </button>
      </div>
    </form>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function ParkingLots() {
  const { user } = useAuth();
  const canEdit = user?.role === 'admin' || user?.role === 'dispatcher';

  const [lots,    setLots]    = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [showInactive, setShowInactive] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const r = await getParkingLots();
      setLots(r.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const visible = showInactive ? lots : lots.filter(l => l.is_active !== false);
  const inactiveCount = lots.filter(l => l.is_active === false).length;

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Стоянки</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {inactiveCount > 0 && (
            <label style={{ fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
              <input
                type="checkbox"
                checked={showInactive}
                onChange={e => setShowInactive(e.target.checked)}
              />
              Показать закрытые ({inactiveCount})
            </label>
          )}
          <span style={{ fontSize: 13, color: 'var(--c-muted)' }}>
            {visible.length} из {lots.length}
          </span>
        </div>
      </div>

      {loading ? (
        <div className="loading">Загрузка...</div>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Название</th>
                <th>Тип</th>
                <th>Программа</th>
                <th>Статус</th>
                {canEdit && <th style={{ width: 100 }}>Действия</th>}
              </tr>
            </thead>
            <tbody>
              {visible.map(l => (
                <tr key={l.id} style={{ opacity: l.is_active !== false ? 1 : 0.5 }}>
                  <td>
                    <div style={{ fontWeight: 500 }}>{l.name}</div>
                    {l.notes && (
                      <div style={{ fontSize: 11, color: 'var(--c-muted)', marginTop: 2 }}>
                        {l.notes}
                      </div>
                    )}
                  </td>
                  <td style={{ fontSize: 13 }}>
                    {LOT_TYPE_LABELS[l.lot_type] ?? l.lot_type ?? '—'}
                  </td>
                  <td style={{ fontSize: 13 }}>
                    {SOFTWARE_LABELS[l.software] ?? l.software ?? '—'}
                  </td>
                  <td>
                    {l.is_active !== false ? (
                      <span style={{ fontSize: 12, color: '#22c55e', fontWeight: 600 }}>Активна</span>
                    ) : (
                      <span style={{ fontSize: 12, color: '#f87171', fontWeight: 600 }}>Закрыта</span>
                    )}
                  </td>
                  {canEdit && (
                    <td>
                      <button
                        className="btn btn-secondary"
                        style={{ fontSize: 12, padding: '4px 10px' }}
                        onClick={() => setEditing(l)}
                      >
                        Настроить
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <Modal title="Настройка стоянки" onClose={() => setEditing(null)}>
          <ConfigForm
            lot={editing}
            onSave={() => { setEditing(null); load(); }}
            onClose={() => setEditing(null)}
          />
        </Modal>
      )}
    </div>
  );
}
