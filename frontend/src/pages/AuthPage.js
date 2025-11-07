import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs'; // Importation des Tabs
import { toast } from 'sonner';
import { Users, Shield, KeyRound } from 'lucide-react';

export default function AuthPage() {
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  
  const [guestName, setGuestName] = useState('');
  const [guestCode, setGuestCode] = useState('');

  const [loading, setLoading] = useState(false);
  const { adminLogin, guestLogin, register } = useAuth(); // On récupère adminLogin et guestLogin
  const navigate = useNavigate();

  // Gère la soumission (Admin ou Invité)
  const handleSubmit = async (e, type) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (type === 'admin') {
        await adminLogin(adminEmail, adminPassword);
      } else if (type === 'guest') {
        await guestLogin(guestName, guestCode);
      }
      toast.success('Connexion réussie !');
      navigate('/dashboard');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Une erreur est survenue');
    } finally {
      setLoading(false);
    }
  };

  // Logique d'inscription (pour le 1er admin seulement)
  const handleRegister = async () => {
    setLoading(true);
    try {
      await register(adminEmail, adminPassword);
      toast.success('Compte admin créé !');
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
        {/* Branding (inchangé) */}
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
                <KeyRound className="w-5 h-5" />
              </div>
              <span className="text-lg">Connexion facile par code d'invitation</span>
            </div>
          </div>
        </div>

        {/* Formulaire d'authentification avec onglets */}
        <Card className="w-full shadow-2xl">
          <CardHeader>
            <CardTitle className="text-3xl" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
              Accéder à l'organisateur
            </CardTitle>
            <CardDescription>
              Connectez-vous en tant qu'admin ou invité.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="guest" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="guest">Invité</TabsTrigger>
                <TabsTrigger value="admin">Admin</TabsTrigger>
              </TabsList>
              
              {/* Onglet Invité */}
              <TabsContent value="guest">
                <form onSubmit={(e) => handleSubmit(e, 'guest')} className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label htmlFor="guest-name">Votre nom</Label>
                    <Input
                      id="guest-name"
                      type="text"
                      placeholder="Ex: David"
                      value={guestName}
                      onChange={(e) => setGuestName(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="guest-code">Code d'invitation</Label>
                    <Input
                      id="guest-code"
                      type="text"
                      placeholder="ABC-123"
                      value={guestCode}
                      onChange={(e) => setGuestCode(e.target.value)}
                      required
                    />
                  </div>
                  <Button 
                    type="submit" 
                    className="w-full" 
                    disabled={loading}
                    style={{ background: 'linear-gradient(135deg, #10b981 0%, #3b82f6 100%)' }}
                  >
                    {loading ? 'Chargement...' : "Entrer"}
                  </Button>
                </form>
              </TabsContent>
              
              {/* Onglet Admin */}
              <TabsContent value="admin">
                <form onSubmit={(e) => handleSubmit(e, 'admin')} className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label htmlFor="admin-email">Email Admin</Label>
                    <Input
                      id="admin-email"
                      type="email"
                      placeholder="votre@email.com"
                      value={adminEmail}
                      onChange={(e) => setAdminEmail(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="admin-password">Mot de passe Admin</Label>
                    <Input
                      id="admin-password"
                      type="password"
                      placeholder="••••••••"
                      value={adminPassword}
                      onChange={(e) => setAdminPassword(e.target.value)}
                      required
                    />
                  </div>
                  <Button 
                    type="submit" 
                    className="w-full" 
                    disabled={loading}
                    style={{ background: 'linear-gradient(135deg, #10b981 0%, #3b82f6 100%)' }}
                  >
                    {loading ? 'Chargement...' : 'Se connecter'}
                  </Button>
                  <Button type="button" variant="link" className="w-full" onClick={handleRegister}>
                    (Créer le premier compte admin)
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}