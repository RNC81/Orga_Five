import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import AuthPage from './pages/AuthPage';
import Dashboard from './pages/Dashboard';

// Importation du composant Toaster pour les notifications (utilisé dans AuthPage)
// Nous utilisons la version de 'sonner' car AuthPage l'importe
import { Toaster } from 'sonner';

// Importation du CSS de base
import './App.css';

/**
 * Un composant "Route Protégée"
 * Vérifie si l'utilisateur est connecté avant d'afficher la page demandée.
 * Sinon, il le redirige vers /login.
 */
function PrivateRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    // Affiche un écran de chargement pendant la vérification de l'authentification
    return <div className="min-h-screen flex items-center justify-center">Chargement...</div>;
  }

  if (!user) {
    // Non connecté, redirection vers la page de connexion
    return <Navigate to="/login" replace />;
  }

  // Connecté, affiche le composant enfant (par ex: le Dashboard)
  return children;
}

/**
 * Un composant "Route d'Authentification"
 * Si l'utilisateur est *déjà* connecté, il le redirige vers le tableau de bord.
 * C'est pour éviter que l'utilisateur ne revoie la page de connexion.
 */
function AuthRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Chargement...</div>;
  }

  if (user) {
    // Déjà connecté, redirection vers le tableau de bord
    return <Navigate to="/dashboard" replace />;
  }

  // Pas connecté, affiche le composant enfant (la page de connexion)
  return children;
}

/**
 * Le composant principal de l'application
 */
function App() {
  return (
    <AuthProvider>
      {/* Le Provider de Toasts pour les notifications */}
      <Toaster position="top-right" richColors />

      <BrowserRouter>
        <Routes>

          {/* Route pour la connexion/inscription */}
          <Route 
            path="/login" 
            element={
              <AuthRoute>
                <AuthPage />
              </AuthRoute>
            } 
          />

          {/* Route protégée pour le tableau de bord */}
          <Route 
            path="/dashboard" 
            element={
              <PrivateRoute>
                <Dashboard />
              </PrivateRoute>
            } 
          />

          {/* NOTE : Les autres pages (Joueurs, Utilisateurs, Evénements)
              ne sont pas encore créées. Nous les ajouterons ici plus tard. */}

          {/* Route par défaut : redirige tout vers /dashboard */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />

        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;