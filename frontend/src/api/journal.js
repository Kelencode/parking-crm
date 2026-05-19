import api from './client';

export function getJournal(params = {}) {
  return api.get('/journal', { params });
}

export function createJournalEntry(data) {
  return api.post('/journal', data);
}

export function updateJournalEntry(id, data) {
  return api.patch(`/journal/${id}`, data);
}

export function deleteJournalEntry(id) {
  return api.delete(`/journal/${id}`);
}

export function downloadJournalReport(dateFrom, dateTo, lotId, lotName) {
  return api.get('/reports/journal', {
    params: { date_from: dateFrom, date_to: dateTo, ...(lotId ? { lot_id: lotId } : {}) },
    responseType: 'blob',
  }).then(response => {
    const url = URL.createObjectURL(response.data);
    const a = document.createElement('a');
    a.href = url;
    const safe = lotName ? `journal_${lotName.replace(/\s+/g, '_')}_` : 'journal_';
    a.download = `${safe}${dateFrom}_${dateTo}.xlsx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  });
}
