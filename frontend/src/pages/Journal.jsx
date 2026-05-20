import { useEffect, useState, useCallback, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  getJournal, createJournalEntry, updateJournalEntry,
  deleteJournalEntry, downloadJournalReport,
} from '../api/journal';
import { getParkingLots } from '../api/parkingLots';
import { subscribe as wsSubscribe } from '../api/websocket';

const REASONS = [
  'Инвалид', 'Сотрудник ГЦУП', 'Ручное открытие (сбой)',
  'Скорая помощь', 'Полиция', 'Другое',
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function localDateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function getMoscowTime() {
  const now = new Date();
  const moscowOffset = 3 * 60;
  const localOffset = now.getTimezoneOffset();
  const mt = new Date(now.getTime() + (moscowOffset + localOffset) * 60000);
  return `${String(mt.getHours()).padStart(2,'0')}:${String(mt.getMinutes()).padStart(2,'0')}`;
}
function toMoscowISOString(d) {
  const moscowOffset = 3 * 60;
  const localOffset = d.getTimezoneOffset();
  const mt = new Date(d.getTime() + (moscowOffset + localOffset) * 60000);
  return mt.toISOString().slice(0, 16);
}
function buildDatetime(dateStr, timeStr) {
  return `${dateStr}T${timeStr}:00+03:00`;
}
function moscowTimeFromISO(isoStr) {
  const d = new Date(isoStr);
  const mt = new Date(d.getTime() + (3 * 60 + d.getTimezoneOffset()) * 60000);
  return `${String(mt.getHours()).padStart(2,'0')}:${String(mt.getMinutes()).padStart(2,'0')}`;
}
function emptyDraft() {
  return { time: getMoscowTime(), parking_lot_id: '', operation: 'въезд', grz: '', reason: REASONS[0], note: '', ticket_number: '' };
}
function entryToVals(e) {
  return {
    time: moscowTimeFromISO(e.created_at),
    parking_lot_id: String(e.parking_lot_id),
    operation: e.operation,
    grz: e.grz,
    reason: e.reason,
    note: e.note || '',
    ticket_number: e.ticket_number || '',
  };
}
function isValid(v) {
  return !!(v.parking_lot_id && v.grz.trim() && v.operation && v.reason);
}
function useWindowWidth() {
  const [w, setW] = useState(() => window.innerWidth);
  useEffect(() => {
    const h = () => setW(window.innerWidth);
    window.addEventListener('resize', h);
    return () => window.removeEventListener('resize', h);
  }, []);
  return w;
}

// ── OpToggle ──────────────────────────────────────────────────────────────────

function OpToggle({ value, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 3 }}>
      {['въезд', 'выезд'].map(op => (
        <button key={op} type="button"
          style={{
            padding: '2px 8px', fontSize: 11, borderRadius: 4, cursor: 'pointer',
            border: '1px solid var(--c-border)',
            background: value === op ? (op === 'въезд' ? '#1d4ed8' : '#15803d') : 'transparent',
            color: value === op ? '#fff' : 'var(--c-muted)',
            fontWeight: value === op ? 600 : 400,
          }}
          onClick={() => onChange(op)}>
          {op === 'въезд' ? '↓' : '↑'} {op.charAt(0).toUpperCase() + op.slice(1)}
        </button>
      ))}
    </div>
  );
}

// ── EditableRow — shared between draft and edit-existing ─────────────────────

