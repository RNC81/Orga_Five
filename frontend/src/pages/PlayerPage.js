import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { getPlayers, createPlayer, updatePlayer, deletePlayer } from '../services/api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from '../components/ui/dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../components/ui/tooltip';
import { Card, CardContent } from '../components/ui/card'; // On importe Card
import { toast } from 'sonner';
import { Plus, Trash2, Edit, ArrowLeft, User, Star, HelpCircle } from 'lucide-react';

// État initial (inchangé)
const emptyPlayerState = {
  nom: '',
  postes: '',
  vitesse: 5,
  technique: 5,
  tir: 5,
  passe: 5,
  defense: 5,
  physique: 5,
  reflexes_gk: 1,
  plongeon_gk: 1,
  jeu_au_pied_gk: 1,
};

// Descriptions (inchangé)
const attributeDescriptions = {
  vitesse: "Explosivité et accélération sur les 3-5 premiers mètres.",
  technique: "Dribble, contrôle de balle dans les petits espaces et 1v1.",
  tir: "Précision de la frappe, finition (pointu, plat du pied) et puissance.",
  passe: "Qualité des passes (précision, force) et vision du jeu.",
  defense: "Positionnement, anticipation, tacles propres et duels 1v1.",
  physique: "Résistance aux duels, protection de balle et endurance/cardio.",
  reflexes_gk: "Arrêts sur la ligne, réactivité.",
  plongeon_gk: "Capacité à aller chercher les ballons dans les coins.",
  jeu_au_pied_gk: "Précision des relances à la main et au pied."
};

