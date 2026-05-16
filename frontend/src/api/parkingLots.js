import api from './client';
export const getParkingLots   = ()         => api.get('/parking-lots');
export const createParkingLot = data       => api.post('/parking-lots', data);
export const updateParkingLot = (id, data) => api.patch(`/parking-lots/${id}`, data);
