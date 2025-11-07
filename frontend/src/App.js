import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import AuthPage from './pages/AuthPage';
import Dashboard from './pages/Dashboard';
import PlayerPage from './pages/PlayerPage';
import UserPage from './pages/UserPage'; // <-- 1. IMPORTER LA NOUVELLE PAGE

import { Toaster } from 'sonner';
import './App.css';

// ... (Le code de PrivateRoute et AuthRoute reste le même) ...
function PrivateRoute({ children }) {
  // ... (code inchangé)
  const { user, loading } = useAuth();
  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Chargement...</div>;
  }
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  return children;
}

function AuthRoute({ children }) {
  // ... (code inchangé)
  const { user, loading } = useAuth();
  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Chargement...</div>;
  }
  if (user) {
    return <Navigate to="/dashboard" replace />;
  }
  return children;
}


function App() {
  return (
    <AuthProvider>
      <Toaster position="top-right" richColors />
      
      <BrowserRouter>
        <Routes>
          
          <Route 
            path="/login" 
            element={
              <AuthRoute>
                <AuthPage />
              </AuthRoute>
            } 
          />
          
          <Route 
            path="/dashboard" 
            element={
              <PrivateRoute>
                <Dashboard />
              </PrivateRoute>
            } 
          />
          
          <Route 
            path="/players" 
            element={
              <PrivateRoute>
                <PlayerPage />
              </PrivateRoute>
            } 
          />

          {/* 👇 2. AJOUTER LA NOUVELLE ROUTE CI-DESSOUS 👇 */}
          <Route 
            path="/users" 
            element={
              <PrivateRoute>
                <UserPage />
              </PrivateRoute>
            } 
          />

          {/* NOTE : La page Evénements n'est pas encore créée. */}

          <Route path="*" element={<Navigate to="/dashboard" replace />} />

        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;