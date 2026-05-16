import { useEffect, useState } from 'react';
import api from '../api/client';

const ACTION_LABELS = {
  login:              'Вход в систему',
  incident_created:   'Заявка создана',
  incident_accepted:  'Заявка принята',
  incident_closed:    'Заявка закрыта',
  incident_reopened:  'Заявка возобновлена',
  incident_updated:   'Заявка изменена',
  user_created:       'Пользователь создан',
  user_updated:       'Пользователь изменён',
  shift_note_created: 'Заметка добавлена',
  shift_note_deleted: 'Заметка удалена',
};

const ACTION_OPTIONS = [
  { value: '', label: 'Все действия' },
  ...Object.entries(ACTION_LABELS).map(([v, l]) => ({ value: v, label: l })),
];

export default function AuditLog() {
  const [logs, setLogs]           = useState([]);
  const [users, setUsers]         = useState([]);
  const [loading, setLoading]     = useState(true);
  const [filters, setFilters]     = useState({ user_id: '', action: '', date_from: '', date_to: '' });

  async function load() {
    const params = new URLSearchParams();
    if (filters.user_id)   params.append('user_id',   filters.user_id);
    if (filters.action)    params.append('action',    filters.action);
    if (filters.date_from) params.append('date_from', filters.date_from);
    if (filters.date_to)   params.append('date_to',   filters.date_to);
    const [logsRes, usersRes] = await Promise.all([
      api.get(`/audit-logs?${params}`),
      api.get('/users'),
    ]);
    setLogs(logsRes.data);
    setUsers(usersRes.data);
  }

  useEffect(() => {
    setLoading(true);
    load().catch(console.error).finally(() => setLoading(false));
  }, [filters]);

  function setFilter(key, val) {
    setFilters(f => ({ ...f, [key]: val }));
  }

  function formatDetails(raw) {
    if (!raw) return '—';
    try {
      const obj = JSON.parse(raw);
      return Object.entries(obj).map(([k, v]) => `${k}: ${v}`).join(', ');
    } catch {
      return raw;
    }
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Журнал действий</h1>
      </div>

      <div className="filters-row">
        <select className="form-ctrl" value={filters.user_id} onChange={e => setFilter('user_id', e.target.value)}>
          <option value="">Все пользователи</option>
          {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
        <select className="form-ctrl" value={filters.action} onChange={e => setFilter('action', e.target.value)}>
          {ACTION_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <input type="date" className="form-ctrl" value={filters.date_from}
          onChange={e => setFilter('date_from', e.target.value)} />
        <input type="date" className="form-ctrl" value={filters.date_to}
          onChange={e => setFilter('date_to', e.target.value)} />
        <button className="btn btn-secondary"
          onClick={() => setFilters({ user_id: '', action: '', date_from: '', date_to: '' })}>
          Сбросить
        </button>
      </div>

      <div className="card mb-0">
        {loading ? (
          <div className="empty-state">Загрузка...</div>
        ) : logs.length === 0 ? (
          <div className="empty-state">Записей не найдено</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Дата и время</th>
                  <th>Пользователь</th>
                  <th>Действие</th>
                  <th>Объект</th>
                  <th>Детали</th>
                </tr>
              </thead>
              <tbody>
                {logs.map(log => (
                  <tr key={log.id}>
                    <td className="text-sm">{new Date(log.created_at).toLocaleString('ru-RU')}</td>
                    <td>{log.user_name}</td>
                    <td>{ACTION_LABELS[log.action] ?? log.action}</td>
                    <td className="text-muted text-sm">
                      {log.entity ? `${log.entity} #${log.entity_id}` : '—'}
                    </td>
                    <td className="text-muted text-sm" style={{ maxWidth: 260, whiteSpace: 'normal' }}>
                      {formatDetails(log.details)}
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
