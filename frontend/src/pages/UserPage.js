import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getGuestCode, regenerateGuestCode, getGuestLogs } from '../services/api'; // 1. Importer getGuestLogs
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table'; // 2. Importer la Table
import { toast } from 'sonner';
import { ArrowLeft, KeyRound, RefreshCw, Copy, History } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns'; // 3. Importer format
import { fr } from 'date-fns/locale';

export default function UserPage() {
  const [code, setCode] = useState(null);
  const [expiresAt, setExpiresAt] = useState(null);
  const [logs, setLogs] = useState([]); // 4. Nouvel état pour les logs
  const [loadingCode, setLoadingCode] = useState(true);
  const [loadingLogs, setLoadingLogs] = useState(true);

  const navigate = useNavigate();

  useEffect(() => {
    fetchCode();
    fetchLogs(); // 5. Appeler la fonction pour charger les logs
  }, []);

  const fetchCode = async () => {
    setLoadingCode(true);
    try {
      const response = await getGuestCode();
      setCode(response.data.code);
      setExpiresAt(new Date(response.data.expires_at));
    } catch (error) {
      toast.error('Erreur: Seul un admin peut voir cette page.');
      navigate('/dashboard');
    } finally {
      setLoadingCode(false);
    }
  };

  // 6. Nouvelle fonction pour charger les logs
  const fetchLogs = async () => {
    setLoadingLogs(true);
    try {
      const response = await getGuestLogs();
      setLogs(response.data);
    } catch (error) {
      toast.error('Erreur lors du chargement de l\'historique.');
    } finally {
      setLoadingLogs(false);
    }
  };

  const handleRegenerate = async () => {
    if (!window.confirm('Êtes-vous sûr ? L\'ancien code ne fonctionnera plus.')) return;
    setLoadingCode(true);
    try {
      const response = await regenerateGuestCode();
      setCode(response.data.code);
      setExpiresAt(new Date(response.data.expires_at));
      toast.success('Nouveau code généré !');
      fetchLogs(); // Rafraîchit aussi les logs (pour voir quel code a été utilisé)
    } catch (error) {
      toast.error('Erreur lors de la génération du code.');
    } finally {
      setLoadingCode(false);
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
      {/* Header (inchangé) */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <Button variant="outline" size="icon" onClick={() => navigate('/dashboard')}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <h1 className="text-3xl font-bold" style={{ fontFamily: 'Space Grotesk, sans-serif', color: '#1e293b' }}>
              Gestion des Invités
            </h1>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8 grid md:grid-cols-3 gap-8">
        
        {/* Colonne 1: Code d'invitation */}
        <div className="md:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle>Code Actif</CardTitle>
              <CardDescription>
                Partagez ce code avec vos co-organisateurs.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {loadingCode ? (
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
              
              <Button className="w-full" onClick={handleRegenerate} disabled={loadingCode}>
                <RefreshCw className="w-4 h-4 mr-2" />
                Générer un nouveau code
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* 7. Colonne 2: Historique des connexions */}
        <div className="md:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="w-5 h-5" />
                Historique des Connexions
              </CardTitle>
              <CardDescription>
                Liste des dernières connexions réussies par des invités.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingLogs ? (
                <p>Chargement de l'historique...</p>
              ) : logs.length === 0 ? (
                <p className="text-sm text-gray-500">Aucune connexion d'invité enregistrée pour le moment.</p>
              ) : (
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nom</TableHead>
                        <TableHead>Code Utilisé</TableHead>
                        <TableHead>Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {logs.map((log) => (
                        <TableRow key={log.id}>
                          <TableCell className="font-medium">{log.name}</TableCell>
                          <TableCell><Badge variant="secondary">{log.code_used}</Badge></TableCell>
                          <TableCell>
                            {format(new Date(log.logged_in_at), 'dd/MM/yyyy à HH:mm', { locale: fr })}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

      </main>
    </div>
  );
}