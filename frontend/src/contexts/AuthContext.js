import React, { createContext, useState, useContext, useEffect } from 'react';
import axios from 'axios';
// On importe nos nouvelles fonctions API
import { getMe, adminLogin as apiAdminLogin, registerFirstAdmin as apiRegister, guestLogin as apiGuestLogin } from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState(localStorage.getItem('token'));

  useEffect(() => {
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      fetchUser();
    } else {
      setLoading(false);
    }
  }, [token]);

  const fetchUser = async () => {
    try {
      const response = await getMe(); // Utilise la route /auth/me
      setUser(response.data);
    } catch (error) {
      console.error('Failed to fetch user:', error);
      logout(); // Si le token est invalide, on déconnecte
    } finally {
      setLoading(false);
    }
  };

  // Met à jour le token et l'utilisateur
  const setAuthData = (access_token, userData) => {
    localStorage.setItem('token', access_token);
    setToken(access_token);
    setUser(userData);
    axios.defaults.headers.common['Authorization'] = `Bearer ${access_token}`;
    return userData;
  };

  const adminLogin = async (email, password) => {
    const response = await apiAdminLogin(email, password);
    const { access_token, user: userData } = response.data;
    return setAuthData(access_token, userData);
  };

  const register = async (email, password) => {
    const response = await apiRegister(email, password);
    const { access_token, user: userData } = response.data;
    return setAuthData(access_token, userData);
  };

  // NOUVELLE FONCTION
  const guestLogin = async (name, code) => {
    const response = await apiGuestLogin(name, code);
    const { access_token, user: userData } = response.data;
    return setAuthData(access_token, userData);
  };

  const logout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
    delete axios.defaults.headers.common['Authorization'];
  };

  return (
    <AuthContext.Provider value={{ user, adminLogin, register, guestLogin, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};