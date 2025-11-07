import axios from 'axios';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// ===================================
// AUTH
// ===================================
// (Note : on déplace la logique ici depuis AuthContext pour tout centraliser)

export const adminLogin = (email, password) => {
  return axios.post(`${API}/auth/login`, { email, password });
};

export const registerFirstAdmin = (email, password) => {
  return axios.post(`${API}/auth/register`, { email, password });
};

export const guestLogin = (name, code) => {
  return axios.post(`${API}/auth/guest-login`, { name, code });
};

export const getMe = () => {
  return axios.get(`${API}/auth/me`);
};

// ===================================
// ADMIN (Guest Code Management)
// ===================================

export const getGuestCode = () => {
  return axios.get(`${API}/admin/guest-code`);
};

export const regenerateGuestCode = () => {
  return axios.post(`${API}/admin/guest-code`);
};


// ===================================
// PLAYERS (Inchangé)
// ===================================
export const getPlayers = () => axios.get(`${API}/players`);
export const createPlayer = (data) => axios.post(`${API}/players`, data);
export const updatePlayer = (id, data) => axios.put(`${API}/players/${id}`, data);
export const deletePlayer = (id) => axios.delete(`${API}/players/${id}`);

// ===================================
// EVENTS (Inchangé)
// ===================================
export const getEvents = () => axios.get(`${API}/events`);
export const getEvent = (id) => axios.get(`${API}/events/${id}`);
export const createEvent = (data) => axios.post(`${API}/events`, data);
export const updateEvent = (id, data) => axios.put(`${API}/events/${id}`, data);
export const deleteEvent = (id) => axios.delete(`${API}/events/${id}`);
export const generateTeams = (id) => axios.post(`${API}/events/${id}/generate`);

// ===================================
// SHARE (Inchangé)
// ===================================
export const getSharedEvent = (token) => axios.get(`${API}/share/${token}`);