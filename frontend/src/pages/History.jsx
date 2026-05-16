import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { getIncidents } from '../api/incidents';
import { getParkingLots } from '../api/parkingLots';
import { getNotes as getShiftNotes, createNote as createShiftNote } from '../api/shiftNotes';
import { getSnapshots } from '../api/snapshots';
import PriorityBadge from '../components/PriorityBadge';
import StatusBadge from '../components/StatusBadge';

const PRIORITY_ORDER = { critical: 0, high: 1, medium: 2, low: 3 };
const MONTHS_RU = ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];
const DAYS_RU   = ['Воскресенье','Понедельник','Вторник','Среда','Четверг','Пятница','Суббота'];

function localDateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function formatDate(str) {
  const d = new Date(str + 'T00:00:00');
  return `${d.getDate()} ${MONTHS_RU[d.getMonth()]} ${d.getFullYear()}, ${DAYS_RU[d.getDay()]}`;
}

function fmtTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}

// ─── Snapshot card ────────────────────────────────────────────────────────────
function SnapCard({ label, snap }) {
  const incidents = snap ? JSON.parse(snap.incidents_json) : [];
  const sorted    = [...incidents].sort((a, b) =>
    (PRIORITY_ORDER[a.priority] ?? 99) - (PRIORITY_ORDER[b.priority] ?? 99)
  );
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 600 }}>{label}</span>
        {snap ? (
          <span style={{ fontSize: 11, color: 'var(--c-muted)' }}>
            {snap.is_auto ? 'Авто' : 'Вручную'} · {snap.creator?.name ?? 'Система'} · {fmtTime(snap.snapshot_time)}
          </span>
        ) : (
          <span style={{ fontSize: 12, color: 'var(--c-muted)' }}>Данные не зафиксированы</span>
        )}
      </div>
      {snap && (
        sorted.length === 0
          ? <div style={{ fontSize: 12, color: 'var(--c-muted)', marginBottom: 8 }}>Активных заявок не было</div>
          : (
            <div className="table-wrap" style={{ marginBottom: 8 }}>
              <table className="table">
                <tbody>
                  {sorted.map(inc => (
                    <tr key={inc.id}>
                      <td style={{ fontSize: 12, color: 'var(--c-muted)', width: 36 }}>#{inc.id}</td>
                      <td style={{ fontSize: 13 }}>{inc.parking_lot?.name ?? inc.parking_lot ?? '—'}</td>
                      <td style={{ fontSize: 12, maxWidth: 150, whiteSpace: 'normal' }}>{inc.type}</td>
                      <td><PriorityBadge priority={inc.priority} /></td>
                      <td><StatusBadge status={inc.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
      )}
    </div>
  );
}

// ─── Incident table (Block 2) ─────────────────────────────────────────────────
function IncidentTable({ incidents, lotFilter, timeKey, emptyMsg }) {
  const filtered = lotFilter
    ? incidents.filter(i => String(i.parking_lot_id) === lotFilter)
    : incidents;

  if (!filtered.length) {
    return <div style={{ fontSize: 13, color: 'var(--c-muted)', padding: '12px 0' }}>{emptyMsg}</div>;
  }
  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            <th>Стоянка</th>
            <th>Тип</th>
            <th>Описание</th>
            <th>Приоритет</th>
            <th>Статус</th>
            <th>Время</th>
            <th>Исполнитель</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map(inc => (
            <tr key={inc.id}>
              <td style={{ fontSize: 13 }}>{inc.parking_lot?.name ?? '—'}</td>
              <td style={{ fontSize: 12, whiteSpace: 'normal', maxWidth: 150 }}>{inc.type}</td>
              <td style={{ fontSize: 12, whiteSpace: 'normal', maxWidth: 180, color: 'var(--c-muted)' }}>
                {inc.description || '—'}
              </td>
              <td><PriorityBadge priority={inc.priority} /></td>
              <td><StatusBadge status={inc.status} /></td>
              <td style={{ fontSize: 12, color: 'var(--c-muted)', whiteSpace: 'nowrap' }}>
                {fmtTime(timeKey === 'closed_at' ? inc.closed_at : inc.created_at)}
              </td>
              <td style={{ fontSize: 12 }}>{inc.assignee?.name ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function History() {
  const { user } = useAuth();
  const canEdit = user?.role === 'admin' || user?.role === 'dispatcher';

  const [selectedDate, setSelectedDate] = useState(new Date());

  const todayStr = localDateStr(new Date());
  const dateStr  = localDateStr(selectedDate);
  const isToday  = dateStr === todayStr;

  const [lots,      setLots]      = useState([]);
  const [snapshots, setSnapshots] = useState([]);
  const [openedInc, setOpenedInc] = useState([]);
  const [closedInc, setClosedInc] = useState([]);
  const [liveInc,   setLiveInc]   = useState([]);
  const [dayNotes,  setDayNotes]  = useState([]);
  const [activeTab, setActiveTab] = useState('opened');
  const [lotFilter, setLotFilter] = useState('');
  const [loading,   setLoading]   = useState(false);
  const [noteText,  setNoteText]  = useState('');
  const [noteBusy,  setNoteBusy]  = useState(false);

  const goToPrevDay = () => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() - 1);
    setSelectedDate(d);
  };
  const goToNextDay = () => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + 1);
    if (localDateStr(d) <= todayStr) setSelectedDate(d);
  };

  async function loadPage(date) {
    setLoading(true);
    try {
      const isT = date === todayStr;
      const [snapsR, openedR, closedR, notesR, lotsR] = await Promise.all([
        getSnapshots(date),
        getIncidents({ created_date: date, limit: 200 }),
        getIncidents({ closed_date: date, limit: 200 }),
        getShiftNotes({ date }),
        getParkingLots(),
      ]);
      setSnapshots(snapsR.data);
      setOpenedInc(openedR.data);
      setClosedInc(closedR.data);
      setDayNotes(notesR.data);
      setLots(lotsR.data);

      if (isT) {
        const liveR = await getIncidents({ status: ['new', 'assigned', 'in_progress'], limit: 100 });
        setLiveInc(liveR.data);
      } else {
        setLiveInc([]);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadPage(dateStr); }, [dateStr]);

  async function handleAddNote(e) {
    e.preventDefault();
    if (!noteText.trim()) return;
    setNoteBusy(true);
    try {
      await createShiftNote({ text: noteText.trim() });
      setNoteText('');
      const r = await getShiftNotes({ date: dateStr });
      setDayNotes(r.data);
    } catch (err) {
      console.error(err);
    } finally {
      setNoteBusy(false);
    }
  }

  const daySnap   = snapshots.find(s => s.shift_type === 'day');
  const nightSnap = snapshots.find(s => s.shift_type === 'night');

  function tabStyle(tab) {
    const active = activeTab === tab;
    return {
      padding: '6px 16px', cursor: 'pointer', fontSize: 13,
      fontWeight: active ? 600 : 400,
      background: 'none', border: 'none',
      borderBottom: active ? '2px solid #2563eb' : '2px solid transparent',
      color: active ? '#2563eb' : 'var(--c-muted)',
    };
  }

  return (
    <div>
      {/* ── Date navigation ──────────────────────────────────────── */}
      <div className="page-header" style={{ flexWrap: 'wrap', gap: 12 }}>
        <h1 className="page-title">История</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button className="btn btn-secondary" style={{ padding: '4px 10px' }}
            onClick={goToPrevDay}>←</button>
          <button className="btn btn-secondary" style={{ fontSize: 12, padding: '4px 10px' }}
            onClick={() => setSelectedDate(new Date())} disabled={isToday}>
            Сегодня
          </button>
          <button className="btn btn-secondary" style={{ padding: '4px 10px' }}
            onClick={goToNextDay} disabled={isToday}>→</button>
          <span style={{ fontSize: 14, fontWeight: 500, margin: '0 6px' }}>
            {formatDate(dateStr)}
          </span>
          <input
            type="date"
            value={dateStr}
            max={todayStr}
            onChange={e => { if (e.target.value) setSelectedDate(new Date(e.target.value + 'T12:00:00')); }}
            style={{
              fontSize: 13, padding: '3px 6px',
              border: '1px solid var(--c-border)', borderRadius: 6,
              background: 'var(--c-surface)', color: 'var(--c-text)',
            }}
          />
        </div>
      </div>

      {loading ? <div className="loading">Загрузка...</div> : (
        <>
          {/* ── BLOCK 1: Snapshots ─────────────────────────────────── */}
          <div className="card" style={{ marginBottom: 16 }}>
            <h2 style={{ margin: '0 0 16px', fontSize: 15 }}>Активные сбои на начало смен</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
              <SnapCard label="Дневная смена 08:00" snap={daySnap} />
              <SnapCard label="Ночная смена 20:00"  snap={nightSnap} />
            </div>

            {isToday && (
              <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--c-border)' }}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: '#2563eb' }}>
                  Сейчас (обновляется)
                </div>
                {liveInc.length === 0 ? (
                  <div style={{ fontSize: 13, color: 'var(--c-muted)' }}>Активных заявок нет</div>
                ) : (
                  <div className="table-wrap">
                    <table className="table">
                      <tbody>
                        {[...liveInc]
                          .sort((a, b) => (PRIORITY_ORDER[a.priority] ?? 99) - (PRIORITY_ORDER[b.priority] ?? 99))
                          .map(inc => (
                            <tr key={inc.id}>
                              <td style={{ fontSize: 12, color: 'var(--c-muted)', width: 36 }}>#{inc.id}</td>
                              <td style={{ fontSize: 13 }}>{inc.parking_lot?.name ?? '—'}</td>
                              <td style={{ fontSize: 12, maxWidth: 150, whiteSpace: 'normal' }}>{inc.type}</td>
                              <td><PriorityBadge priority={inc.priority} /></td>
                              <td><StatusBadge status={inc.status} /></td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── BLOCK 2: Incidents for the day ─────────────────────── */}
          <div className="card" style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h2 style={{ margin: 0, fontSize: 15 }}>Заявки за день</h2>
              <select
                className="form-ctrl"
                value={lotFilter}
                onChange={e => setLotFilter(e.target.value)}
                style={{ width: 200, fontSize: 13 }}
              >
                <option value="">Все стоянки</option>
                {lots.map(l => <option key={l.id} value={String(l.id)}>{l.name}</option>)}
              </select>
            </div>

            <div style={{ display: 'flex', borderBottom: '1px solid var(--c-border)', marginBottom: 14 }}>
              <button style={tabStyle('opened')} onClick={() => setActiveTab('opened')}>
                Открыты в этот день
                {openedInc.length > 0 && (
                  <span style={{ marginLeft: 6, fontSize: 11, background: '#2563eb22', color: '#2563eb', padding: '1px 6px', borderRadius: 8 }}>
                    {openedInc.length}
                  </span>
                )}
              </button>
              <button style={tabStyle('closed')} onClick={() => setActiveTab('closed')}>
                Закрыты в этот день
                {closedInc.length > 0 && (
                  <span style={{ marginLeft: 6, fontSize: 11, background: '#22c55e22', color: '#22c55e', padding: '1px 6px', borderRadius: 8 }}>
                    {closedInc.length}
                  </span>
                )}
              </button>
            </div>

            {activeTab === 'opened' ? (
              <IncidentTable
                incidents={openedInc}
                lotFilter={lotFilter}
                timeKey="created_at"
                emptyMsg="В этот день заявок не открывалось"
              />
            ) : (
              <IncidentTable
                incidents={closedInc}
                lotFilter={lotFilter}
                timeKey="closed_at"
                emptyMsg="В этот день заявки не закрывались"
              />
            )}
          </div>

          {/* ── BLOCK 3: Notes ─────────────────────────────────────── */}
          {(dayNotes.length > 0 || isToday) && (
            <div className="card">
              <h2 style={{ margin: '0 0 12px', fontSize: 15 }}>Заметки смены</h2>
              {dayNotes.length === 0 ? (
                <div style={{ fontSize: 13, color: 'var(--c-muted)', marginBottom: 12 }}>
                  Заметок за этот день нет
                </div>
              ) : (
                dayNotes.map(n => (
                  <div key={n.id} style={{ padding: '6px 0', borderTop: '1px solid var(--c-border)' }}>
                    <div style={{ fontSize: 13 }}>{n.text}</div>
                    <div style={{ fontSize: 11, color: 'var(--c-muted)', marginTop: 2 }}>
                      {new Date(n.created_at).toLocaleString('ru-RU')}
                    </div>
                  </div>
                ))
              )}
              {isToday && canEdit && (
                <form onSubmit={handleAddNote} style={{ marginTop: 14 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <textarea
                      className="form-ctrl"
                      value={noteText}
                      onChange={e => setNoteText(e.target.value)}
                      placeholder="Добавить заметку..."
                      style={{ width: '100%', minHeight: 80, boxSizing: 'border-box', resize: 'vertical' }}
                    />
                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                      <button type="submit" className="btn btn-secondary"
                        disabled={noteBusy || !noteText.trim()}>
                        {noteBusy ? 'Сохранение...' : 'Добавить заметку'}
                      </button>
                    </div>
                  </div>
                </form>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
