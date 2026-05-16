import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getIncidents } from '../api/incidents';
import StatusBadge from '../components/StatusBadge';
import PriorityBadge from '../components/PriorityBadge';

export default function Dashboard() {
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getIncidents({ status: ['new', 'assigned', 'in_progress'], limit: 100 })
      .then(r => setIncidents(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const counts = { critical: 0, high: 0, medium: 0, low: 0 };
  incidents.forEach(i => { if (counts[i.priority] !== undefined) counts[i.priority]++; });

  if (loading) return <div className="loading">Загрузка...</div>;

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Дашборд</h1>
        <Link to="/new-incident" className="btn btn-primary">+ Новая заявка</Link>
      </div>

      <div className="stats-row">
        <div className="stat-card">
          <span className="stat-label">Критичных</span>
          <span className="stat-value critical">{counts.critical}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Высоких</span>
          <span className="stat-value high">{counts.high}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Средних</span>
          <span className="stat-value medium">{counts.medium}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Низких</span>
          <span className="stat-value low">{counts.low}</span>
        </div>
      </div>

      <div className="card mb-0">
        <h2 style={{ marginBottom: 14, fontSize: 15 }}>Активные заявки</h2>
        {incidents.length === 0 ? (
          <div className="empty-state">Нет активных заявок</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Стоянка</th>
                  <th>Тип</th>
                  <th>Приоритет</th>
                  <th>Статус</th>
                  <th>Исполнитель</th>
                  <th>Создана</th>
                </tr>
              </thead>
              <tbody>
                {incidents.map(inc => (
                  <tr key={inc.id}>
                    <td>{inc.id}</td>
                    <td>{inc.parking_lot?.name ?? '—'}</td>
                    <td style={{ maxWidth: 200, whiteSpace: 'normal' }}>{inc.type}</td>
                    <td><PriorityBadge priority={inc.priority} /></td>
                    <td><StatusBadge status={inc.status} /></td>
                    <td className="text-muted text-sm">{inc.assignee?.name ?? '—'}</td>
                    <td className="text-muted text-sm">{new Date(inc.created_at).toLocaleString('ru-RU')}</td>
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
