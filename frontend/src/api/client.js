import axios from 'axios';

const api = axios.create({
  baseURL: 'http://127.0.0.1:8000',
  paramsSerializer: (params) => {
    const sp = new URLSearchParams();
    Object.entries(params).forEach(([key, val]) => {
      if (Array.isArray(val)) val.forEach(v => sp.append(key, v));
      else if (val !== undefined && val !== null && val !== '') sp.append(key, val);
    });
    return sp.toString();
  },
});

api.interceptors.request.use(cfg => {
  const token = localStorage.getItem('token');
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

api.interceptors.response.use(
  r => r,
  err => {
    if (err.response?.status === 401 && localStorage.getItem('token')) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export default api;
