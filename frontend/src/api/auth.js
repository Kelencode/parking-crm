import api from './client';

export const login = (email, password) =>
  api.post(
    '/auth/token',
    new URLSearchParams({ username: email, password }).toString(),
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
  );

export const getMe = () => api.get('/auth/me');
