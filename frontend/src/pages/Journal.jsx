import { useEffect, useState, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../context/AuthContext';
import {
  getJournal, createJournalEntry, updateJournalEntry,
  deleteJournalEntry, downloadJournalReport,
} from '../api/journal';
import { getParkingLots } from '../api/parkingLots';
import { subscribe as wsSubscribe } from '../api/websocket';

const REASONS = [
  { value: 'Без оплаты(сбой)',            label: 'Без оплаты(сбой)' },
  { value: 'Без оплаты (согласовано)',    label: 'Без оплаты (согласовано)' },
  { value: 'Ручное открытие(сбой)',       label: 'Ручное открытие(сбой)' },
  { value: 'Инвалид (перезапись)',        label: 'Инвалид (перезапись)' },
  { value: 'Инвалид (ручное)',            label: 'Инвалид (ручное)' },
  { value: 'Инвалид(не фРИ\\оплата)',    label: 'Инвалид(не фРИ\\оплата)' },
  { value: 'Сотрудник ГЦУП(перезапись)', label: 'Сотрудник ГЦУП(перезапись)' },
  { value: 'Сотрудник ГЦУП(ручное)',     label: 'Сотрудник ГЦУП(ручное)' },
  { value: 'Сотрудник ГЦУП(контролер)',  label: 'Сотрудник ГЦУП(контролер)' },
  { value: 'Спец. Техника',              label: 'Спец. Техника' },
  { value: 'Абонемент',                  label: 'Абонемент' },
  { value: 'Без карты',                  label: 'Без карты' },
  { value: 'Скорая помощь',              label: 'Скорая помощь' },
  { value: 'Оплата',                     label: 'Оплата' },
  { value: 'Электромобиль',              label: 'Электромобиль' },
  { value: 'Утеря парковочной карты',    label: 'Утеря парковочной карты' },
  { value: 'Социальное такси',           label: 'Социальное такси' },
  { value: 'Запись суточного тарифа',    label: 'Запись суточного тарифа' },
  { value: 'Курсус',                     label: 'Курсус' },
  { value: 'Полиция',                    label: 'Полиция' },
  { value: 'Замятие',                    label: 'Замятие' },
  { value: 'Сервис',                     label: 'Сервис' },
  { value: 'Обслуживание АПС',           label: 'Обслуживание АПС' },
  { value: 'Прочее',                     label: 'Прочее' },
  { value: 'КлеверПарк',                label: 'КлеверПарк' },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function localDateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function getMoscowTime() {
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const moscow = new Date(utc + 3 * 60 * 60 * 1000);
  return moscow.toTimeString().slice(0, 5);
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
  return { time: getMoscowTime(), parking_lot_id: '', operation: 'Выезд', grz: '', reason: REASONS[0].value, note: '', ticket_number: '' };
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
      {[{ val: 'Въезд', label: '↓ Въезд' }, { val: 'Выезд', label: '↑ Выезд' }].map(({ val, label }) => (
        <button key={val} type="button"
          style={{
            padding: '2px 8px', fontSize: 11, borderRadius: 4, cursor: 'pointer',
            border: '1px solid var(--c-border)',
            background: value === val ? (val === 'Въезд' ? '#1d4ed8' : '#15803d') : 'transparent',
            color: value === val ? '#fff' : 'var(--c-muted)',
            fontWeight: value === val ? 600 : 400,
          }}
          onClick={() => onChange(val)}>
          {label}
        </button>
      ))}
    </div>
  );
}

// ── ParkingCombobox ────────────────────────────────────────────────────────────

const LOT_COLOR = { 'город': '#A32D2D', 'перехват': '#185FA5' };

function ParkingCombobox({ lots, value, onChange, onKeyDown }) {
  const activeLots = lots.filter(l => l.is_active !== false);
  const [text, setText] = useState('');
  const [open, setOpen] = useState(false);
  const [dropPos, setDropPos] = useState(null);
  const inputRef = useRef(null);

  useEffect(() => {
    const name = lots.find(l => String(l.id) === String(value))?.name ?? '';
    setText(name);
  }, [value, lots]);

  const filtered = activeLots.filter(l =>
    !text.trim() || l.name.toLowerCase().includes(text.toLowerCase())
  );

  function calcPos() {
    if (!inputRef.current) return null;
    const rect = inputRef.current.getBoundingClientRect();
    return {
      top: rect.bottom + window.scrollY,
      left: rect.left + window.scrollX,
      width: Math.max(rect.width, 250),
    };
  }

  function handleFocus() {
    setDropPos(calcPos());
    setOpen(true);
  }

  function handleInput(e) {
    const name = e.target.value;
    setText(name);
    setDropPos(calcPos());
    setOpen(true);
    const found = activeLots.find(l => l.name.trim() === name.trim());
    if (found) onChange(String(found.id));
  }

  function handleBlur() {
    setTimeout(() => {
      const name = lots.find(l => String(l.id) === String(value))?.name ?? '';
      setText(name);
      setOpen(false);
    }, 150);
  }

  function selectLot(lot) {
    onChange(String(lot.id));
    setText(lot.name);
    setOpen(false);
  }

  return (
    <div style={{ minWidth: 150 }}>
      <input
        ref={inputRef}
        className="cell-inp"
        value={text}
        onChange={handleInput}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onKeyDown={onKeyDown}
        placeholder="Введите или выберите..."
        autoComplete="off"
        style={{ width: '100%' }}
      />
      {open && dropPos && filtered.length > 0 && createPortal(
        <div
          onMouseDown={e => e.preventDefault()}
          style={{
            position: 'absolute',
            top: dropPos.top + 2,
            left: dropPos.left,
            width: dropPos.width,
            zIndex: 99999,
            background: 'var(--c-surface)',
            border: '1px solid var(--c-border)',
            borderRadius: 6,
            maxHeight: 200,
            overflowY: 'auto',
            boxShadow: '0 4px 16px rgba(0,0,0,.4)',
          }}
        >
          {filtered.map(lot => (
            <div key={lot.id}
              onMouseDown={() => selectLot(lot)}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,.07)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
              style={{
                padding: '7px 12px',
                cursor: 'pointer',
                fontSize: 13,
                color: LOT_COLOR[lot.lot_type] ?? 'var(--c-text)',
              }}>
              {lot.name}
            </div>
          ))}
        </div>,
        document.body
      )}
    </div>
  );
}