function EditableRow({ vals, onChange, onSave, onCancel, onDelete, onBlurRow,
  lots, grzListId, isNew, saving, hasError, isAdmin, creatorName, grzRef, rowId, onLastTab }) {
  const activeLots = lots.filter(l => l.is_active !== false);
  const rowClass = hasError ? 'row-error' : 'row-editing';

  const [parkingText, setParkingText] = useState('');

  // Sync display text when parking_lot_id or lots change (e.g. copyToDraft, initial load)
  useEffect(() => {
    const name = lots.find(l => String(l.id) === String(vals.parking_lot_id))?.name ?? '';
    setParkingText(name);
  }, [vals.parking_lot_id, lots]);

  function handleParkingChange(e) {
    const name = e.target.value;
    setParkingText(name);
    const found = activeLots.find(l => l.name.trim() === name.trim());
    onChange('parking_lot_id', found ? String(found.id) : '');
  }

  function kd(e) {
    if (e.key === 'Enter') { e.preventDefault(); onSave(); }
    if (e.key === 'Escape') { onCancel(); }
  }

  function kdLast(e) {
    if (e.key === 'Enter') { e.preventDefault(); onSave(); }
    if (e.key === 'Escape') { onCancel(); }
    if (e.key === 'Tab' && !e.shiftKey && onLastTab) { e.preventDefault(); onLastTab(); }
  }

  return (
    <tr id={rowId} className={rowClass} onBlur={onBlurRow}>
      {/* Время */}
      <td style={{ minWidth: 82 }}>
        <input type="time" className="cell-inp" value={vals.time}
          onChange={e => onChange('time', e.target.value)} onKeyDown={kd} />
      </td>
      {/* Стоянка — combobox */}
      <td style={{ minWidth: 150 }}>
        <input
          list="parking-lots-datalist"
          className="cell-inp"
          value={parkingText}
          onChange={handleParkingChange}
          onKeyDown={kd}
          placeholder="Введите или выберите..."
        />
      </td>
      {/* Операция — toggle buttons */}
      <td style={{ minWidth: 148 }}>
        <OpToggle value={vals.operation} onChange={v => onChange('operation', v)} />
      </td>
      {/* ГРЗ */}
      <td style={{ minWidth: 106 }}>
        <input className="cell-inp" ref={grzRef} value={vals.grz} maxLength={20}
          list={grzListId} placeholder="А123БВ78"
          style={{ fontFamily: 'monospace', fontWeight: 600, textTransform: 'uppercase' }}
          onChange={e => onChange('grz', e.target.value.toUpperCase())} onKeyDown={kd} />
      </td>
      {/* Основание — select */}
      <td style={{ minWidth: 168 }}>
        <select className="cell-sel" value={vals.reason}
          onChange={e => onChange('reason', e.target.value)} onKeyDown={kd}>
          {REASONS.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
      </td>
      {/* Примечание */}
      <td style={{ minWidth: 120 }}>
        <input className="cell-inp" value={vals.note} maxLength={300}
          placeholder="—" onChange={e => onChange('note', e.target.value)} onKeyDown={kd} />
      </td>
      {/* Билет */}
      <td style={{ minWidth: 82 }}>
        <input className="cell-inp" value={vals.ticket_number} maxLength={20}
          placeholder="—" onChange={e => onChange('ticket_number', e.target.value)} onKeyDown={kdLast} />
      </td>
      {/* Кто внёс */}
      <td style={{ fontSize: 12, color: 'var(--c-muted)', whiteSpace: 'nowrap' }}>
        {creatorName}
      </td>
      {/* Действия */}
      <td>
        <div style={{ display: 'flex', gap: 4 }}>
          <button type="button" className="btn btn-sm btn-primary"
            style={{ padding: '2px 8px', minHeight: 0 }}
            onClick={onSave} disabled={saving}>
            {saving ? '…' : '✓'}
          </button>
          <button type="button" className="btn btn-sm btn-secondary"
            style={{ padding: '2px 8px', minHeight: 0 }}
            onClick={onCancel}>✕</button>
          {!isNew && isAdmin && onDelete && (
            <button type="button" className="btn btn-sm btn-danger"
              style={{ padding: '2px 8px', minHeight: 0 }}
              onClick={onDelete}>🗑</button>
          )}
        </div>
      </td>
    </tr>
  );
}

// ── Mobile modal ──────────────────────────────────────────────────────────────

function AddEntryModal({ lots, prefill, onClose, onSaved }) {
  const activeLots = lots.filter(l => l.is_active !== false);
  const [form, setForm] = useState({
    parking_lot_id: prefill?.parking_lot_id ?? '',
    operation: prefill?.operation ?? 'въезд',
    grz: '',
    reason: prefill?.reason ?? REASONS[0],
    note: prefill?.note ?? '',
    ticket_number: prefill?.ticket_number ?? '',
    created_at: toMoscowISOString(new Date()),
  });
  const [parkingText, setParkingText] = useState(
    () => activeLots.find(l => String(l.id) === String(prefill?.parking_lot_id ?? ''))?.name ?? ''
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.parking_lot_id) { setError('Выберите стоянку'); return; }
    if (!form.grz.trim()) { setError('Введите ГРЗ'); return; }
    setError('');
    setBusy(true);
    try {
      await createJournalEntry({
        parking_lot_id: Number(form.parking_lot_id),
        operation: form.operation,
        grz: form.grz.trim().toUpperCase(),
        reason: form.reason,
        note: form.note.trim() || null,
        ticket_number: form.ticket_number.trim() || null,
        created_at: `${form.created_at}:00+03:00`,
      });
      onSaved();
    } catch (err) {
      setError(err.response?.data?.detail ?? 'Ошибка при сохранении');
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
            <input className="form-ctrl" list="modal-parking-datalist"
              value={parkingText}
              onChange={e => {
                const name = e.target.value;
                setParkingText(name);
                const found = activeLots.find(l => l.name.trim() === name.trim());
                set('parking_lot_id', found ? String(found.id) : '');
              }}
              placeholder="Введите или выберите..." required />
            <datalist id="modal-parking-datalist">
              {activeLots.map(l => <option key={l.id} value={l.name} />)}
            </datalist>
          </div>
          <div className="form-group">
            <label className="form-label">Операция *</label>
            <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
              {['въезд', 'выезд'].map(op => (
                <label key={op} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 14 }}>
                  <input type="radio" name="operation" value={op}
                    checked={form.operation === op} onChange={() => set('operation', op)} />
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
              max={toMoscowISOString(new Date())}
              onChange={e => set('created_at', e.target.value)} required />
          </div>
          <div className="form-group">
            <label className="form-label">Номер билета</label>
            <input className="form-ctrl" value={form.ticket_number} maxLength={20}
              onChange={e => set('ticket_number', e.target.value)} placeholder="необязательно" />
          </div>
          <div className="form-group">
            <label className="form-label">Примечание</label>
            <textarea className="form-ctrl" value={form.note} maxLength={300}
              rows={2} onChange={e => set('note', e.target.value)} placeholder="необязательно" />
          </div>
          {error && <div style={{ fontSize: 13, color: '#f87171', marginBottom: 10 }}>{error}</div>}
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={busy}>Отмена</button>
            <button type="submit" className="btn btn-primary" disabled={busy}>
              {busy ? 'Сохранение...' : 'Добавить'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function Journal() {
  const { user } = useAuth();
  const canEdit = user?.role === 'dispatcher' || user?.role === 'admin';
  const isAdmin = user?.role === 'admin';
  const width = useWindowWidth();
  const isMobile = width < 768;

  const [selectedDate, setSelectedDate] = useState(new Date());
  const [entries, setEntries]   = useState([]);
  const [lots, setLots]         = useState([]);
  const [loading, setLoading]   = useState(true);
  const [filterLotId, setFilterLotId] = useState('');
  const [toast, setToast]       = useState('');
  const [dlBusy, setDlBusy]     = useState(false);

  // Desktop: editing existing row
  const [editingId, setEditingId]   = useState(null);
  const [editVals, setEditVals]     = useState(emptyDraft());
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError]   = useState(false);

  // Desktop: draft (new row at bottom)
  const [draft, setDraft]           = useState(emptyDraft());
  const [draftSaving, setDraftSaving] = useState(false);
  const [draftError, setDraftError] = useState(false);

  // Mobile modal
  const [showModal, setShowModal]   = useState(false);
  const [prefill, setPrefill]       = useState(null);

  const draftGrzRef = useRef(null);
  const draftRef    = useRef(draft);
  useEffect(() => { draftRef.current = draft; }, [draft]);

  const todayStr = localDateStr(new Date());
  const dateStr  = localDateStr(selectedDate);
  const isToday  = dateStr === todayStr;

  const activeLots = lots.filter(l => l.is_active !== false);
  const grzList    = [...new Set(entries.map(e => e.grz))];
  const displayed  = filterLotId
    ? entries.filter(e => String(e.parking_lot_id) === filterLotId)
    : entries;

  // ── Load ────────────────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await getJournal({ date_from: dateStr, date_to: dateStr, limit: 500 });
      const sorted = [...r.data].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
      setEntries(sorted);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [dateStr]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { getParkingLots().then(r => setLots(r.data)).catch(console.error); }, []);

  // WS live updates from other users
  useEffect(() => {
    const unsub = wsSubscribe(msg => {
      if (msg.type === 'new_journal_entry' && msg.data.created_by !== user?.id) {
        load();
        flash('Добавлена новая запись другим пользователем');
      }
    });
    return unsub;
  }, [load, user?.id]);

  function flash(msg) {
    setToast(msg);
    setTimeout(() => setToast(''), 4000);
  }

  // ── Date nav ────────────────────────────────────────────────────────────────

  const goToPrev = () => setSelectedDate(d => {
    const n = new Date(d); n.setDate(n.getDate()-1); return n;
  });
  const goToNext = () => setSelectedDate(d => {
    const n = new Date(d); n.setDate(n.getDate()+1);
    return localDateStr(n) <= todayStr ? n : d;
  });

  // ── Draft handlers ──────────────────────────────────────────────────────────

  function updDraft(k, v) { setDraft(f => ({ ...f, [k]: v })); }

  async function saveDraft() {
    console.log('[saveDraft] draft:', { parking_lot_id: draft.parking_lot_id, operation: draft.operation, grz: draft.grz, reason: draft.reason });
    if (!isValid(draft)) { setDraftError(true); return; }
    setDraftError(false);
    setDraftSaving(true);
    try {
      await createJournalEntry({
        parking_lot_id: Number(draft.parking_lot_id),
        operation: draft.operation,
        grz: draft.grz.trim().toUpperCase(),
        reason: draft.reason,
        note: draft.note.trim() || null,
        ticket_number: draft.ticket_number.trim() || null,
        created_at: buildDatetime(dateStr, draft.time),
      });
      setDraft(emptyDraft());
      load();
    } catch (err) {
      flash(err.response?.data?.detail ?? 'Ошибка при сохранении');
    } finally {
      setDraftSaving(false);
    }
  }

  function cancelDraft() {
    setDraft(emptyDraft());
    setDraftError(false);
  }

  function handleDraftBlur() {
    setTimeout(() => {
      const activeEl = document.activeElement;
      const draftRow = document.getElementById('draft-row');
      if (draftRow && draftRow.contains(activeEl)) return;
      // Focus left the row — only reset if incomplete, NEVER save
      const d = draftRef.current;
      if (!(d.parking_lot_id && d.operation && d.grz?.trim() && d.reason)) {
        setDraft(emptyDraft());
        setDraftError(false);
      }
    }, 150);
  }

  // ── Edit existing row handlers ──────────────────────────────────────────────

  function startEdit(entry) {
    if (!canEdit) return;
    setEditingId(entry.id);
    setEditVals(entryToVals(entry));
    setEditError(false);
  }

  function updEdit(k, v) { setEditVals(f => ({ ...f, [k]: v })); }

  function cancelEdit() {
    setEditingId(null);
    setEditError(false);
  }

  async function saveEdit() {
    if (!isValid(editVals)) { setEditError(true); return; }
    setEditError(false);
    setEditSaving(true);
    try {
      await updateJournalEntry(editingId, {
        parking_lot_id: Number(editVals.parking_lot_id),
        operation: editVals.operation,
        grz: editVals.grz.trim().toUpperCase(),
        reason: editVals.reason,
        note: editVals.note.trim() || null,
        ticket_number: editVals.ticket_number.trim() || null,
        created_at: buildDatetime(dateStr, editVals.time),
      });
      setEditingId(null);
      load();
    } catch (err) {
      flash(err.response?.data?.detail ?? 'Ошибка при сохранении');
    } finally {
      setEditSaving(false);
    }
  }

  // ── Copy to draft ───────────────────────────────────────────────────────────

  function copyToDraft(entry) {
    setDraft({
      time: getMoscowTime(),
      parking_lot_id: String(entry.parking_lot_id),
      operation: entry.operation,
      grz: '',
      reason: entry.reason,
      note: entry.note || '',
      ticket_number: entry.ticket_number || '',
    });
    setDraftError(false);
    setTimeout(() => draftGrzRef.current?.focus(), 50);
  }

  // ── Delete ──────────────────────────────────────────────────────────────────

  async function handleDelete(id) {
    if (!window.confirm('Удалить запись из журнала?')) return;
    try {
      await deleteJournalEntry(id);
      setEntries(prev => prev.filter(e => e.id !== id));
      if (editingId === id) cancelEdit();
    } catch (err) {
      flash(err.response?.data?.detail ?? 'Ошибка удаления');
    }
  }

  // ── Download ────────────────────────────────────────────────────────────────

  async function handleDownload() {
    setDlBusy(true);
    try {
      const lot = activeLots.find(l => String(l.id) === filterLotId);
      await downloadJournalReport(dateStr, dateStr, filterLotId || null, lot?.name || '');
    } catch {
      flash('Ошибка при формировании отчёта');
    } finally {
      setDlBusy(false);
    }
  }

  // ── Row styles ──────────────────────────────────────────────────────────────

  const ROW_BG = { въезд: 'rgba(59,130,246,.1)', выезд: 'rgba(34,197,94,.1)' };
  const OP_BADGE = {
    въезд: { bg: '#1e3a5f', color: '#93c5fd', label: '↓ Въезд' },
    выезд: { bg: '#14532d', color: '#86efac', label: '↑ Выезд' },
  };

  // ── Desktop table ────────────────────────────────────────────────────────────

  function renderDesktop() {
    return (
      <div className="card mb-0">
        <div className="table-wrap">
          <table style={{ minWidth: 960 }}>
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
                <th></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} style={{ textAlign: 'center', padding: 32, color: 'var(--c-muted)' }}>Загрузка...</td></tr>
              ) : (
                <>
                  {displayed.map(entry => {
                    // ── Edit mode ──
                    if (editingId === entry.id) {
                      return (
                        <EditableRow
                          key={entry.id}
                          vals={editVals}
                          onChange={updEdit}
                          onSave={saveEdit}
                          onCancel={cancelEdit}
                          onDelete={isAdmin ? () => handleDelete(entry.id) : null}
                          onBlurRow={undefined}
                          lots={lots}
                          grzListId="grz-list"
                          isNew={false}
                          saving={editSaving}
                          hasError={editError}
                          isAdmin={isAdmin}
                          creatorName={entry.creator?.name ?? '—'}
                        />
                      );
                    }

                    // ── Display mode ──
                    const badge = OP_BADGE[entry.operation];
                    const tStr = moscowTimeFromISO(entry.created_at);
                    return (
                      <tr key={entry.id}
                        style={{ background: ROW_BG[entry.operation] ?? '', cursor: canEdit ? 'pointer' : 'default' }}
                        onClick={() => canEdit && startEdit(entry)}
                        title={canEdit ? 'Нажмите для редактирования' : undefined}>
                        <td className="text-sm" style={{ whiteSpace: 'nowrap' }}>{tStr}</td>
                        <td style={{ whiteSpace: 'nowrap' }}>{entry.parking_lot?.name ?? '—'}</td>
                        <td>
                          {badge && (
                            <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 7px',
                              borderRadius: 4, background: badge.bg, color: badge.color,
                              whiteSpace: 'nowrap' }}>
                              {badge.label}
                            </span>
                          )}
                        </td>
                        <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>{entry.grz}</td>
                        <td className="text-sm">{entry.reason}</td>
                        <td className="text-sm text-muted" style={{ maxWidth: 160, whiteSpace: 'normal' }}>
                          {entry.note || '—'}
                        </td>
                        <td className="text-sm text-muted">{entry.ticket_number || '—'}</td>
                        <td className="text-sm text-muted" style={{ whiteSpace: 'nowrap' }}>{entry.creator?.name ?? '—'}</td>
                        <td onClick={e => e.stopPropagation()}>
                          <div style={{ display: 'flex', gap: 4 }}>
                            <button className="btn btn-sm btn-secondary"
                              title="Скопировать строку"
                              style={{ padding: '2px 8px', minHeight: 0, fontSize: 14 }}
                              onClick={e => { e.stopPropagation(); copyToDraft(entry); }}>⎘</button>
                            {isAdmin && (
                              <button className="btn btn-sm btn-danger"
                                style={{ padding: '2px 8px', minHeight: 0 }}
                                onClick={e => { e.stopPropagation(); handleDelete(entry.id); }}>×</button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}

                  {/* ── Draft (new entry) row ── */}
                  {canEdit && (
                    <EditableRow
                      rowId="draft-row"
                      vals={draft}
                      onChange={updDraft}
                      onSave={saveDraft}
                      onCancel={cancelDraft}
                      onLastTab={saveDraft}
                      onBlurRow={handleDraftBlur}
                      lots={lots}
                      grzListId="grz-list"
                      isNew={true}
                      saving={draftSaving}
                      hasError={draftError}
                      isAdmin={false}
                      creatorName={user?.name ?? ''}
                      grzRef={draftGrzRef}
                    />
                  )}
                </>
              )}
            </tbody>
          </table>
        </div>

        {/* Datalists */}
        <datalist id="grz-list">
          {grzList.map(g => <option key={g} value={g} />)}
        </datalist>
        <datalist id="parking-lots-datalist">
          {activeLots.map(l => <option key={l.id} value={l.name} />)}
        </datalist>
      </div>
    );
  }

  // ── Mobile view ──────────────────────────────────────────────────────────────

  function renderMobile() {
    return (
      <div className="card mb-0">
        {loading ? (
          <div className="empty-state">Загрузка...</div>
        ) : displayed.length === 0 ? (
          <div className="empty-state">Записей нет</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Время</th>
                  <th>Стоянка</th>
                  <th>ГРЗ</th>
                  <th>Оп.</th>
                  {isAdmin && <th></th>}
                </tr>
              </thead>
              <tbody>
                {displayed.map(entry => {
                  const badge = OP_BADGE[entry.operation];
                  const tStr = moscowTimeFromISO(entry.created_at);
                  return (
                    <tr key={entry.id}
                      style={{ background: ROW_BG[entry.operation] ?? '', cursor: canEdit ? 'pointer' : 'default' }}
                      onClick={() => canEdit && (setPrefill({
                        parking_lot_id: entry.parking_lot_id,
                        operation: entry.operation,
                        reason: entry.reason,
                        note: entry.note || '',
                        ticket_number: entry.ticket_number || '',
                      }), setShowModal(true))}>
                      <td className="text-sm" style={{ whiteSpace: 'nowrap' }}>{tStr}</td>
                      <td className="text-sm">{entry.parking_lot?.name ?? '—'}</td>
                      <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>{entry.grz}</td>
                      <td>
                        {badge && (
                          <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 6px',
                            borderRadius: 4, background: badge.bg, color: badge.color,
                            whiteSpace: 'nowrap' }}>
                            {badge.label}
                          </span>
                        )}
                      </td>
                      {isAdmin && (
                        <td onClick={e => e.stopPropagation()}>
                          <button className="btn btn-sm btn-danger"
                            style={{ padding: '4px 8px' }}
                            onClick={e => { e.stopPropagation(); handleDelete(entry.id); }}>×</button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div>
      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', top: 16, right: 16, zIndex: 9999,
          background: '#1d4ed8', color: '#fff', padding: '10px 18px',
          borderRadius: 8, fontSize: 13, boxShadow: '0 4px 12px rgba(0,0,0,.2)',
        }}>{toast}</div>
      )}

      {/* Header */}
      <div className="page-header">
        <h1 className="page-title">
          Журнал открытий
          <span style={{ fontSize: 13, fontWeight: 400, color: 'var(--c-muted)', marginLeft: 10 }}>
            {displayed.length} {displayed.length === 1 ? 'запись' :
              displayed.length < 5 ? 'записи' : 'записей'}
          </span>
        </h1>
        <div style={{ display: 'flex', gap: 8 }}>
          {isMobile && canEdit && (
            <button className="btn btn-primary"
              onClick={() => { setPrefill(null); setShowModal(true); }}>
              + Добавить
            </button>
          )}
          <button className="btn btn-secondary" onClick={handleDownload} disabled={dlBusy}>
            {dlBusy ? 'Формирование...' : 'Скачать xlsx'}
          </button>
        </div>
      </div>

      {/* Date navigation */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        <button className="btn btn-secondary" style={{ padding: '4px 10px' }} onClick={goToPrev}>←</button>
        <input type="date" className="form-ctrl" value={dateStr} max={todayStr}
          style={{ width: 150 }}
          onChange={e => e.target.value && setSelectedDate(new Date(e.target.value + 'T00:00:00'))} />
        <button className="btn btn-secondary" style={{ padding: '4px 10px' }}
          onClick={goToNext} disabled={isToday}>→</button>
        {!isToday && (
          <button className="btn btn-secondary" style={{ fontSize: 12 }}
            onClick={() => setSelectedDate(new Date())}>Сегодня</button>
        )}
      </div>

      {/* Lot filter */}
      <div style={{ marginBottom: 12 }}>
        <select className="form-ctrl" value={filterLotId} style={{ minWidth: 200 }}
          onChange={e => setFilterLotId(e.target.value)}>
          <option value="">Все стоянки</option>
          {activeLots.map(l => <option key={l.id} value={String(l.id)}>{l.name}</option>)}
        </select>
      </div>

      {/* Main content */}
      {isMobile ? renderMobile() : renderDesktop()}

      {/* Legend (desktop only) */}
      {!isMobile && (
        <div style={{ marginTop: 10, display: 'flex', gap: 16, fontSize: 12, color: 'var(--c-muted)', flexWrap: 'wrap' }}>
          <span>
            <span style={{ display:'inline-block', width:10, height:10, borderRadius:2, marginRight:4,
              background:'rgba(59,130,246,.3)' }}/>Въезд
          </span>
          <span>
            <span style={{ display:'inline-block', width:10, height:10, borderRadius:2, marginRight:4,
              background:'rgba(34,197,94,.3)' }}/>Выезд
          </span>
          <span>
            <span style={{ display:'inline-block', width:10, height:10, borderRadius:2, marginRight:4,
              background:'rgba(234,179,8,.2)' }}/>Редактирование / новая строка
          </span>
          {canEdit && (
            <span style={{ marginLeft: 4 }}>
              Нажмите на строку для редактирования · ⎘ скопировать · Enter сохранить · Esc отмена
            </span>
          )}
        </div>
      )}

      {/* Mobile modal */}
      {showModal && (
        <AddEntryModal lots={lots} prefill={prefill}
          onClose={() => { setShowModal(false); setPrefill(null); }}
          onSaved={() => { setShowModal(false); setPrefill(null); load(); }} />
      )}
    </div>
  );
}
