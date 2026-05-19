import { useEffect, useState } from 'react';
import { getIncidents, acceptIncident, closeIncident } from '../api/incidents';
import { getParkingLots } from '../api/parkingLots';
import { useAuth } from '../context/AuthContext';
import { subscribe as wsSubscribe } from '../api/websocket';
import StatusBadge from '../components/StatusBadge';
import PriorityBadge from '../components/PriorityBadge';
import api from '../api/client';

const STATUS_OPTIONS = [
  { value: '', label: 'Все статусы' },
  { value: 'new', label: 'Новая' },
  { value: 'in_progress', label: 'В работе' },
  { value: 'closed', label: 'Закрыта' },
];

const PRIORITY_OPTIONS = [
  { value: '', label: 'Все приоритеты' },
  { value: 'critical', label: 'Критичный' },
  { value: 'high', label: 'Высокий' },
  { value: 'medium', label: 'Средний' },
  { value: 'low', label: 'Низкий' },
];

function useIsMobile() {
  const [mobile, setMobile] = useState(() => window.matchMedia('(max-width: 768px)').matches);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)');
    const h = e => setMobile(e.matches);
    mq.addEventListener('change', h);
    return () => mq.removeEventListener('change', h);
  }, []);
  return mobile;
}

// Модальное окно "Что было сделано"
function CloseModal({ onConfirm, onCancel }) {
  const [resolution, setResolution] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!resolution.trim()) return;
    setBusy(true);
    await onConfirm(resolution.trim());
    setBusy(false);
  }

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-title">Завершение заявки</div>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Что было сделано *</label>
            <textarea
              className="form-ctrl"
              value={resolution}
              onChange={e => setResolution(e.target.value)}
              placeholder="Опишите выполненные работы..."
              autoFocus
              required
              style={{ width: '100%', minHeight: 80, boxSizing: 'border-box', resize: 'vertical' }}
            />
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={busy}>
              Отмена
            </button>
            <button type="submit" className="btn btn-primary" disabled={busy || !resolution.trim()}>
              {busy ? 'Сохранение...' : 'Завершить'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function IncidentActions({ inc, role, onRefresh }) {
  const [showModal, setShowModal] = useState(false);
  const [busy, setBusy] = useState(false);

  async function handle(fn) {
    setBusy(true);
    try { await fn(); onRefresh(); }
    catch (e) { alert(e.response?.data?.detail ?? 'Ошибка'); }
    finally { setBusy(false); }
  }

  if (role === 'tech') {
    if (inc.status === 'new') {
      return (
        <button className="btn btn-sm btn-primary" disabled={busy}
          onClick={() => handle(() => acceptIncident(inc.id))}>
          Принять
        </button>
      );
    }
    if (inc.status === 'in_progress') {
      return (
        <>
          <button className="btn btn-sm btn-secondary" disabled={busy}
            onClick={() => setShowModal(true)}>
            Завершить
          </button>
          {showModal && (
            <CloseModal
              onCancel={() => setShowModal(false)}
              onConfirm={async (resolution) => {
                setShowModal(false);
                await handle(() => closeIncident(inc.id, resolution));
              }}
            />
          )}
        </>
      );
    }
    return null;
  }

  if (role === 'dispatcher' || role === 'admin') {
    if (inc.status === 'closed') {
      return (
        <button className="btn btn-sm btn-secondary" disabled={busy}
          onClick={() => handle(() => api.patch(`/incidents/${inc.id}/reopen`))}>
          Возобновить
        </button>
      );
    }
    return (
      <button className="btn btn-sm btn-danger" disabled={busy}
        onClick={() => handle(() => closeIncident(inc.id))}>
        Закрыть
      </button>
    );
  }

  return null;
}

// Карточка заявки для мобильного
function IncidentCard({ inc, role, onRefresh }) {
  return (
    <div className="incident-card">
      <div className="incident-card-header">
        <span style={{ fontSize: 11, color: 'var(--c-muted)' }}>#{inc.id}</span>
        <div className="incident-card-meta">
          <PriorityBadge priority={inc.priority} />
          <StatusBadge status={inc.status} />
        </div>
      </div>
      <div className="incident-card-lot">{inc.parking_lot?.name ?? '—'}</div>
      <div className="incident-card-title">
        {inc.type}
        {inc.is_repeat && <span className="badge b-repeat" style={{ marginLeft: 6 }}>Повторно</span>}
      </div>
      {inc.assignee && (
        <div style={{ fontSize: 11, color: 'var(--c-muted)' }}>Исполнитель: {inc.assignee.name}</div>
      )}
      {inc.resolution && (
        <div className="incident-card-resolution">{inc.resolution}</div>
      )}
      <span className="incident-card-time">
        {new Date(inc.created_at).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
      </span>
      <div className="incident-card-actions">
        <IncidentActions inc={inc} role={role} onRefresh={onRefresh} />
      </div>
    </div>
  );
}

export default function Incidents() {
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const [incidents, setIncidents] = useState([]);
  const [lots, setLots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ status: '', priority: '', lot_id: '' });

  async function load() {
    const params = {};
    if (filters.status)   params.status   = filters.status;
    if (filters.priority) params.priority  = filters.priority;
    if (filters.lot_id)   params.lot_id   = filters.lot_id;
    const [inc, lotsData] = await Promise.all([
      getIncidents(params),
      getParkingLots(),
    ]);
    setIncidents(inc.data);
    setLots(lotsData.data);
  }

  useEffect(() => {
    setLoading(true);
    load().catch(console.error).finally(() => setLoading(false));

    const unsub = wsSubscribe(msg => {
      if (msg.type === 'new_incident') load().catch(console.error);
    });
    return unsub;
  }, [filters]);

  function setFilter(key, val) {
    setFilters(f => ({ ...f, [key]: val }));
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Заявки</h1>
      </div>

      <div className="filters-row">
        <select className="form-ctrl" value={filters.status} onChange={e => setFilter('status', e.target.value)}>
          {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <select className="form-ctrl" value={filters.priority} onChange={e => setFilter('priority', e.target.value)}>
          {PRIORITY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <select className="form-ctrl" value={filters.lot_id} onChange={e => setFilter('lot_id', e.target.value)}>
          <option value="">Все стоянки</option>
          {lots.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
      </div>

      <div className="card mb-0">
        {loading ? (
          <div className="empty-state">Загрузка...</div>
        ) : incidents.length === 0 ? (
          <div className="empty-state">Заявки не найдены</div>
        ) : isMobile ? (
          // ── Карточный вид на мобильном ──
          <div className="incident-cards">
            {incidents.map(inc => (
              <IncidentCard key={inc.id} inc={inc} role={user?.role} onRefresh={load} />
            ))}
          </div>
        ) : (
          // ── Таблица на десктопе ──
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Стоянка</th>
                  <th>Описание</th>
                  <th>Приоритет</th>
                  <th>Статус</th>
                  <th>Исполнитель</th>
                  <th>Решение</th>
                  <th>Создана</th>
                  <th>Действия</th>
                </tr>
              </thead>
              <tbody>
                {incidents.map(inc => (
                  <tr key={inc.id}>
                    <td>{inc.id}</td>
                    <td>{inc.parking_lot?.name ?? '—'}</td>
                    <td style={{ maxWidth: 160, whiteSpace: 'normal' }}>
                      {inc.type}
                      {inc.is_repeat && <span className="badge b-repeat">Повторно</span>}
                    </td>
                    <td><PriorityBadge priority={inc.priority} /></td>
                    <td><StatusBadge status={inc.status} /></td>
                    <td className="text-muted text-sm">{inc.assignee?.name ?? '—'}</td>
                    <td>
                      {inc.resolution
                        ? <span className="resolution-text">{inc.resolution}</span>
                        : <span className="text-muted">—</span>}
                    </td>
                    <td className="text-muted text-sm">{new Date(inc.created_at).toLocaleString('ru-RU')}</td>
                    <td>
                      <IncidentActions inc={inc} role={user?.role} onRefresh={load} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
