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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { toast } from 'sonner';
import {
  ArrowLeft, UserPlus, UserMinus, Star, Shuffle, AlertTriangle,
  Link, Link2Off, Trash2, ClipboardCopy, GripVertical, SortAsc // Ajout de SortAsc
} from 'lucide-react';
import { Badge } from '../components/ui/badge';

// Imports pour le Drag and Drop (DND)
import {
  DndContext,
  closestCorners,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
} from '@dnd-kit/core';
import {
  useDroppable,
} from '@dnd-kit/core';
import {
  useSortable,
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// Fonction helper pour recalculer la moyenne d'une équipe
const calculateTeamAvg = (team) => {
  if (!team || team.joueurs.length === 0) {
    return '0.0'; // Retourne un string
  }
  const totalNote = team.joueurs.reduce((acc, p) => acc + (p.note || 0), 0);
  return (totalNote / team.joueurs.length).toFixed(1); // Arrondi à 1 décimale
};

export default function EventManagePage() {
  const { id: eventId } = useParams();
  const navigate = useNavigate();

  const [event, setEvent] = useState(null);
  const [allPlayers, setAllPlayers] = useState([]);
  const [presentPlayersMap, setPresentPlayersMap] = useState(new Map());
  const [constraints, setConstraints] = useState([]);
  const [generatedTeams, setGeneratedTeams] = useState([]);
  const [warningMessage, setWarningMessage] = useState(null);
  const [loading, setLoading] = useState(true);

  // État pour le Drag and Drop
  const [activePlayer, setActivePlayer] = useState(null);
  const sensors = useSensors(useSensor(PointerSensor));

  // ### NOUVEL ÉTAT POUR LE TRI DES ÉQUIPES ###
  const [teamSortCriteria, setTeamSortCriteria] = useState('note-desc'); // Par défaut: Note (Décroissante)

  // 1. Charger toutes les données (inchangé)
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
  
  // (fonction rebuildTeamData modifiée pour ajouter l'ID stable)
  const rebuildTeamData = (teamIdsList, allPlayersData, notesMap) => {
    const teams = teamIdsList.map((teamIds, index) => {
      const teamPlayers = teamIds.map(id => {
        const player = allPlayersData.find(p => p.id === id);
        return {
          ...player,
          note: notesMap.get(id) || player.note_generale,
        };
      });
      return {
        id: `team-${index}`,
        joueurs: teamPlayers,
        note_moyenne: calculateTeamAvg({joueurs: teamPlayers})
      };
    });
    setGeneratedTeams(teams);
  };

  // 2. Logique pour les listes de joueurs (inchangée)
  const { presentPlayers, availablePlayers } = useMemo(() => {
    const present = allPlayers.filter(p => presentPlayersMap.has(p.id));
    const available = allPlayers.filter(p => !presentPlayersMap.has(p.id));
    return { presentPlayers: present, availablePlayers: available };
  }, [allPlayers, presentPlayersMap]);

  // 3. Actions sur les joueurs (inchangées)
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

  // 4. Actions sur les contraintes (inchangées)
  const addConstraint = (type, player1Id, player2Id) => {
    if (!player1Id || !player2Id || player1Id === player2Id) {
      toast.error("Veuillez sélectionner deux joueurs différents.");
      return;
    }
    const newConstraint = { id: Date.now(), type: type, joueurs: [player1Id, player2Id] };
    setConstraints(prev => [...prev, newConstraint]);
    setGeneratedTeams([]);
  };
  const removeConstraint = (id) => {
    setConstraints(prev => prev.filter(c => c.id !== id));
    setGeneratedTeams([]);
  };

  // 5. Sauvegarde et Génération (inchangée)
  const handleSaveAndGenerate = async () => {
    setLoading(true);
    try {
      const joueurs_presents_data = Array.from(presentPlayersMap.entries()).map(([id, note]) => ({
        joueur_id: id,
        note_temporaire: note,
      }));
      const contraintes_affinite_data = constraints.map(c => ({
        type: c.type,
        joueurs: c.joueurs
      }));
      
      await updateEvent(eventId, {
        joueurs_presents: joueurs_presents_data,
        contraintes_affinite: contraintes_affinite_data,
        equipes_generees: [] 
      });
      toast.success('Liste des présents et contraintes sauvegardées ! Lancement...');
      
      const response = await generateTeams(eventId);
      
      const teamsWithIds = response.data.equipes.map((team, index) => ({
        ...team,
        id: `team-${index}`
      }));
      setGeneratedTeams(teamsWithIds);
      
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

  // 6. Fonctions Drag and Drop (inchangées)
  const handleDragStart = (event) => {
    const { active } = event;
    const player = presentPlayers.find(p => p.id === active.id);
    setActivePlayer(player);
  };
  
  const handleDragEnd = (event) => {
    const { active, over } = event;
    setActivePlayer(null);
    if (!active || !over) return;
    const activePlayerId = active.id;
    const sourceTeam = generatedTeams.find(t => t.joueurs.some(p => p.id === activePlayerId));
    const destTeam = generatedTeams.find(t => t.id === over.id || t.joueurs.some(p => p.id === over.id));
    if (!sourceTeam || !destTeam || sourceTeam.id === destTeam.id) {
      return;
    }
    const playerToMove = sourceTeam.joueurs.find(p => p.id === activePlayerId);
    if (!playerToMove) return;

    setGeneratedTeams(prevTeams => {
      const newTeams = prevTeams.map(team => {
        if (team.id === sourceTeam.id) {
          return { ...team, joueurs: team.joueurs.filter(p => p.id !== activePlayerId) };
        }
        if (team.id === destTeam.id) {
          return { ...team, joueurs: [...team.joueurs, playerToMove] };
        }
        return team;
      });
      return newTeams.map(team => ({
        ...team,
        note_moyenne: calculateTeamAvg(team),
      }));
    });
    toast.info('Équipes ajustées manuellement. L\'équilibre a changé.');
  };
  
  const handleDragCancel = () => {
    setActivePlayer(null);
  };

  // 7. Fonction Copier Presse-papiers (MODIFIÉE pour utiliser le tri)
  const handleCopyToClipboard = () => {
    if (generatedTeams.length === 0) {
      toast.error("Aucune équipe à copier !");
      return;
    }
    
    const text = generatedTeams.map((team, index) => {
      const header = `--- ÉQUIPE ${index + 1} (Moy: ${team.note_moyenne}) ---`;
      
      // Applique le tri avant de copier
      const sortedJoueurs = team.joueurs.slice().sort((a, b) => {
        if (teamSortCriteria === 'note-desc') return b.note - a.note;
        if (teamSortCriteria === 'note-asc') return a.note - b.note;
        if (teamSortCriteria === 'nom-asc') return a.nom.localeCompare(b.nom);
        return 0;
      });

      const playerLines = sortedJoueurs
        .map(p => `- ${p.nom} (Gén: ${p.note})`)
        .join('\n');
      return header + '\n' + playerLines;
    }).join('\n\n');
    
    navigator.clipboard.writeText(text);
    toast.success('Équipes copiées dans le presse-papiers !');
  };

  if (loading && !event) {
    return <div className="min-h-screen flex items-center justify-center">Chargement du match...</div>;
  }
  
  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div className="min-h-screen bg-gray-50">
        {/* Header (inchangé) */}
        <header className="bg-white shadow-sm border-b sticky top-0 z-10">
          <div className="max-w-7xl mx-auto px-4 py-4 flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-3">
              <Button variant="outline" size="icon" onClick={() => navigate('/dashboard')}>
                <ArrowLeft className="w-4 h-4" />
              </Button>
              <div>
                <h1 className="text-xl md:text-3xl font-bold" style={{ fontFamily: 'Space Grotesk, sans-serif', color: '#1e293b' }}>
                  {event?.nom_evenement}
                </h1>
                <p className="text-sm text-gray-500">{presentPlayers.length} joueurs présents | {event?.nombre_equipes} équipes | {constraints.length} contraintes</p>
              </div>
            </div>
            <div className="flex items-center gap-3 w-full md:w-auto">
              <Button size="lg" onClick={handleSaveAndGenerate} disabled={loading || presentPlayers.length === 0} className="w-full md:w-auto">
                <Shuffle className="w-5 h-5 mr-2" />
                {loading ? "Génération..." : "Sauvegarder et Générer"}
              </Button>
            </div>
          </div>
        </header>

        {/* Main Content (inchangé) */}
        <main className="max-w-7xl mx-auto px-4 py-8 grid md:grid-cols-2 gap-8">
          
          <div className="space-y-8">
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

          {/* Colonne 2: Équipes Générées (MODIFIÉ) */}
          <div className="space-y-8">
            <Card className="sticky top-[120px]">
              <CardHeader>
                {/* ### MODIFIÉ : Ajout du bouton Copier et du menu de Tri ### */}
                <div className="flex flex-col sm:flex-row justify-between items-center gap-2">
                  <CardTitle>Équipes Générées</CardTitle>
                  {generatedTeams.length > 0 && (
                    <div className="flex gap-2 w-full sm:w-auto">
                      <Select value={teamSortCriteria} onValueChange={setTeamSortCriteria}>
                        <SelectTrigger className="w-full flex-1">
                          <SortAsc className="w-4 h-4 mr-2" />
                          <SelectValue placeholder="Trier par..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="note-desc">Note (Décroissante)</SelectItem>
                          <SelectItem value="note-asc">Note (Croissante)</SelectItem>
                          <SelectItem value="nom-asc">Nom (A-Z)</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button variant="outline" size="icon" onClick={handleCopyToClipboard}>
                        <ClipboardCopy className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                </div>
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
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-1 lg:grid-cols-2 gap-4">
                    {generatedTeams.map((team) => (
                      // ### MODIFIÉ : Passe le critère de tri à la colonne ###
                      <DroppableTeamColumn 
                        key={team.id} 
                        id={team.id} 
                        team={team}
                        sortCriteria={teamSortCriteria}
                      >
                        {team.joueurs.map((player) => (
                          <DraggablePlayerItem key={player.id} player={player} />
                        ))}
                      </DroppableTeamColumn>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </main>
        
        <DragOverlay>
          {activePlayer ? (
            <PlayerItem player={activePlayer} isDragging />
          ) : null}
        </DragOverlay>
        
      </div>
    </DndContext>
  );
}


// ### MODIFIÉ : Le composant accepte 'sortCriteria' ###
function DroppableTeamColumn({ id, team, children, sortCriteria }) {
  const { setNodeRef, isOver } = useDroppable({ 
    id: id,
    data: { type: 'team-column' } 
  });
  
  // ### NOUVEAU : Tri des enfants avant de les passer à SortableContext ###
  const sortedPlayerIds = useMemo(() => {
    return team.joueurs
      .slice() // Crée une copie
      .sort((a, b) => {
        if (sortCriteria === 'note-desc') return b.note - a.note;
        if (sortCriteria === 'note-asc') return a.note - b.note;
        if (sortCriteria === 'nom-asc') return a.nom.localeCompare(b.nom);
        return 0;
      })
      .map(p => p.id); // On ne passe que les IDs à SortableContext
  }, [team.joueurs, sortCriteria]);

  return (
    <div 
      ref={setNodeRef}
      className={`p-3 bg-gray-50 rounded-lg border min-h-40 ${isOver ? 'border-blue-500 ring-2 ring-blue-200' : 'border'}`}
    >
      <h4 className="font-bold text-lg mb-2">Équipe {parseInt(id.split('-')[1]) + 1}</h4>
      <p className="text-sm text-gray-600 font-medium mb-3">
        Note Moyenne: <span className="text-blue-600 font-bold">{team.note_moyenne}</span>
      </p>
      
      {/* On passe les IDs triés à SortableContext */}
      <SortableContext items={sortedPlayerIds} strategy={verticalListSortingStrategy}>
        <ul className="space-y-2">
          {/* On affiche les joueurs dans l'ordre trié */}
          {sortedPlayerIds.map(playerId => {
            const player = team.joueurs.find(p => p.id === playerId);
            return <DraggablePlayerItem key={player.id} player={player} />;
          })}
        </ul>
      </SortableContext>
    </div>
  );
}

// Composant DraggablePlayerItem (inchangé)
function DraggablePlayerItem({ player }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: player.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    touchAction: 'none',
  };

  return (
    <li ref={setNodeRef} style={style} {...attributes}>
      <PlayerItem player={player} listeners={listeners} />
    </li>
  );
}

// Composant PlayerItem (inchangé)
function PlayerItem({ player, isDragging = false, listeners }) {
  return (
    <div
      className={`text-sm p-2 bg-white rounded shadow-sm flex justify-between items-center ${isDragging ? 'opacity-80' : ''}`}
    >
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" className="cursor-grab" {...listeners}>
          <GripVertical className="w-4 h-4 text-gray-400" />
        </Button>
        <span>{player.nom}</span>
      </div>
      <span className="text-xs font-bold text-gray-500">{player.note}</span>
    </div>
  );
}


// --- Composant PlayerTable (inchangé) ---
function PlayerTable({ players, notes, actionIcon, onActionClick, onNoteChange }) {
  return (
    <>
      <div className="hidden md:block max-h-96 overflow-y-auto border rounded-lg">
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
      <div className="md:hidden space-y-3 max-h-96 overflow-y-auto">
        {players.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-4">
            {onNoteChange ? "Aucun joueur présent" : "Aucun joueur disponible"}
          </p>
        ) : (
          players.map((player) => (
            <Card key={player.id} className="p-3">
              <CardContent className="p-0 flex justify-between items-center">
                <div className="flex-1 space-y-2">
                  <h4 className="font-bold">{player.nom}</h4>
                  <div className="flex items-center gap-1 text-sm font-bold">
                    <Star className="w-4 h-4 text-yellow-400" />
                    Gén: {player.note_generale}
                  </div>
                  {onNoteChange && (
                    <div className="flex items-center gap-2 pt-1">
                      <Label htmlFor={`note-${player.id}`} className="text-xs">Note Match:</Label>
                      <Input
                        id={`note-${player.id}`}
                        type="number" min="1" max="10" step="0.5"
                        className="w-20 h-8"
                        value={notes.get(player.id) || ''}
                        placeholder={String(player.note_generale)}
                        onChange={(e) => onNoteChange(player.id, e.target.value)}
                      />
                    </div>
                  )}
                </div>
                <div className="shrink-0">
                  <Button variant="ghost" size="icon" onClick={() => onActionClick(player)}>
                    {actionIcon}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </>
  );
}

// --- Composant AffinityManager (inchangé) ---
function AffinityManager({ players, constraints, onAdd, onRemove }) {
  const [player1, setPlayer1] = useState('');
  const [player2, setPlayer2] = useState('');
  const getPlayerName = (id) => allPlayers.find(p => p.id === id)?.nom || '???';
  const allPlayers = players; 
  const handleAdd = (type) => {
    onAdd(type, player1, player2);
    setPlayer1('');
    setPlayer2('');
  };
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="grid grid-cols-2 gap-2">
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
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Button onClick={() => handleAdd('lier')} className="bg-green-600 hover:bg-green-700 w-full">
            <Link className="w-4 h-4 mr-2" /> Lier
          </Button>
          <Button onClick={() => handleAdd('separer')} className="bg-red-600 hover:bg-red-700 w-full">
            <Link2Off className="w-4 h-4 mr-2" /> Séparer
          </Button>
        </div>
      </div>
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