import axios from 'axios';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Players
export const getPlayers = () => axios.get(`${API}/players`);
export const createPlayer = (data) => axios.post(`${API}/players`, data);
export const updatePlayer = (id, data) => axios.put(`${API}/players/${id}`, data);
export const deletePlayer = (id) => axios.delete(`${API}/players/${id}`);

// Events
export const getEvents = () => axios.get(`${API}/events`);
export const getEvent = (id) => axios.get(`${API}/events/${id}`);
export const createEvent = (data) => axios.post(`${API}/events`, data);
export const updateEvent = (id, data) => axios.put(`${API}/events/${id}`, data);
export const deleteEvent = (id) => axios.delete(`${API}/events/${id}`);
export const generateTeams = (id) => axios.post(`${API}/events/${id}/generate`);

// Share
export const getSharedEvent = (token) => axios.get(`${API}/share/${token}`);

// Users (admin only)
export const getUsers = () => axios.get(`${API}/users`);
export const inviteUser = (data) => axios.post(`${API}/users`, data);
export const deleteUser = (id) => axios.delete(`${API}/users/${id}`);