// ── EditableRow — shared between draft and edit-existing ─────────────────────

function EditableRow({ vals, onChange, onSave, onCancel, onDelete, onBlurRow,
  lots, grzListId, isNew, saving, hasError, isAdmin, creatorName, grzRef, rowId, onLastTab }) {
  const rowClass = hasError ? 'row-error' : 'row-editing';

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
      {/* Стоянка — custom combobox */}
      <td style={{ minWidth: 150 }}>
        <ParkingCombobox
          lots={lots}
          value={vals.parking_lot_id}
          onChange={id => onChange('parking_lot_id', id)}
          onKeyDown={kd}
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
          {REASONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
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
    operation: prefill?.operation ?? 'Выезд',
    grz: '',
    reason: prefill?.reason ?? REASONS[0].value,
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
              {[{ val: 'Въезд', label: 'Въезд' }, { val: 'Выезд', label: 'Выезд' }].map(({ val, label }) => (
                <label key={val} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 14 }}>
                  <input type="radio" name="operation" value={val}
                    checked={form.operation === val} onChange={() => set('operation', val)} />
                  {label}
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
              {REASONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
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

  // Copy-flash state
  const [copiedId, setCopiedId]     = useState(null);

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
    const payload = {
      parking_lot_id: parseInt(draft.parking_lot_id, 10),
      operation: draft.operation,
      grz: draft.grz.trim().toUpperCase(),
      reason: draft.reason,
      created_at: buildDatetime(dateStr, draft.time),
    };
    console.log('[saveDraft] payload:', payload);
    if (!isValid(draft)) { setDraftError(true); return; }
    setDraftError(false);
    setDraftSaving(true);
    try {
      await createJournalEntry({
        ...payload,
        note: draft.note.trim() || null,
        ticket_number: draft.ticket_number.trim() || null,
      });
      setDraft(emptyDraft());
      load();
    } catch (err) {
      console.error('[saveDraft error]', err.response?.data ?? err.message);
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
      const active = document.activeElement;
      const row = document.getElementById('draft-row');
      const portal = document.querySelector('.parking-dropdown');
      if (row?.contains(active)) return;
      if (portal?.contains(active)) return;
      const d = draftRef.current;
      const valid = d.parking_lot_id && d.operation && d.grz?.trim() && d.reason;
      if (!valid) {
        setDraft(emptyDraft());
        setDraftError(false);
      }
    }, 300);
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
      grz: entry.grz,
      reason: entry.reason,
      note: entry.note || '',
      ticket_number: entry.ticket_number || '',
    });
    setDraftError(false);
    setCopiedId(entry.id);
    setTimeout(() => setCopiedId(null), 1000);
    setTimeout(() => {
      document.getElementById('draft-row')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      draftGrzRef.current?.focus();
    }, 50);
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

  const OP_BADGE = {
    'Въезд': { bg: '#1e3a5f', color: '#93c5fd', label: '↓ Въезд' },
    'Выезд': { bg: '#14532d', color: '#86efac', label: '↑ Выезд' },
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
                        style={{ cursor: canEdit ? 'pointer' : 'default' }}
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
                              style={{
                                padding: '2px 8px', minHeight: 0, fontSize: 14,
                                ...(copiedId === entry.id ? { background: '#15803d', color: '#fff', borderColor: '#15803d' } : {}),
                              }}
                              onClick={e => { e.stopPropagation(); copyToDraft(entry); }}>
                              {copiedId === entry.id ? '✓' : '⎘'}
                            </button>
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

        {/* GRZ autocomplete datalist */}
        <datalist id="grz-list">
          {grzList.map(g => <option key={g} value={g} />)}
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
                      style={{ cursor: canEdit ? 'pointer' : 'default' }}
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
          Электронный журнал
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
