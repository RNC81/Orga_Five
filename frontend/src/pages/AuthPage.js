import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { toast } from 'sonner';
import { Users, Shield } from 'lucide-react';

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isLogin) {
        await login(email, password);
        toast.success('Connexion réussie !');
      } else {
        await register(email, password);
        toast.success('Compte créé avec succès !');
      }
      navigate('/dashboard');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Une erreur est survenue');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'linear-gradient(135deg, #10b981 0%, #3b82f6 100%)' }}>
      <div className="w-full max-w-6xl grid md:grid-cols-2 gap-8 items-center">
        {/* Left side - Branding */}
        <div className="text-white space-y-6 hidden md:block">
          <div className="flex items-center gap-3">
            <div className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
              <Users className="w-8 h-8" />
            </div>
            <h1 className="text-5xl font-bold" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>FutTeams</h1>
          </div>
          <p className="text-xl text-white/90" style={{ fontFamily: 'Inter, sans-serif' }}>
            Créez des équipes de football équilibrées en quelques clics
          </p>
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-white/10 backdrop-blur-sm flex items-center justify-center">
                <Shield className="w-5 h-5" />
              </div>
              <span className="text-lg">Algorithme d'équilibrage avancé</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-white/10 backdrop-blur-sm flex items-center justify-center">
                <Users className="w-5 h-5" />
              </div>
              <span className="text-lg">Gestion des affinités entre joueurs</span>
            </div>
          </div>
        </div>

        {/* Right side - Auth Form */}
        <Card className="w-full shadow-2xl">
          <CardHeader>
            <CardTitle className="text-3xl" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
              {isLogin ? 'Connexion' : 'Inscription'}
            </CardTitle>
            <CardDescription>
              {isLogin ? 'Connectez-vous à votre compte' : 'Créez votre compte organisateur'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="votre@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  data-testid="auth-email-input"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Mot de passe</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  data-testid="auth-password-input"
                />
              </div>
              <Button 
                type="submit" 
                className="w-full" 
                disabled={loading}
                data-testid="auth-submit-button"
                style={{ background: 'linear-gradient(135deg, #10b981 0%, #3b82f6 100%)' }}
              >
                {loading ? 'Chargement...' : (isLogin ? 'Se connecter' : "S'inscrire")}
              </Button>
            </form>
            <div className="mt-4 text-center">
              <button
                type="button"
                onClick={() => setIsLogin(!isLogin)}
                className="text-sm text-blue-600 hover:underline"
                data-testid="auth-toggle-button"
              >
                {isLogin ? "Pas encore de compte ? S'inscrire" : 'Déjà un compte ? Se connecter'}
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}