import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createEvent } from '../services/api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { toast } from 'sonner';
import { ArrowLeft, Check } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';

export default function EventCreatePage() {
  const [nomEvenement, setNomEvenement] = useState('');
  const [nombreEquipes, setNombreEquipes] = useState(2);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!nomEvenement) {
      toast.error('Veuillez donner un nom au match.');
      return;
    }
    setLoading(true);

    try {
      // On crée l'événement avec des listes vides
      const eventData = {
        nom_evenement: nomEvenement,
        nombre_equipes: parseInt(nombreEquipes, 10),
        joueurs_presents: [],
        contraintes_affinite: [],
      };
      
      // On appelle l'API pour créer l'événement
      const response = await createEvent(eventData);
      const newEventId = response.data.id;
      
      toast.success('Match créé ! Vous pouvez maintenant ajouter les joueurs.');
      
      // On redirige l'utilisateur vers la page de gestion de ce nouveau match
      // (Cette page n'existe pas encore, nous la créerons à l'étape suivante)
      navigate(`/events/${newEventId}`);
      
    } catch (error) {
      toast.error('Erreur lors de la création du match.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center gap-3">
          <Button variant="outline" size="icon" onClick={() => navigate('/dashboard')}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <h1 className="text-3xl font-bold" style={{ fontFamily: 'Space Grotesk, sans-serif', color: '#1e293b' }}>
            Créer un nouveau match
          </h1>
        </div>
      </header>

      {/* Main Content (Formulaire) */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        <Card className="max-w-xl mx-auto">
          <CardHeader>
            <CardTitle>Détails du match</CardTitle>
            <CardDescription>
              Donnez un nom à votre match (ex: "Mardi 12/11") et le nombre d'équipes que vous voulez former.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="nom">Nom du match</Label>
                <Input
                  id="nom"
                  value={nomEvenement}
                  onChange={(e) => setNomEvenement(e.target.value)}
                  placeholder="Ex: Match du Mardi Soir"
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="equipes">Nombre d'équipes à former</Label>
                <Select
                  value={String(nombreEquipes)}
                  onValueChange={(value) => setNombreEquipes(value)}
                >
                  <SelectTrigger id="equipes" className="w-[180px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="2">2 équipes</SelectItem>
                    <SelectItem value="3">3 équipes</SelectItem>
                    <SelectItem value="4">4 équipes</SelectItem>
                    <SelectItem value="5">5 équipes</SelectItem>
                    <SelectItem value="6">6 équipes</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Création...' : (
                  <>
                    <Check className="w-4 h-4 mr-2" />
                    Créer et passer à la suite
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}