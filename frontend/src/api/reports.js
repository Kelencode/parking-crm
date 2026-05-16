import api from './client';

async function _download(url, params, filename) {
  const response = await api.get(url, { params, responseType: 'blob' });
  const objectUrl = URL.createObjectURL(response.data);
  const a = document.createElement('a');
  a.href = objectUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(objectUrl);
}

export function downloadIncidentsReport(dateFrom, dateTo, lotId, lotName) {
  const params = { date_from: dateFrom, date_to: dateTo };
  if (lotId) params.lot_id = lotId;
  const prefix = lotName ? `incidents_${lotName.replace(/\s+/g, '_')}_` : 'incidents_';
  return _download(
    '/reports/incidents',
    params,
    `${prefix}${dateFrom}_${dateTo}.xlsx`,
  );
}

export function downloadSnapshotsReport(dateFrom, dateTo) {
  return _download(
    '/reports/snapshots',
    { date_from: dateFrom, date_to: dateTo },
    `snapshots_${dateFrom}_${dateTo}.xlsx`,
  );
}
