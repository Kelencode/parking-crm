import api from './client';
export const createSnapshot    = ()     => api.post('/shift-snapshots');
export const getSnapshots      = (date) => api.get('/shift-snapshots', { params: { date } });
export const getLatestSnapshot = ()     => api.get('/shift-snapshots/latest');
