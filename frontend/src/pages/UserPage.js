import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getGuestCode, regenerateGuestCode, getGuestLogs } from '../services/api';
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
} from '../components/ui/table';
import { toast } from 'sonner';
import { ArrowLeft, KeyRound, RefreshCw, Copy, History } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';

export default function UserPage() {
  const [code, setCode] = useState(null);
  const [expiresAt, setExpiresAt] = useState(null);
  const [logs, setLogs] = useState([]);
  const [loadingCode, setLoadingCode] = useState(true);
  const [loadingLogs, setLoadingLogs] = useState(true);

  const navigate = useNavigate();

  useEffect(() => {
    fetchCode();
    fetchLogs();
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
      fetchLogs();
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
            <h1 className="text-xl md:text-3xl font-bold" style={{ fontFamily: 'Space Grotesk, sans-serif', color: '#1e293b' }}>
              Gestion des Invités
            </h1>
          </div>
        </div>
      </header>

      {/* Main Content (MODIFIÉ : md:grid-cols-3 -> md:grid-cols-1 lg:grid-cols-3) */}
      <main className="max-w-7xl mx-auto px-4 py-8 grid md:grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Colonne 1: Code d'invitation (MODIFIÉ : md:col-span-1 -> lg:col-span-1) */}
        <div className="lg:col-span-1">
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

        {/* Colonne 2: Historique (MODIFIÉ : md:col-span-2 -> lg:col-span-2) */}
        <div className="lg:col-span-2">
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
                <div>

                  {/* ### NOUVEAU : VUE MOBILE (Cartes) ### */}
                  {/* `md:hidden` = visible sur mobile, caché sur desktop */}
                  <div className="md:hidden space-y-3">
                    {logs.map((log) => (
                      <Card key={log.id} className="p-3">
                        <CardContent className="p-0">
                          <h4 className="font-bold">{log.name}</h4>
                          <p className="text-sm text-gray-600">
                            {format(new Date(log.logged_in_at), 'dd/MM/yyyy à HH:mm', { locale: fr })}
                          </p>
                          <Badge variant="secondary" className="mt-2">Code: {log.code_used}</Badge>
                        </CardContent>
                      </Card>
                    ))}
                  </div>

                  {/* ### NOUVEAU : VUE DESKTOP (Tableau) ### */}
                  {/* `hidden md:block` = caché sur mobile, visible sur desktop */}
                  <div className="hidden md:block border rounded-lg">
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
                  {/* ### FIN DES MODIFICATIONS ### */}

                </div>
              )}
            </CardContent>
          </Card>
        </div>

      </main>
    </div>
  );
}