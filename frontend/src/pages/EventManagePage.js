import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getEvent, getPlayers, updateEvent, generateTeams } from '../services/api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select'; // Importation de Select
import { toast } from 'sonner';
import { ArrowLeft, UserPlus, UserMinus, Star, Shuffle, AlertTriangle, Link, Link2Off, Trash2 } from 'lucide-react';
import { Badge } from '../components/ui/badge';

export default function EventManagePage() {
  const { id: eventId } = useParams();
  const navigate = useNavigate();

  const [event, setEvent] = useState(null);
  const [allPlayers, setAllPlayers] = useState([]);
  const [presentPlayersMap, setPresentPlayersMap] = useState(new Map());
  
  // NOUVEL ÉTAT pour les contraintes
  const [constraints, setConstraints] = useState([]); // ex: [{id: 1, type: 'lier', joueurs: [id1, id2]}]
  
  const [generatedTeams, setGeneratedTeams] = useState([]);
  const [warningMessage, setWarningMessage] = useState(null);
  const [loading, setLoading] = useState(true);

  // 1. Charger toutes les données
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
        
        const initialMap = new Map();
        eventRes.data.joueurs_presents.forEach(p => {
          initialMap.set(p.joueur_id, p.note_temporaire);
        });
        setPresentPlayersMap(initialMap);
        
        // Pré-remplir les contraintes
        setConstraints(eventRes.data.contraintes_affinite.map((c, i) => ({...c, id: i})));
        
        if (eventRes.data.equipes_generees && eventRes.data.equipes_generees.length > 0) {
          rebuildTeamData(eventRes.data.equipes_generees, playersRes.data, initialMap);
          setWarningMessage(eventRes.data.warning_message);
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
  
  const rebuildTeamData = (teamIdsList, allPlayersData, notesMap) => {
    const teams = teamIdsList.map(teamIds => {
      const teamPlayers = teamIds.map(id => {
        const player = allPlayersData.find(p => p.id === id);
        return {
          ...player,
          note: notesMap.get(id) || player.note_generale,
        };
      });
      const teamNotes = teamPlayers.map(p => p.note);
      const avgNote = teamNotes.reduce((a, b) => a + b, 0) / teamNotes.length;
      return {
        joueurs: teamPlayers,
        note_moyenne: avgNote.toFixed(1)
      };
    });
    setGeneratedTeams(teams);
  };

  // 2. Logique pour les listes de joueurs
  const { presentPlayers, availablePlayers } = useMemo(() => {
    const present = allPlayers.filter(p => presentPlayersMap.has(p.id));
    const available = allPlayers.filter(p => !presentPlayersMap.has(p.id));
    return { presentPlayers: present, availablePlayers: available };
  }, [allPlayers, presentPlayersMap]);

  // 3. Actions sur les joueurs
  const addPlayer = (player) => {
    const newMap = new Map(presentPlayersMap);
    newMap.set(player.id, player.note_generale);
    setPresentPlayersMap(newMap);
    setGeneratedTeams([]);
  };

  const removePlayer = (playerId) => {
    const newMap = new Map(presentPlayersMap);
    newMap.delete(playerId);
    setPresentPlayersMap(newMap);
    // On retire aussi les contraintes qui impliquaient ce joueur
    setConstraints(prev => prev.filter(c => !c.joueurs.includes(playerId)));
    setGeneratedTeams([]);
  };

  const updatePlayerNote = (playerId, note) => {
    const newMap = new Map(presentPlayersMap);
    const parsedNote = parseFloat(note) || 0;
    if (parsedNote >= 1 && parsedNote <= 10) {
      newMap.set(playerId, parsedNote);
    } else {
      newMap.set(playerId, 0);
    }
    setPresentPlayersMap(newMap);
    setGeneratedTeams([]);
  };

  // 4. NOUVELLES Actions sur les contraintes
  const addConstraint = (type, player1Id, player2Id) => {
    if (!player1Id || !player2Id || player1Id === player2Id) {
      toast.error("Veuillez sélectionner deux joueurs différents.");
      return;
    }
    const newConstraint = {
      id: Date.now(), // ID simple pour la liste
      type: type,
      joueurs: [player1Id, player2Id]
    };
    setConstraints(prev => [...prev, newConstraint]);
    setGeneratedTeams([]);
  };

  const removeConstraint = (id) => {
    setConstraints(prev => prev.filter(c => c.id !== id));
    setGeneratedTeams([]);
  };

  // 5. MODIFICATION de la Sauvegarde
  const handleSaveAndGenerate = async () => {
    setLoading(true);
    try {
      const joueurs_presents_data = Array.from(presentPlayersMap.entries()).map(([id, note]) => ({
        joueur_id: id,
        note_temporaire: note,
      }));
      
      // Préparer les contraintes pour l'API
      const contraintes_affinite_data = constraints.map(c => ({
        type: c.type,
        joueurs: c.joueurs
      }));
      
      await updateEvent(eventId, {
        joueurs_presents: joueurs_presents_data,
        contraintes_affinite: contraintes_affinite_data // On envoie les contraintes
      });
      toast.success('Liste des présents et contraintes sauvegardées ! Lancement...');
      
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
  
  if (loading && !event) {
    return <div className="min-h-screen flex items-center justify-center">Chargement du match...</div>;
  }
  
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header (inchangé) */}
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
              <p className="text-sm text-gray-500">{presentPlayers.length} joueurs présents | {event?.nombre_equipes} équipes | {constraints.length} contraintes</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button size="lg" onClick={handleSaveAndGenerate} disabled={loading || presentPlayers.length === 0}>
              <Shuffle className="w-5 h-5 mr-2" />
              {loading ? "Génération..." : "Sauvegarder et Générer les Équipes"}
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content (2 colonnes) */}
      <main className="max-w-7xl mx-auto px-4 py-8 grid lg:grid-cols-2 gap-8">
        
        {/* Colonne 1: Listes des Joueurs */}
        <div className="space-y-8">
          
          {/* NOUVELLE Card: Contraintes */}
          <Card>
            <CardHeader>
              <CardTitle>Contraintes d'Affinité</CardTitle>
              <CardDescription>Forcez 2 joueurs à être ensemble ou séparez-les.</CardDescription>
            </CardHeader>
            <CardContent>
              <AffinityManager
                players={presentPlayers}
                constraints={constraints}
                onAdd={addConstraint}
                onRemove={removeConstraint}
              />
            </CardContent>
          </Card>

          {/* Joueurs Présents */}
          <Card>
            <CardHeader>
              <CardTitle>Joueurs Présents ({presentPlayers.length})</CardTitle>
              <CardDescription>Ajustez la note "Générale" si besoin pour ce match.</CardDescription>
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

        {/* Colonne 2: Équipes Générées (inchangée) */}
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
                <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${generatedTeams.length > 3 ? 3 : generatedTeams.length}, 1fr)` }}>
                  {generatedTeams.map((team, index) => (
                    <div key={index} className="p-3 bg-gray-50 rounded-lg border">
                      <h4 className="font-bold text-lg mb-2">Équipe {index + 1}</h4>
                      <p className="text-sm text-gray-600 font-medium mb-3">
                        Note Moyenne: <span className="text-blue-600 font-bold">{team.note_moyenne}</span>
                      </p>
                      <ul className="space-y-2">
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

// Composant Table (inchangé)
function PlayerTable({ players, notes, actionIcon, onActionClick, onNoteChange }) {
  return (
    <div className="max-h-96 overflow-y-auto border rounded-lg">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nom</TableHead>
            <TableHead>Général</TableHead>
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
                  <div className="flex items-center gap-1 font-bold">
                    <Star className="w-4 h-4 text-yellow-400" />
                    {player.note_generale}
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
                      placeholder={String(player.note_generale)}
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

// NOUVEAU composant pour gérer les affinités
function AffinityManager({ players, constraints, onAdd, onRemove }) {
  const [player1, setPlayer1] = useState('');
  const [player2, setPlayer2] = useState('');

  // Pour afficher le nom du joueur dans la liste des contraintes
  const getPlayerName = (id) => allPlayers.find(p => p.id === id)?.nom || '???';
  
  // (Note: on utilise 'players' qui est la liste des présents)
  const allPlayers = players; 

  const handleAdd = (type) => {
    onAdd(type, player1, player2);
    setPlayer1('');
    setPlayer2('');
  };

  return (
    <div className="space-y-4">
      {/* Formulaire d'ajout */}
      <div className="flex flex-col md:flex-row gap-2">
        <Select value={player1} onValueChange={setPlayer1}>
          <SelectTrigger><SelectValue placeholder="Joueur 1" /></SelectTrigger>
          <SelectContent>
            {players.map(p => <SelectItem key={p.id} value={p.id}>{p.nom}</SelectItem>)}
          </SelectContent>
        </Select>
        
        <Select value={player2} onValueChange={setPlayer2}>
          <SelectTrigger><SelectValue placeholder="Joueur 2" /></SelectTrigger>
          <SelectContent>
            {players.map(p => <SelectItem key={p.id} value={p.id}>{p.nom}</SelectItem>)}
          </SelectContent>
        </Select>
        
        <div className="flex gap-2">
          <Button onClick={() => handleAdd('lier')} className="bg-green-600 hover:bg-green-700 flex-1">
            <Link className="w-4 h-4" />
          </Button>
          <Button onClick={() => handleAdd('separer')} className="bg-red-600 hover:bg-red-700 flex-1">
            <Link2Off className="w-4 h-4" />
          </Button>
        </div>
      </div>
      
      {/* Liste des contraintes actuelles */}
      <div className="space-y-2">
        <Label>Contraintes Actives</Label>
        {constraints.length === 0 ? (
          <p className="text-sm text-gray-500">Aucune contrainte pour ce match.</p>
        ) : (
          <ul className="space-y-1">
            {constraints.map(c => (
              <li key={c.id} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                <div className="flex items-center gap-2">
                  {c.type === 'lier' ? 
                    <Link className="w-4 h-4 text-green-600" /> : 
                    <Link2Off className="w-4 h-4 text-red-600" />
                  }
                  <span className="text-sm font-medium">{getPlayerName(c.joueurs[0])}</span>
                  <span className="text-sm text-gray-500">{c.type === 'lier' ? 'avec' : 'sans'}</span>
                  <span className="text-sm font-medium">{getPlayerName(c.joueurs[1])}</span>
                </div>
                <Button variant="ghost" size="icon" onClick={() => onRemove(c.id)}>
                  <Trash2 className="w-4 h-4 text-gray-500" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}