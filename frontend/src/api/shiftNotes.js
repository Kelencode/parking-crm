import api from './client';
export const getNotes    = (params) => api.get('/shift-notes', { params });
export const createNote  = data   => api.post('/shift-notes', data);
export const deleteNote  = id     => api.delete(`/shift-notes/${id}`);
