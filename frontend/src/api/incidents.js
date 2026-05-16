import api from './client';

export const getIncidents    = (params = {}) => api.get('/incidents', { params });
export const createIncident  = data          => api.post('/incidents', data);
export const updateIncident  = (id, data)    => api.patch(`/incidents/${id}`, data);
export const acceptIncident  = (id)                => api.patch(`/incidents/${id}/accept`);
export const closeIncident   = (id, resolution)    => api.patch(`/incidents/${id}/close`, resolution ? { resolution } : {});
export const suggestPriority = (lot_id, incident_type) =>
  api.get('/incidents/suggest-priority', { params: { lot_id, incident_type } });
