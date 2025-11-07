import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getGuestCode, regenerateGuestCode } from '../services/api'; // On importe les nouvelles fonctions
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { toast } from 'sonner';
import { ArrowLeft, KeyRound, RefreshCw, Copy } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';

export default function UserPage() {
  const [code, setCode] = useState(null);
  const [expiresAt, setExpiresAt] = useState(null);
  const [loading, setLoading] = useState(true);

  const navigate = useNavigate();

  useEffect(() => {
    fetchCode();
  }, []);

  const fetchCode = async () => {
    setLoading(true);
    try {
      const response = await getGuestCode();
      setCode(response.data.code);
      setExpiresAt(new Date(response.data.expires_at));
    } catch (error) {
      toast.error('Erreur: Seul un admin peut voir cette page.');
      navigate('/dashboard');
    } finally {
      setLoading(false);
    }
  };

  const handleRegenerate = async () => {
    if (!window.confirm('Êtes-vous sûr ? L\'ancien code ne fonctionnera plus.')) return;
    setLoading(true);
    try {
      const response = await regenerateGuestCode();
      setCode(response.data.code);
      setExpiresAt(new Date(response.data.expires_at));
      toast.success('Nouveau code généré !');
    } catch (error) {
      toast.error('Erreur lors de la génération du code.');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(code);
    toast.success('Code copié dans le presse-papiers !');
  };

  const getExpirationText = () => {
    if (!expiresAt) return '';
    const now = new Date();
    if (expiresAt < now) {
      return '(Expiré)';
    }
    return `(Expire ${formatDistanceToNow(expiresAt, { addSuffix: true, locale: fr })})`;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <Button variant="outline" size="icon" onClick={() => navigate('/dashboard')}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <h1 className="text-3xl font-bold" style={{ fontFamily: 'Space Grotesk, sans-serif', color: '#1e293b' }}>
              Code d'Invitation Invité
            </h1>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        <Card className="max-w-md mx-auto">
          <CardHeader>
            <CardTitle>Code de la semaine</CardTitle>
            <CardDescription>
              Partagez ce code avec vos co-organisateurs. Il se renouvelle chaque semaine.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {loading ? (
              <p>Chargement...</p>
            ) : (
              <div className="space-y-4">
                <div className="p-4 bg-gray-100 rounded-lg flex items-center justify-between">
                  <span className="text-3xl font-mono tracking-widest text-blue-600">
                    {code}
                  </span>
                  <Button variant="ghost" size="icon" onClick={copyToClipboard}>
                    <Copy className="w-5 h-5" />
                  </Button>
                </div>
                <p className="text-sm text-gray-500 text-center">
                  {getExpirationText()}
                </p>
              </div>
            )}
            
            <Button className="w-full" onClick={handleRegenerate} disabled={loading}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Générer un nouveau code maintenant
            </Button>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}