import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getEvent, getPlayers, updateEvent, generateTeams } from '../services/api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';
import { toast } from 'sonner';
import { ArrowLeft, UserPlus, UserMinus, Star, Shuffle, Save, AlertTriangle } from 'lucide-react';
import { Badge } from '../components/ui/badge'; // Nous en aurons besoin

export default function EventManagePage() {
  const { id: eventId } = useParams(); // Récupère l'ID du match depuis l'URL
  const navigate = useNavigate();

  const [event, setEvent] = useState(null);
  const [allPlayers, setAllPlayers] = useState([]);
  
  // un "Map" est plus efficace pour gérer les joueurs présents et leur note
  const [presentPlayersMap, setPresentPlayersMap] = useState(new Map()); 
  
  const [generatedTeams, setGeneratedTeams] = useState([]);
  const [warningMessage, setWarningMessage] = useState(null);
  const [loading, setLoading] = useState(true);

  // 1. Charger toutes les données au démarrage
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const [eventRes, playersRes] = await Promise.all([
          getEvent(eventId),
          getPlayers()
        ]);
        
        setEvent(eventRes.data);
        setAllPlayers(playersRes.data);
        
        // Pré-remplir la map des joueurs présents avec leurs notes temporaires
        const initialMap = new Map();
        eventRes.data.joueurs_presents.forEach(p => {
          initialMap.set(p.joueur_id, p.note_temporaire);
        });
        setPresentPlayersMap(initialMap);
        
        // Si des équipes ont déjà été générées, les afficher
        if (eventRes.data.equipes_generees && eventRes.data.equipes_generees.length > 0) {
          // (Nous allons reconstruire l'affichage des équipes)
          fetchAndDisplayTeams(eventRes.data);
        }
        
      } catch (error) {
        toast.error('Erreur lors du chargement du match.');
        navigate('/dashboard');
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [eventId, navigate]);

  // 2. Logique pour séparer les listes de joueurs
  const { presentPlayers, availablePlayers } = useMemo(() => {
    const present = allPlayers.filter(p => presentPlayersMap.has(p.id));
    const available = allPlayers.filter(p => !presentPlayersMap.has(p.id));
    return { presentPlayers: present, availablePlayers: available };
  }, [allPlayers, presentPlayersMap]);

  // 3. Actions sur les joueurs
  const addPlayer = (player) => {
    const newMap = new Map(presentPlayersMap);
    newMap.set(player.id, player.note_de_base); // Ajoute avec sa note de base
    setPresentPlayersMap(newMap);
    setGeneratedTeams([]); // Si on change les joueurs, on cache les anciennes équipes
  };

  const removePlayer = (playerId) => {
    const newMap = new Map(presentPlayersMap);
    newMap.delete(playerId);
    setPresentPlayersMap(newMap);
    setGeneratedTeams([]);
  };

  const updatePlayerNote = (playerId, note) => {
    const newMap = new Map(presentPlayersMap);
    const parsedNote = parseFloat(note) || 0;
    if (parsedNote >= 1 && parsedNote <= 10) {
      newMap.set(playerId, parsedNote);
      setPresentPlayersMap(newMap);
    }
    setGeneratedTeams([]);
  };

  // 4. Sauvegarder les changements avant de générer
  const handleSaveAndGenerate = async () => {
    setLoading(true);
    try {
      // Étape A: Mettre à jour l'événement avec la liste des présents et leurs notes
      const joueurs_presents_data = Array.from(presentPlayersMap.entries()).map(([id, note]) => ({
        joueur_id: id,
        note_temporaire: note,
      }));
      
      await updateEvent(eventId, {
        joueurs_presents: joueurs_presents_data,
        // (On ne gère pas encore les contraintes, ce sera l'étape 11)
        contraintes_affinite: [] 
      });
      toast.success('Liste des présents sauvegardée ! Lancement de la génération...');
      
      // Étape B: Appeler la génération
      const response = await generateTeams(eventId);
      setGeneratedTeams(response.data.equipes);
      setWarningMessage(response.data.warning_message);
      
      if(response.data.warning_message) {
        toast.warning(response.data.warning_message, { duration: 5000 });
      } else {
        toast.success('Équipes générées avec succès !');
      }

    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erreur lors de la génération.');
    } finally {
      setLoading(false);
    }
  };
  
  // 5. Helper pour afficher les équipes
  const fetchAndDisplayTeams = (eventData) => {
    // Cette fonction sera utilisée plus tard pour afficher les équipes déjà générées
    // Pour l'instant, on se concentre sur la génération
  };

  if (loading && !event) {
    return <div className="min-h-screen flex items-center justify-center">Chargement du match...</div>;
  }
  
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-3">
            <Button variant="outline" size="icon" onClick={() => navigate('/dashboard')}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold" style={{ fontFamily: 'Space Grotesk, sans-serif', color: '#1e293b' }}>
                {event?.nom_evenement}
              </h1>
              <p className="text-sm text-gray-500">{presentPlayers.length} joueurs présents | {event?.nombre_equipes} équipes</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* (On ajoutera un bouton Sauvegarder plus tard) */}
            <Button size="lg" onClick={handleSaveAndGenerate} disabled={loading}>
              <Shuffle className="w-5 h-5 mr-2" />
              Sauvegarder et Générer les Équipes
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content (2 colonnes) */}
      <main className="max-w-7xl mx-auto px-4 py-8 grid lg:grid-cols-2 gap-8">
        
        {/* Colonne 1: Listes des Joueurs */}
        <div className="space-y-8">
          {/* Joueurs Présents */}
          <Card>
            <CardHeader>
              <CardTitle>Joueurs Présents ({presentPlayers.length})</CardTitle>
              <CardDescription>Ajustez la note temporaire si un joueur est blessé ou en retour de vacances.</CardDescription>
            </CardHeader>
            <CardContent>
              <PlayerTable
                players={presentPlayers}
                notes={presentPlayersMap}
                actionIcon={<UserMinus className="w-4 h-4" />}
                onActionClick={(player) => removePlayer(player.id)}
                onNoteChange={updatePlayerNote}
              />
            </CardContent>
          </Card>
          
          {/* Joueurs Disponibles */}
          <Card>
            <CardHeader>
              <CardTitle>Joueurs Disponibles ({availablePlayers.length})</CardTitle>
              <CardDescription>Cliquez pour ajouter un joueur à la liste des présents.</CardDescription>
            </CardHeader>
            <CardContent>
              <PlayerTable
                players={availablePlayers}
                actionIcon={<UserPlus className="w-4 h-4" />}
                onActionClick={addPlayer}
              />
            </CardContent>
          </Card>
        </div>

        {/* Colonne 2: Équipes Générées */}
        <div className="space-y-8">
          <Card className="sticky top-[120px]">
            <CardHeader>
              <CardTitle>Équipes Générées</CardTitle>
            </CardHeader>
            <CardContent>
              {warningMessage && (
                <div className="mb-4 p-3 rounded-md bg-yellow-50 border border-yellow-200 text-yellow-700 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  <span className="text-sm">{warningMessage}</span>
                </div>
              )}
              
              {generatedTeams.length === 0 ? (
                <p className="text-center text-gray-500 py-8">
                  Cliquez sur "Générer les Équipes" une fois vos joueurs présents sélectionnés.
                </p>
              ) : (
                <div className="grid gap-6" style={{ gridTemplateColumns: `repeat(${generatedTeams.length}, 1fr)` }}>
                  {generatedTeams.map((team, index) => (
                    <div key={index} className="p-4 bg-gray-50 rounded-lg">
                      <h4 className="font-bold text-lg mb-2">Équipe {index + 1}</h4>
                      <p className="text-sm text-gray-600 font-medium mb-1">
                        Note Moyenne: <span className="text-blue-600">{team.note_moyenne}</span>
                      </p>
                      <ul className="space-y-2 mt-3">
                        {team.joueurs.map((player) => (
                          <li key={player.id} className="text-sm p-2 bg-white rounded shadow-sm flex justify-between items-center">
                            <span>{player.nom}</span>
                            <span className="text-xs font-bold text-gray-500">{player.note}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
        
      </main>
    </div>
  );
}

// Composant réutilisable pour les listes de joueurs
function PlayerTable({ players, notes, actionIcon, onActionClick, onNoteChange }) {
  return (
    <div className="max-h-96 overflow-y-auto border rounded-lg">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nom</TableHead>
            <TableHead>Note</TableHead>
            {onNoteChange && <TableHead>Note (Temp.)</TableHead>}
            <TableHead className="text-right">Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {players.length === 0 ? (
            <TableRow>
              <TableCell colSpan={onNoteChange ? 4 : 3} className="text-center text-gray-500">
                {onNoteChange ? "Aucun joueur présent" : "Aucun joueur disponible"}
              </TableCell>
            </TableRow>
          ) : (
            players.map((player) => (
              <TableRow key={player.id}>
                <TableCell className="font-medium">{player.nom}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <Star className="w-4 h-4 text-gray-300" />
                    {player.note_de_base}
                  </div>
                </TableCell>
                {onNoteChange && (
                  <TableCell>
                    <Input
                      type="number"
                      min="1"
                      max="10"
                      step="0.5"
                      className="w-20 h-8"
                      value={notes.get(player.id) || ''}
                      onChange={(e) => onNoteChange(player.id, e.target.value)}
                    />
                  </TableCell>
                )}
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon" onClick={() => onActionClick(player)}>
                    {actionIcon}
                  </Button>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}