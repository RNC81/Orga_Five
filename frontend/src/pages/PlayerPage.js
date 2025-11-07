import React, { useEffect, useState } from 'react';
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
import { toast } from 'sonner';
import { Plus, Trash2, Edit, ArrowLeft, User, Star } from 'lucide-react';

export default function PlayerPage() {
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState(null);
  
  // États pour le formulaire
  const [nom, setNom] = useState('');
  const [note, setNote] = useState(5);
  const [postes, setPostes] = useState(''); // Géré comme une chaîne de texte séparée par des virgules

  const navigate = useNavigate();

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
    setNom('');
    setNote(5);
    setPostes('');
    setEditingPlayer(null);
    setIsFormOpen(false);
  };

  const handleOpenForm = (player) => {
    if (player) {
      // Mode édition
      setEditingPlayer(player);
      setNom(player.nom);
      setNote(player.note_de_base);
      setPostes(player.postes.join(', '));
    } else {
      // Mode création
      setEditingPlayer(null);
      setNom('');
      setNote(5);
      setPostes('');
    }
    setIsFormOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const postesArray = postes.split(',').map(p => p.trim()).filter(Boolean);
    if (!nom || postesArray.length === 0) {
      toast.error('Veuillez remplir le nom et au moins un poste.');
      return;
    }

    const playerData = {
      nom,
      note_de_base: parseFloat(note),
      postes: postesArray,
    };

    try {
      if (editingPlayer) {
        await updatePlayer(editingPlayer.id, playerData);
        toast.success('Joueur mis à jour !');
      } else {
        await createPlayer(playerData);
        toast.success('Joueur créé avec succès !');
      }
      fetchPlayers();
      resetForm();
    } catch (error) {
      toast.error('Une erreur est survenue.');
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
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
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
            <DialogContent onInteractOutside={(e) => e.preventDefault()} onEscapeKeyDown={() => resetForm()}>
              <DialogHeader>
                <DialogTitle>{editingPlayer ? 'Modifier le joueur' : 'Ajouter un nouveau joueur'}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="nom">Nom du joueur</Label>
                  <Input
                    id="nom"
                    value={nom}
                    onChange={(e) => setNom(e.target.value)}
                    placeholder="Ex: Zinedine Zidane"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="note">Note (sur 10)</Label>
                  <Input
                    id="note"
                    type="number"
                    min="1"
                    max="10"
                    step="0.5"
                    value={note}
                    onChange={(e) => setNote(parseFloat(e.target.value))}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="postes">Postes</Label>
                  <Input
                    id="postes"
                    value={postes}
                    onChange={(e) => setPostes(e.target.value)}
                    placeholder="Ex: Milieu, Attaquant (séparés par une virgule)"
                    required
                  />
                </div>
                <DialogFooter>
                  <DialogClose asChild>
                    <Button type="button" variant="outline" onClick={resetForm}>Annuler</Button>
                  </DialogClose>
                  <Button type="submit">{editingPlayer ? 'Mettre à jour' : 'Créer'}</Button>
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
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nom</TableHead>
                  <TableHead>Note</TableHead>
                  <TableHead>Postes</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {players.map((player) => (
                  <TableRow key={player.id}>
                    <TableCell className="font-medium">{player.nom}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Star className="w-4 h-4 text-yellow-400" />
                        {player.note_de_base}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {player.postes.map((poste) => (
                          <Badge key={poste} variant="secondary">{poste}</Badge>
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
        )}
      </main>
    </div>
  );
}