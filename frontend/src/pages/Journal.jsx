import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { getJournal, createJournalEntry, deleteJournalEntry, downloadJournalReport } from '../api/journal';
import { getParkingLots } from '../api/parkingLots';
import { subscribe as wsSubscribe } from '../api/websocket';

const OPERATIONS = ['въезд', 'выезд'];
const REASONS = [
  'Инвалид',
  'Сотрудник ГЦУП',
  'Ручное открытие (сбой)',
  'Скорая помощь',
  'Полиция',
  'Другое',
];

function localDateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function toLocalISOString(d) {
  const offset = d.getTimezoneOffset() * 60000;
  return new Date(d - offset).toISOString().slice(0, 16);
}

function fmtDateTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('ru-RU', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

// ── Модальная форма ───────────────────────────────────────────────────────────
function AddEntryModal({ lots, prefill, onClose, onSaved }) {
  const [form, setForm] = useState({
    parking_lot_id: prefill?.parking_lot_id ?? '',
    operation:      prefill?.operation      ?? 'въезд',
    grz:            '',
    reason:         prefill?.reason         ?? REASONS[0],
    note:           prefill?.note           ?? '',
    ticket_number:  prefill?.ticket_number  ?? '',
    created_at:     toLocalISOString(new Date()),
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  function set(key, val) {
    setForm(f => ({ ...f, [key]: val }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.parking_lot_id) { setError('Выберите стоянку'); return; }
    if (!form.grz.trim()) { setError('Введите ГРЗ'); return; }
    setError('');
    setBusy(true);
    try {
      await createJournalEntry({
        parking_lot_id: Number(form.parking_lot_id),
        operation:      form.operation,
        grz:            form.grz.trim().toUpperCase(),
        reason:         form.reason,
        note:           form.note.trim() || null,
        ticket_number:  form.ticket_number.trim() || null,
        created_at:     new Date(form.created_at).toISOString(),
      });
      onSaved();
    } catch (e) {
      setError(e.response?.data?.detail ?? 'Ошибка при сохранении');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 480 }} onClick={e => e.stopPropagation()}>
        <div className="modal-title">Добавить запись</div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Стоянка *</label>
            <select className="form-ctrl" value={form.parking_lot_id}
              onChange={e => set('parking_lot_id', e.target.value)} required>
              <option value="">— выберите —</option>
              {lots.filter(l => l.is_active !== false).map(l => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Операция *</label>
            <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
              {OPERATIONS.map(op => (
                <label key={op} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 14 }}>
                  <input type="radio" name="operation" value={op}
                    checked={form.operation === op}
                    onChange={() => set('operation', op)} />
                  {op.charAt(0).toUpperCase() + op.slice(1)}
                </label>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">ГРЗ *</label>
            <input className="form-ctrl" value={form.grz} maxLength={20}
              style={{ textTransform: 'uppercase' }}
              onChange={e => set('grz', e.target.value.toUpperCase())}
              placeholder="А123БВ78" required />
          </div>

          <div className="form-group">
            <label className="form-label">Основание *</label>
            <select className="form-ctrl" value={form.reason}
              onChange={e => set('reason', e.target.value)} required>
              {REASONS.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Время *</label>
            <input type="datetime-local" className="form-ctrl" value={form.created_at}
              max={toLocalISOString(new Date())}
              onChange={e => set('created_at', e.target.value)} required />
          </div>

          <div className="form-group">
            <label className="form-label">Номер билета</label>
            <input className="form-ctrl" value={form.ticket_number} maxLength={20}
              onChange={e => set('ticket_number', e.target.value)}
              placeholder="необязательно" />
          </div>

          <div className="form-group">
            <label className="form-label">Примечание</label>
            <textarea className="form-ctrl" value={form.note} maxLength={300}
              rows={2} style={{ resize: 'vertical' }}
              onChange={e => set('note', e.target.value)}
              placeholder="необязательно" />
          </div>

          {error && (
            <div style={{ fontSize: 13, color: '#f87171', marginBottom: 10 }}>{error}</div>
          )}

          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={busy}>
              Отмена
            </button>
            <button type="submit" className="btn btn-primary" disabled={busy}>
              {busy ? 'Сохранение...' : 'Добавить'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Основная страница ─────────────────────────────────────────────────────────
export default function Journal() {
  const { user } = useAuth();
  const canEdit = user?.role === 'dispatcher' || user?.role === 'admin';
  const isAdmin = user?.role === 'admin';

  const [selectedDate, setSelectedDate] = useState(new Date());
  const [entries,  setEntries]  = useState([]);
  const [lots,     setLots]     = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [filters,  setFilters]  = useState({ lot_id: '', operation: '', reason: '' });
  const [showModal, setShowModal] = useState(false);
  const [prefill,  setPrefill]  = useState(null);
  const [toast,    setToast]    = useState('');
  const [dlBusy,   setDlBusy]   = useState(false);

  const todayStr   = localDateStr(new Date());
  const dateStr    = localDateStr(selectedDate);
  const isToday    = dateStr === todayStr;

  const goToPrev = () => {
    setSelectedDate(d => { const n = new Date(d); n.setDate(n.getDate() - 1); return n; });
  };
  const goToNext = () => {
    setSelectedDate(d => {
      const n = new Date(d); n.setDate(n.getDate() + 1);
      return localDateStr(n) <= todayStr ? n : d;
    });
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = { date_from: dateStr, date_to: dateStr };
      if (filters.lot_id)   params.parking_lot_id = filters.lot_id;
      if (filters.operation) params.operation = filters.operation;
      if (filters.reason)   params.reason = filters.reason;
      const r = await getJournal(params);
      setEntries(r.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [dateStr, filters]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    getParkingLots().then(r => setLots(r.data)).catch(console.error);
  }, []);

  // Real-time WS обновление
  useEffect(() => {
    const unsub = wsSubscribe(msg => {
      if (msg.type === 'new_journal_entry' && msg.data.created_by !== user?.id) {
        load();
        setToast('Добавлена новая запись');
        setTimeout(() => setToast(''), 4000);
      }
    });
    return unsub;
  }, [load, user?.id]);

  function handleRowClick(entry) {
    setPrefill({
      parking_lot_id: entry.parking_lot_id,
      operation:      entry.operation,
      reason:         entry.reason,
      note:           entry.note || '',
      ticket_number:  entry.ticket_number || '',
    });
    setShowModal(true);
  }

  async function handleDelete(id, e) {
    e.stopPropagation();
    if (!window.confirm('Удалить запись из журнала?')) return;
    try {
      await deleteJournalEntry(id);
      setEntries(prev => prev.filter(e => e.id !== id));
    } catch (err) {
      alert(err.response?.data?.detail ?? 'Ошибка удаления');
    }
  }

  async function handleDownload() {
    setDlBusy(true);
    try {
      const lotObj = lots.find(l => String(l.id) === filters.lot_id);
      await downloadJournalReport(dateStr, dateStr, filters.lot_id || null, lotObj?.name || '');
    } catch {
      alert('Ошибка при формировании отчёта');
    } finally {
      setDlBusy(false);
    }
  }

  const ROW_BG = { 'въезд': '#eff6ff', 'выезд': '#f0fdf4' };

  return (
    <div>
      {/* ── Toast ── */}
      {toast && (
        <div style={{
          position: 'fixed', top: 16, right: 16, zIndex: 9999,
          background: '#1d4ed8', color: '#fff', padding: '10px 18px',
          borderRadius: 8, fontSize: 13, boxShadow: '0 4px 12px rgba(0,0,0,.2)',
        }}>
          {toast}
        </div>
      )}

      <div className="page-header">
        <h1 className="page-title">Журнал открытий</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          {canEdit && (
            <button className="btn btn-primary"
              onClick={() => { setPrefill(null); setShowModal(true); }}>
              + Добавить запись
            </button>
          )}
          <button className="btn btn-secondary" onClick={handleDownload} disabled={dlBusy}>
            {dlBusy ? 'Формирование...' : 'Скачать xlsx'}
          </button>
        </div>
      </div>

      {/* ── Навигация по дате ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        <button className="btn btn-secondary" style={{ padding: '4px 10px' }} onClick={goToPrev}>←</button>
        <input type="date" className="form-ctrl" value={dateStr} max={todayStr}
          style={{ width: 150 }}
          onChange={e => e.target.value && setSelectedDate(new Date(e.target.value + 'T00:00:00'))} />
        <button className="btn btn-secondary" style={{ padding: '4px 10px' }}
          onClick={goToNext} disabled={isToday}>→</button>
        {!isToday && (
          <button className="btn btn-secondary" style={{ fontSize: 12 }}
            onClick={() => setSelectedDate(new Date())}>
            Сегодня
          </button>
        )}
      </div>

      {/* ── Фильтры ── */}
      <div className="filters-row" style={{ marginBottom: 12 }}>
        <select className="form-ctrl" value={filters.lot_id}
          onChange={e => setFilters(f => ({ ...f, lot_id: e.target.value }))}>
          <option value="">Все стоянки</option>
          {lots.filter(l => l.is_active !== false).map(l => (
            <option key={l.id} value={l.id}>{l.name}</option>
          ))}
        </select>
        <select className="form-ctrl" value={filters.operation}
          onChange={e => setFilters(f => ({ ...f, operation: e.target.value }))}>
          <option value="">Въезд и выезд</option>
          {OPERATIONS.map(o => <option key={o} value={o}>{o.charAt(0).toUpperCase() + o.slice(1)}</option>)}
        </select>
        <select className="form-ctrl" value={filters.reason}
          onChange={e => setFilters(f => ({ ...f, reason: e.target.value }))}>
          <option value="">Все основания</option>
          {REASONS.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
      </div>

      {/* ── Таблица ── */}
      <div className="card mb-0">
        {loading ? (
          <div className="empty-state">Загрузка...</div>
        ) : entries.length === 0 ? (
          <div className="empty-state">Записей нет</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Время</th>
                  <th>Стоянка</th>
                  <th>Операция</th>
                  <th>ГРЗ</th>
                  <th>Основание</th>
                  <th>Примечание</th>
                  <th>Билет</th>
                  <th>Кто внёс</th>
                  {isAdmin && <th></th>}
                </tr>
              </thead>
              <tbody>
                {entries.map(e => (
                  <tr key={e.id}
                    style={{ background: ROW_BG[e.operation] ?? '', cursor: canEdit ? 'pointer' : 'default' }}
                    onClick={() => canEdit && handleRowClick(e)}
                    title={canEdit ? 'Нажмите, чтобы создать похожую запись' : undefined}>
                    <td className="text-sm" style={{ whiteSpace: 'nowrap' }}>
                      {fmtDateTime(e.created_at)}
                    </td>
                    <td>{e.parking_lot?.name ?? '—'}</td>
                    <td>
                      <span style={{
                        fontSize: 11, fontWeight: 600, padding: '2px 7px', borderRadius: 4,
                        background: e.operation === 'въезд' ? '#bfdbfe' : '#bbf7d0',
                        color: e.operation === 'въезд' ? '#1e40af' : '#166534',
                      }}>
                        {e.operation === 'въезд' ? '↓ Въезд' : '↑ Выезд'}
                      </span>
                    </td>
                    <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>{e.grz}</td>
                    <td className="text-sm">{e.reason}</td>
                    <td className="text-sm text-muted" style={{ maxWidth: 160, whiteSpace: 'normal' }}>
                      {e.note || '—'}
                    </td>
                    <td className="text-sm text-muted">{e.ticket_number || '—'}</td>
                    <td className="text-sm text-muted">{e.creator?.name ?? '—'}</td>
                    {isAdmin && (
                      <td onClick={ev => ev.stopPropagation()}>
                        <button className="btn btn-sm btn-danger"
                          onClick={ev => handleDelete(e.id, ev)}>
                          ×
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Легенда ── */}
      <div style={{ marginTop: 10, display: 'flex', gap: 16, fontSize: 12, color: 'var(--c-muted)' }}>
        <span><span style={{ display: 'inline-block', width: 12, height: 12, background: '#bfdbfe', borderRadius: 2, marginRight: 4 }}></span>Въезд</span>
        <span><span style={{ display: 'inline-block', width: 12, height: 12, background: '#bbf7d0', borderRadius: 2, marginRight: 4 }}></span>Выезд</span>
        {canEdit && <span style={{ marginLeft: 8 }}>Нажмите на строку, чтобы создать похожую запись</span>}
      </div>

      {/* ── Форма ── */}
      {showModal && (
        <AddEntryModal
          lots={lots}
          prefill={prefill}
          onClose={() => { setShowModal(false); setPrefill(null); }}
          onSaved={() => { setShowModal(false); setPrefill(null); load(); }}
        />
      )}
    </div>
  );
}
