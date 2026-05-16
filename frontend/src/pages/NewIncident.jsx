import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createIncident } from '../api/incidents';
import { getParkingLots } from '../api/parkingLots';

const INCIDENT_TYPES = [
  'Въездная группа (шлагбаум/стойка)',
  'Выездная группа (шлагбаум/стойка)',
  'Касса оплаты',
  'Безналичная оплата',
  'Оплата наличными',
  'Камера видеонаблюдения',
  'Связь с оператором',
  'Дисплей/экран',
  'Информационное табло',
  'Освещение',
  'Программное обеспечение',
  'Другое',
];

const PRIORITIES = [
  { value: 'critical', label: 'Критичный' },
  { value: 'high',     label: 'Высокий'   },
  { value: 'medium',   label: 'Средний'   },
  { value: 'low',      label: 'Низкий'    },
];

export default function NewIncident() {
  const navigate = useNavigate();
  const [lots, setLots] = useState([]);
  const [form, setForm] = useState({
    lot_id: '', type: '', priority: '', description: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    getParkingLots().then(r => setLots(r.data)).catch(console.error);
  }, []);

  function handleChange(e) {
    const { name, value } = e.target;
    setForm(f => ({ ...f, [name]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await createIncident({
        parking_lot_id: Number(form.lot_id),
        type: form.type,
        priority: form.priority,
        description: form.description,
      });
      navigate('/incidents');
    } catch (err) {
      const detail = err.response?.data?.detail;
      if (Array.isArray(detail)) {
        setError(detail.map(d => d.msg).join('; '));
      } else {
        setError(typeof detail === 'string' ? detail : 'Ошибка при создании заявки');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Новая заявка</h1>
      </div>

      <div className="card" style={{ maxWidth: 560 }}>
        {error && <div className="login-error">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Стоянка *</label>
            <select name="lot_id" className="form-ctrl" value={form.lot_id} onChange={handleChange} required>
              <option value="">— выберите стоянку —</option>
              {lots.filter(l => l.is_active !== false).map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Тип инцидента *</label>
            <select name="type" className="form-ctrl" value={form.type} onChange={handleChange} required>
              <option value="">— выберите тип —</option>
              {INCIDENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Приоритет *</label>
            <select name="priority" className="form-ctrl" value={form.priority} onChange={handleChange} required>
              <option value="">— выберите приоритет —</option>
              {PRIORITIES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Описание</label>
            <textarea
              name="description"
              className="form-ctrl"
              value={form.description}
              onChange={handleChange}
              placeholder="Дополнительные подробности..."
              style={{ width: '100%', minHeight: 80, boxSizing: 'border-box', resize: 'vertical' }}
            />
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? 'Создание...' : 'Создать заявку'}
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => navigate(-1)}>
              Отмена
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
