import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getEvents, deleteEvent } from '../services/api';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { toast } from 'sonner';
import { Plus, Calendar, Users, Trash2, Eye, LogOut, UserCog } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

export default function Dashboard() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    try {
      const response = await getEvents();
      // On trie les événements du plus récent au plus ancien
      setEvents(response.data.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)));
    } catch (error) {
      toast.error('Erreur lors du chargement des événements');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (eventId) => {
    if (!window.confirm('Êtes-vous sûr de vouloir supprimer cet événement ?')) return;

    try {
      await deleteEvent(eventId);
      toast.success('Événement supprimé');
      fetchEvents(); // Rafraîchit la liste
    } catch (error) {
      toast.error('Erreur lors de la suppression');
    }
  };

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(to bottom, #f0fdf4, #dbeafe)' }}>
      
      {/* ### HEADER MODIFIÉ ### */}
      <header className="bg-white shadow-sm border-b">
        {/*
          MODIFICATIONS :
          - flex-col md:flex-row : Empile verticalement sur mobile, horizontalement sur ordinateur
          - items-start md:items-center : Aligne à gauche sur mobile, au centre sur ordinateur
          - gap-4 : Ajoute de l'espace quand c'est empilé
        */}
        <div className="max-w-7xl mx-auto px-4 py-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          
          {/* Logo (inchangé) */}
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #10b981 0%, #3b82f6 100%)' }}>
              <Users className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-3xl font-bold" style={{ fontFamily: 'Space Grotesk, sans-serif', color: '#1e293b' }}>FutTeams</h1>
          </div>
          
          {/*
            MODIFICATIONS :
            - flex-col sm:flex-row : Empile les boutons verticalement sur petit écran, horizontalement sur + grand
            - items-stretch sm:items-center : Les boutons prennent toute la largeur sur petit écran
            - w-full md:w-auto : Prend toute la largeur sur mobile, taille auto sur ordinateur
          */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full md:w-auto">
            <span className="text-sm text-gray-600 px-2 py-2 text-center sm:text-left">{user?.email}</span>
            {user?.role === 'admin' && (
              <Button variant="outline" onClick={() => navigate('/users')} data-testid="manage-users-button">
                <UserCog className="w-4 h-4 mr-2" />
                Gérer les Invités
              </Button>
            )}
            <Button variant="outline" onClick={() => navigate('/players')} data-testid="manage-players-button">
              <Users className="w-4 h-4 mr-2" />
              Gérer les Joueurs
            </Button>
            <Button variant="ghost" onClick={logout} data-testid="logout-button">
              <LogOut className="w-4 h-4 mr-2" />
              Déconnexion
            </Button>
          </div>
        </div>
      </header>
      {/* ### FIN DES MODIFICATIONS DU HEADER ### */}


      {/* Main Content (inchangé, il était déjà responsive) */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
          <div>
            <h2 className="text-4xl font-bold mb-2" style={{ fontFamily: 'Space Grotesk, sans-serif', color: '#1e293b' }}>Mes Matchs</h2>
            <p className="text-gray-600" style={{ fontFamily: 'Inter, sans-serif' }}>Créez et gérez vos événements de football</p>
          </div>
          <Button 
            onClick={() => navigate('/events/create')} 
            size="lg"
            data-testid="create-match-button"
            className="shadow-lg w-full sm:w-auto"
            style={{ background: 'linear-gradient(135deg, #10b981 0%, #3b82f6 100%)' }}
          >
            <Plus className="w-5 h-5 mr-2" />
            Créer un nouveau match
          </Button>
        </div>

        {loading ? (
          <div className="text-center py-12">Chargement...</div>
        ) : events.length === 0 ? (
          <Card className="text-center py-12">
            <CardContent>
              <Calendar className="w-16 h-16 mx-auto mb-4 text-gray-400" />
              <h3 className="text-xl font-semibold mb-2">Aucun match créé</h3>
              <p className="text-gray-600 mb-4">Commencez par créer votre premier match !</p>
              <Button onClick={() => navigate('/events/create')} data-testid="create-first-match-button">
                <Plus className="w-4 h-4 mr-2" />
                Créer un match
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {events.map((event) => (
              <Card key={event.id} className="hover:shadow-lg transition-all" data-testid={`event-card-${event.id}`}>
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-xl mb-2" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>{event.nom_evenement}</CardTitle>
                      <p className="text-sm text-gray-500">
                        {format(new Date(event.created_at), 'dd MMMM yyyy', { locale: fr })}
                      </p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 mb-4">
                    <div className="flex items-center text-sm text-gray-600">
                      <Users className="w-4 h-4 mr-2" />
                      {event.joueurs_presents?.length || 0} joueurs
                    </div>
                    <div className="flex items-center text-sm text-gray-600">
                      <Calendar className="w-4 h-4 mr-2" />
                      {event.nombre_equipes} équipes
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      variant="default" 
                      size="sm" 
                      className="flex-1"
                      onClick={() => navigate(`/events/${event.id}`)}
                      data-testid={`view-event-${event.id}`}
                    >
                      <Eye className="w-4 h-4 mr-1" />
                      Gérer
                    </Button>
                    <Button 
                      variant="destructive" 
                      size="sm"
                      onClick={() => handleDelete(event.id)}
                      data-testid={`delete-event-${event.id}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}