export default function PlayerPage() {
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingPlayerId, setEditingPlayerId] = useState(null);
  const [formState, setFormState] = useState(emptyPlayerState);

  const navigate = useNavigate();

  const isGardien = useMemo(() => {
    return formState.postes.toLowerCase().split(',').map(p => p.trim()).includes('gardien');
  }, [formState.postes]);

  useEffect(() => {
    fetchPlayers();
  }, []);

  const fetchPlayers = async () => {
    try {
      const response = await getPlayers();
      setPlayers(response.data);
    } catch (error) {
      toast.error('Erreur lors du chargement des joueurs');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormState(emptyPlayerState);
    setEditingPlayerId(null);
    setIsFormOpen(false);
  };

  const handleOpenForm = (player) => {
    if (player) {
      setEditingPlayerId(player.id);
      setFormState({
        nom: player.nom,
        postes: player.postes.join(', '),
        vitesse: player.vitesse,
        technique: player.technique,
        tir: player.tir,
        passe: player.passe,
        defense: player.defense,
        physique: player.physique,
        reflexes_gk: player.reflexes_gk,
        plongeon_gk: player.plongeon_gk,
        jeu_au_pied_gk: player.jeu_au_pied_gk,
      });
    } else {
      setEditingPlayerId(null);
      setFormState(emptyPlayerState);
    }
    setIsFormOpen(true);
  };
  
  const handleFormChange = (e) => {
    const { name, value, type } = e.target;
    setFormState(prev => ({
      ...prev,
      [name]: type === 'number' ? parseFloat(value) : value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const postesArray = formState.postes.split(',').map(p => p.trim()).filter(Boolean);
    if (!formState.nom || postesArray.length === 0) {
      toast.error('Veuillez remplir le nom et au moins un poste.');
      return;
    }
    const playerData = { ...formState, postes: postesArray };
    try {
      if (editingPlayerId) {
        await updatePlayer(editingPlayerId, playerData);
        toast.success('Joueur mis à jour !');
      } else {
        await createPlayer(playerData);
        toast.success('Joueur créé avec succès !');
      }
      fetchPlayers();
      resetForm();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Une erreur est survenue.');
    }
  };

  const handleDelete = async (playerId) => {
    if (!window.confirm('Êtes-vous sûr de vouloir supprimer ce joueur ?')) return;
    try {
      await deletePlayer(playerId);
      toast.success('Joueur supprimé');
      fetchPlayers();
    } catch (error) {
      toast.error('Erreur lors de la suppression');
    }
  };

  return (
    <TooltipProvider>
    <div className="min-h-screen bg-gray-50">
      {/* Header (inchangé) */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <Button variant="outline" size="icon" onClick={() => navigate('/dashboard')}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <h1 className="text-3xl font-bold" style={{ fontFamily: 'Space Grotesk, sans-serif', color: '#1e293b' }}>
              Gérer les Joueurs
            </h1>
          </div>
          <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => handleOpenForm(null)}>
                <Plus className="w-5 h-5 mr-2" />
                Ajouter un joueur
              </Button>
            </DialogTrigger>
            {/* Dialog (inchangé, on garde la classe 'max-w-md md:max-w-3xl' de l'étape 15) */}
            <DialogContent className="max-w-md md:max-w-3xl" onInteractOutside={(e) => e.preventDefault()} onEscapeKeyDown={() => resetForm()}>
              <DialogHeader>
                <DialogTitle>{editingPlayerId ? 'Modifier le joueur' : 'Ajouter un nouveau joueur'}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="max-h-[80vh] overflow-y-auto pr-4">
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <AttributeInput name="nom" label="Nom du joueur" value={formState.nom} onChange={handleFormChange} placeholder="Ex: Zinedine Zidane" isText />
                    <AttributeInput name="postes" label="Postes" value={formState.postes} onChange={handleFormChange} description="Ex: Milieu, Attaquant (séparés par une virgule)" placeholder="Gardien, Défenseur, Milieu, Attaquant" isText />
                  </div>
                  <h3 className="font-medium text-lg pt-2">Attributs de Joueur</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <AttributeInput name="vitesse" label="Vitesse" value={formState.vitesse} onChange={handleFormChange} description={attributeDescriptions.vitesse} />
                    <AttributeInput name="technique" label="Technique" value={formState.technique} onChange={handleFormChange} description={attributeDescriptions.technique} />
                    <AttributeInput name="tir" label="Tir" value={formState.tir} onChange={handleFormChange} description={attributeDescriptions.tir} />
                    <AttributeInput name="passe" label="Passe" value={formState.passe} onChange={handleFormChange} description={attributeDescriptions.passe} />
                    <AttributeInput name="defense" label="Défense" value={formState.defense} onChange={handleFormChange} description={attributeDescriptions.defense} />
                    <AttributeInput name="physique" label="Physique" value={formState.physique} onChange={handleFormChange} description={attributeDescriptions.physique} />
                  </div>
                  {isGardien && (
                    <>
                      <h3 className="font-medium text-lg pt-2 text-blue-600">Attributs de Gardien</h3>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-blue-50 rounded-lg">
                        <AttributeInput name="reflexes_gk" label="Réflexes (GK)" value={formState.reflexes_gk} onChange={handleFormChange} description={attributeDescriptions.reflexes_gk} />
                        <AttributeInput name="plongeon_gk" label="Plongeon (GK)" value={formState.plongeon_gk} onChange={handleFormChange} description={attributeDescriptions.plongeon_gk} />
                        <AttributeInput name="jeu_au_pied_gk" label="Jeu au Pied (GK)" value={formState.jeu_au_pied_gk} onChange={handleFormChange} description={attributeDescriptions.jeu_au_pied_gk} />
                      </div>
                    </>
                  )}
                </div>
                <DialogFooter className="pt-6 sticky bottom-0 bg-white">
                  <DialogClose asChild>
                    <Button type="button" variant="outline" onClick={resetForm}>Annuler</Button>
                  </DialogClose>
                  <Button type="submit">{editingPlayerId ? 'Mettre à jour' : 'Créer'}</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </header>

      {/* Main Content (Table des joueurs) */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        {loading ? (
          <p>Chargement des joueurs...</p>
        ) : players.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg shadow">
            <User className="w-16 h-16 mx-auto mb-4 text-gray-400" />
            <h3 className="text-xl font-semibold mb-2">Aucun joueur</h3>
            <p className="text-gray-600 mb-4">Commencez par ajouter votre premier joueur !</p>
            <Button onClick={() => handleOpenForm(null)}>
              <Plus className="w-4 h-4 mr-2" />
              Ajouter un joueur
            </Button>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow">
            
            {/* ### NOUVEAU : VUE MOBILE (Cartes) ### */}
            {/* `md:hidden` = visible sur mobile, caché sur desktop */}
            <div className="md:hidden space-y-3 p-3">
              {players.map((player) => (
                <Card key={player.id} className="p-4">
                  <CardContent className="p-0">
                    <div className="flex justify-between items-center mb-2">
                      <h3 className="text-lg font-bold">{player.nom}</h3>
                      <div className="flex">
                        <Button variant="ghost" size="icon" onClick={() => handleOpenForm(player)}>
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="text-red-500" onClick={() => handleDelete(player.id)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 font-bold mb-2">
                      <Star className="w-4 h-4 text-yellow-400" />
                      Général: {player.note_generale}
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {player.postes.map((poste) => (
                        <Badge key={poste} variant={poste.toLowerCase() === 'gardien' ? 'default' : 'secondary'}>{poste}</Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
            
            {/* ### NOUVEAU : VUE DESKTOP (Tableau) ### */}
            {/* `hidden md:block` = caché sur mobile, visible sur desktop */}
            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nom</TableHead>
                    <TableHead>Général</TableHead>
                    <TableHead>Postes</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {players.map((player) => (
                    <TableRow key={player.id}>
                      <TableCell className="font-medium">{player.nom}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 font-bold">
                          <Star className="w-4 h-4 text-yellow-400" />
                          {player.note_generale}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {player.postes.map((poste) => (
                            <Badge key={poste} variant={poste.toLowerCase() === 'gardien' ? 'default' : 'secondary'}>{poste}</Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" onClick={() => handleOpenForm(player)}>
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="text-red-500" onClick={() => handleDelete(player.id)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {/* ### FIN DES MODIFICATIONS ### */}
            
          </div>
        )}
      </main>
    </div>
    </TooltipProvider>
  );
}

// Composant helper (inchangé)
function AttributeInput({ name, label, value, onChange, description, isText = false, placeholder = "" }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1">
        <Label htmlFor={name}>{label}</Label>
        {description && (
          <Tooltip>
            <TooltipTrigger asChild>
              <HelpCircle className="w-4 h-4 text-gray-400 cursor-help" />
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              <p>{description}</p>
            </TooltipContent>
          </Tooltip>
        )}
      </div>
      <Input
        id={name}
        name={name}
        type={isText ? "text" : "number"}
        min={isText ? undefined : 1}
        max={isText ? undefined : 10}
        step={isText ? undefined : 0.5}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        required
      />
    </div>
  );
}