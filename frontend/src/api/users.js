import api from './client';

export const getUsers       = ()             => api.get('/users');
export const createUser     = (data)         => api.post('/users', data);
export const updateUser     = (id, data)     => api.patch(`/users/${id}`, data);
export const resetPassword  = (id, data)     => api.post(`/users/${id}/reset-password`, data);
export const changePassword = (data)         => api.patch('/auth/change-password', data);
