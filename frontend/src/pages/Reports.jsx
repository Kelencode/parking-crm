import { useEffect, useState } from 'react';
import { downloadIncidentsReport, downloadSnapshotsReport } from '../api/reports';
import { getParkingLots } from '../api/parkingLots';

function localDateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function firstOfMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

function IncidentsBlock({ lots }) {
  const today = localDateStr(new Date());
  const [dateFrom, setDateFrom] = useState(firstOfMonth());
  const [dateTo,   setDateTo]   = useState(today);
  const [lotId,    setLotId]    = useState('');
  const [busy,     setBusy]     = useState(false);
  const [error,    setError]    = useState('');

  const activeLots = lots.filter(l => l.is_active !== false);
  const selectedLot = activeLots.find(l => String(l.id) === lotId);

  async function handleDownload() {
    if (!dateFrom || !dateTo) return;
    if (dateFrom > dateTo) { setError('Дата начала не может быть позже даты конца'); return; }
    setError('');
    setBusy(true);
    try {
      await downloadIncidentsReport(dateFrom, dateTo, lotId || null, selectedLot?.name || '');
    } catch (e) {
      setError(e.response?.data?.detail ?? 'Ошибка при формировании отчёта');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <h2 style={{ margin: '0 0 6px', fontSize: 15 }}>Заявки за период</h2>
      <p style={{ margin: '0 0 16px', fontSize: 13, color: 'var(--c-muted)' }}>
        Список всех заявок, открытых в выбранный период. Колонки: №, дата открытия, время, стоянка, тип, описание, приоритет, статус, исполнитель, что сделано, дата закрытия, повторная.
      </p>

      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div>
          <label className="form-label" style={{ display: 'block', marginBottom: 4 }}>С</label>
          <input
            type="date"
            className="form-ctrl"
            value={dateFrom}
            max={today}
            onChange={e => setDateFrom(e.target.value)}
            style={{ width: 160 }}
          />
        </div>
        <div>
          <label className="form-label" style={{ display: 'block', marginBottom: 4 }}>По</label>
          <input
            type="date"
            className="form-ctrl"
            value={dateTo}
            max={today}
            onChange={e => setDateTo(e.target.value)}
            style={{ width: 160 }}
          />
        </div>
        <div>
          <label className="form-label" style={{ display: 'block', marginBottom: 4 }}>Стоянка</label>
          <select
            className="form-ctrl"
            value={lotId}
            onChange={e => setLotId(e.target.value)}
            style={{ width: 200 }}
          >
            <option value="">Все стоянки</option>
            {activeLots.map(l => (
              <option key={l.id} value={String(l.id)}>{l.name}</option>
            ))}
          </select>
        </div>
        <button
          className="btn btn-primary"
          onClick={handleDownload}
          disabled={busy || !dateFrom || !dateTo}
          style={{ marginBottom: 1 }}
        >
          {busy ? 'Формирование...' : 'Скачать xlsx'}
        </button>
      </div>

      {error && (
        <div style={{ marginTop: 10, fontSize: 13, color: '#f87171' }}>{error}</div>
      )}
    </div>
  );
}

function SnapshotsBlock() {
  const today = localDateStr(new Date());
  const [dateFrom, setDateFrom] = useState(firstOfMonth());
  const [dateTo,   setDateTo]   = useState(today);
  const [busy,     setBusy]     = useState(false);
  const [error,    setError]    = useState('');

  async function handleDownload() {
    if (!dateFrom || !dateTo) return;
    if (dateFrom > dateTo) { setError('Дата начала не может быть позже даты конца'); return; }
    setError('');
    setBusy(true);
    try {
      await downloadSnapshotsReport(dateFrom, dateTo);
    } catch (e) {
      setError(e.response?.data?.detail ?? 'Ошибка при формировании отчёта');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <h2 style={{ margin: '0 0 6px', fontSize: 15 }}>Срезы смен за период</h2>
      <p style={{ margin: '0 0 16px', fontSize: 13, color: 'var(--c-muted)' }}>
        Зафиксированные передачи смен. Для каждого среза: дата, смена, время, способ (авто/вручную), кто зафиксировал, количество активных заявок и список стоянок.
      </p>

      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div>
          <label className="form-label" style={{ display: 'block', marginBottom: 4 }}>С</label>
          <input
            type="date"
            className="form-ctrl"
            value={dateFrom}
            max={today}
            onChange={e => setDateFrom(e.target.value)}
            style={{ width: 160 }}
          />
        </div>
        <div>
          <label className="form-label" style={{ display: 'block', marginBottom: 4 }}>По</label>
          <input
            type="date"
            className="form-ctrl"
            value={dateTo}
            max={today}
            onChange={e => setDateTo(e.target.value)}
            style={{ width: 160 }}
          />
        </div>
        <button
          className="btn btn-primary"
          onClick={handleDownload}
          disabled={busy || !dateFrom || !dateTo}
          style={{ marginBottom: 1 }}
        >
          {busy ? 'Формирование...' : 'Скачать xlsx'}
        </button>
      </div>

      {error && (
        <div style={{ marginTop: 10, fontSize: 13, color: '#f87171' }}>{error}</div>
      )}
    </div>
  );
}

export default function Reports() {
  const [lots, setLots] = useState([]);

  useEffect(() => {
    getParkingLots().then(r => setLots(r.data)).catch(console.error);
  }, []);

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Отчёты</h1>
      </div>

      <IncidentsBlock lots={lots} />
      <SnapshotsBlock />
    </div>
  );
}
