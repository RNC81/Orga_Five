from fastapi import FastAPI, APIRouter, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone, timedelta
import bcrypt
import jwt
import random
from itertools import combinations

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT Configuration
SECRET_KEY = os.environ.get('SECRET_KEY', 'your-secret-key-change-in-production-' + str(uuid.uuid4()))
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 7 days

# Create the main app
app = FastAPI()
api_router = APIRouter(prefix="/api")
security = HTTPBearer()

# ============= MODELS =============

class User(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    email: EmailStr
    password_hash: str
    role: str = "co-organisateur"  # "admin" ou "co-organisateur"
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class UserCreate(BaseModel):
    email: EmailStr
    password: str

class UserInvite(BaseModel):
    email: EmailStr
    password: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    id: str
    email: str
    role: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse

class Player(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    nom: str
    note_de_base: float = Field(ge=1, le=10)
    postes: List[str]  # ["Défenseur", "Milieu", "Attaquant", "Gardien"]
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class PlayerCreate(BaseModel):
    nom: str
    note_de_base: float = Field(ge=1, le=10)
    postes: List[str]

class PlayerUpdate(BaseModel):
    nom: Optional[str] = None
    note_de_base: Optional[float] = Field(None, ge=1, le=10)
    postes: Optional[List[str]] = None

class JoueurPresent(BaseModel):
    joueur_id: str
    note_temporaire: float = Field(ge=1, le=10)

class ContrainteAffinite(BaseModel):
    type: str  # "lier" ou "separer"
    joueurs: List[str]  # Liste de joueur_ids

class Event(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    nom_evenement: str
    organisateur_id: str
    joueurs_presents: List[JoueurPresent] = []
    nombre_equipes: int = 2
    contraintes_affinite: List[ContrainteAffinite] = []
    equipes_generees: List[List[str]] = []  # Liste de listes de joueur_ids
    share_token: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    warning_message: Optional[str] = None

class EventCreate(BaseModel):
    nom_evenement: str
    joueurs_presents: List[JoueurPresent] = []
    nombre_equipes: int = 2
    contraintes_affinite: List[ContrainteAffinite] = []

class EventUpdate(BaseModel):
    nom_evenement: Optional[str] = None
    joueurs_presents: Optional[List[JoueurPresent]] = None
    nombre_equipes: Optional[int] = None
    contraintes_affinite: Optional[List[ContrainteAffinite]] = None
    equipes_generees: Optional[List[List[str]]] = None

class GenerateTeamsRequest(BaseModel):
    pass

class TeamStats(BaseModel):
    note_moyenne: float
    postes: Dict[str, int]
    joueurs: List[Dict[str, Any]]

class GenerateTeamsResponse(BaseModel):
    equipes: List[TeamStats]
    warning_message: Optional[str] = None

# ============= AUTH HELPERS =============

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> User:
    try:
        token = credentials.credentials
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Token invalide")
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expiré")
    except jwt.JWTError:
        raise HTTPException(status_code=401, detail="Token invalide")
    
    user_doc = await db.users.find_one({"id": user_id}, {"_id": 0})
    if user_doc is None:
        raise HTTPException(status_code=401, detail="Utilisateur non trouvé")
    
    return User(**user_doc)

async def get_admin_user(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Accès réservé aux administrateurs")
    return current_user

# ============= AUTH ROUTES =============

@api_router.post("/auth/register", response_model=TokenResponse)
async def register(user_data: UserCreate):
    # Vérifier si l'utilisateur existe déjà
    existing_user = await db.users.find_one({"email": user_data.email}, {"_id": 0})
    if existing_user:
        raise HTTPException(status_code=400, detail="Cet email est déjà utilisé")
    
    # Vérifier si c'est le premier utilisateur (devient admin)
    user_count = await db.users.count_documents({})
    role = "admin" if user_count == 0 else "co-organisateur"
    
    # Créer l'utilisateur
    user = User(
        email=user_data.email,
        password_hash=hash_password(user_data.password),
        role=role
    )
    
    user_dict = user.model_dump()
    user_dict['created_at'] = user_dict['created_at'].isoformat()
    await db.users.insert_one(user_dict)
    
    # Créer le token
    access_token = create_access_token({"sub": user.id})
    
    return TokenResponse(
        access_token=access_token,
        user=UserResponse(id=user.id, email=user.email, role=user.role)
    )

@api_router.post("/auth/login", response_model=TokenResponse)
async def login(credentials: UserLogin):
    user_doc = await db.users.find_one({"email": credentials.email}, {"_id": 0})
    if not user_doc:
        raise HTTPException(status_code=401, detail="Email ou mot de passe incorrect")
    
    user = User(**user_doc)
    if not verify_password(credentials.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Email ou mot de passe incorrect")
    
    access_token = create_access_token({"sub": user.id})
    
    return TokenResponse(
        access_token=access_token,
        user=UserResponse(id=user.id, email=user.email, role=user.role)
    )

@api_router.get("/auth/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    return UserResponse(id=current_user.id, email=current_user.email, role=current_user.role)

# ============= USER MANAGEMENT (Admin only) =============

@api_router.get("/users", response_model=List[UserResponse])
async def get_users(current_user: User = Depends(get_admin_user)):
    users = await db.users.find({}, {"_id": 0}).to_list(1000)
    return [UserResponse(id=u["id"], email=u["email"], role=u["role"]) for u in users]

@api_router.post("/users", response_model=UserResponse)
async def invite_user(user_invite: UserInvite, current_user: User = Depends(get_admin_user)):
    existing_user = await db.users.find_one({"email": user_invite.email}, {"_id": 0})
    if existing_user:
        raise HTTPException(status_code=400, detail="Cet email est déjà utilisé")
    
    user = User(
        email=user_invite.email,
        password_hash=hash_password(user_invite.password),
        role="co-organisateur"
    )
    
    user_dict = user.model_dump()
    user_dict['created_at'] = user_dict['created_at'].isoformat()
    await db.users.insert_one(user_dict)
    
    return UserResponse(id=user.id, email=user.email, role=user.role)

@api_router.delete("/users/{user_id}")
async def delete_user(user_id: str, current_user: User = Depends(get_admin_user)):
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Vous ne pouvez pas supprimer votre propre compte")
    
    result = await db.users.delete_one({"id": user_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Utilisateur non trouvé")
    
    return {"message": "Utilisateur supprimé avec succès"}

# ============= PLAYERS ROUTES =============

@api_router.get("/players", response_model=List[Player])
async def get_players(current_user: User = Depends(get_current_user)):
    players = await db.players.find({}, {"_id": 0}).to_list(1000)
    for player in players:
        if isinstance(player.get('created_at'), str):
            player['created_at'] = datetime.fromisoformat(player['created_at'])
    return players

@api_router.post("/players", response_model=Player)
async def create_player(player_data: PlayerCreate, current_user: User = Depends(get_current_user)):
    player = Player(**player_data.model_dump())
    player_dict = player.model_dump()
    player_dict['created_at'] = player_dict['created_at'].isoformat()
    await db.players.insert_one(player_dict)
    return player

@api_router.put("/players/{player_id}", response_model=Player)
async def update_player(player_id: str, player_update: PlayerUpdate, current_user: User = Depends(get_current_user)):
    player_doc = await db.players.find_one({"id": player_id}, {"_id": 0})
    if not player_doc:
        raise HTTPException(status_code=404, detail="Joueur non trouvé")
    
    update_data = {k: v for k, v in player_update.model_dump().items() if v is not None}
    if update_data:
        await db.players.update_one({"id": player_id}, {"$set": update_data})
    
    updated_doc = await db.players.find_one({"id": player_id}, {"_id": 0})
    if isinstance(updated_doc.get('created_at'), str):
        updated_doc['created_at'] = datetime.fromisoformat(updated_doc['created_at'])
    return Player(**updated_doc)

@api_router.delete("/players/{player_id}")
async def delete_player(player_id: str, current_user: User = Depends(get_admin_user)):
    result = await db.players.delete_one({"id": player_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Joueur non trouvé")
    return {"message": "Joueur supprimé avec succès"}

# ============= EVENTS ROUTES =============

@api_router.get("/events", response_model=List[Event])
async def get_events(current_user: User = Depends(get_current_user)):
    if current_user.role == "admin":
        events = await db.events.find({}, {"_id": 0}).to_list(1000)
    else:
        events = await db.events.find({"organisateur_id": current_user.id}, {"_id": 0}).to_list(1000)
    
    for event in events:
        if isinstance(event.get('created_at'), str):
            event['created_at'] = datetime.fromisoformat(event['created_at'])
    return events

@api_router.get("/events/{event_id}", response_model=Event)
async def get_event(event_id: str, current_user: User = Depends(get_current_user)):
    event_doc = await db.events.find_one({"id": event_id}, {"_id": 0})
    if not event_doc:
        raise HTTPException(status_code=404, detail="Événement non trouvé")
    
    event = Event(**event_doc)
    if current_user.role != "admin" and event.organisateur_id != current_user.id:
        raise HTTPException(status_code=403, detail="Accès refusé")
    
    if isinstance(event_doc.get('created_at'), str):
        event_doc['created_at'] = datetime.fromisoformat(event_doc['created_at'])
    
    return event

@api_router.post("/events", response_model=Event)
async def create_event(event_data: EventCreate, current_user: User = Depends(get_current_user)):
    event = Event(
        **event_data.model_dump(),
        organisateur_id=current_user.id
    )
    event_dict = event.model_dump()
    event_dict['created_at'] = event_dict['created_at'].isoformat()
    await db.events.insert_one(event_dict)
    return event

@api_router.put("/events/{event_id}", response_model=Event)
async def update_event(event_id: str, event_update: EventUpdate, current_user: User = Depends(get_current_user)):
    event_doc = await db.events.find_one({"id": event_id}, {"_id": 0})
    if not event_doc:
        raise HTTPException(status_code=404, detail="Événement non trouvé")
    
    event = Event(**event_doc)
    if current_user.role != "admin" and event.organisateur_id != current_user.id:
        raise HTTPException(status_code=403, detail="Accès refusé")
    
    update_data = {k: v for k, v in event_update.model_dump().items() if v is not None}
    if update_data:
        await db.events.update_one({"id": event_id}, {"$set": update_data})
    
    updated_doc = await db.events.find_one({"id": event_id}, {"_id": 0})
    if isinstance(updated_doc.get('created_at'), str):
        updated_doc['created_at'] = datetime.fromisoformat(updated_doc['created_at'])
    return Event(**updated_doc)

@api_router.delete("/events/{event_id}")
async def delete_event(event_id: str, current_user: User = Depends(get_current_user)):
    event_doc = await db.events.find_one({"id": event_id}, {"_id": 0})
    if not event_doc:
        raise HTTPException(status_code=404, detail="Événement non trouvé")
    
    event = Event(**event_doc)
    if current_user.role != "admin" and event.organisateur_id != current_user.id:
        raise HTTPException(status_code=403, detail="Accès refusé")
    
    await db.events.delete_one({"id": event_id})
    return {"message": "Événement supprimé avec succès"}

# ============= TEAM GENERATION ALGORITHM =============

async def get_player_details(joueur_ids: List[str]) -> Dict[str, Player]:
    """Récupère les détails des joueurs"""
    players = await db.players.find({"id": {"$in": joueur_ids}}, {"_id": 0}).to_list(1000)
    return {p["id"]: Player(**p) for p in players}

def calculate_team_stats(team: List[str], joueurs_map: Dict[str, Player], notes_map: Dict[str, float]) -> Dict:
    """Calcule les statistiques d'une équipe"""
    total_note = sum(notes_map.get(jid, 0) for jid in team)
    note_moyenne = total_note / len(team) if team else 0
    
    postes_count = {}
    for jid in team:
        player = joueurs_map.get(jid)
        if player:
            for poste in player.postes:
                postes_count[poste] = postes_count.get(poste, 0) + 1
    
    return {
        "note_moyenne": round(note_moyenne, 2),
        "postes": postes_count,
        "total_note": total_note
    }

def check_constraints(teams: List[List[str]], contraintes: List[ContrainteAffinite]) -> bool:
    """Vérifie si toutes les contraintes sont respectées"""
    for contrainte in contraintes:
        if contrainte.type == "lier":
            # Les joueurs liés doivent être dans la même équipe
            joueur_teams = {}
            for team_idx, team in enumerate(teams):
                for joueur_id in contrainte.joueurs:
                    if joueur_id in team:
                        joueur_teams[joueur_id] = team_idx
            
            if len(set(joueur_teams.values())) > 1:
                return False
        
        elif contrainte.type == "separer":
            # Les joueurs séparés ne doivent pas être dans la même équipe
            for team in teams:
                joueurs_in_team = [j for j in contrainte.joueurs if j in team]
                if len(joueurs_in_team) > 1:
                    return False
    
    return True

def generate_balanced_teams(joueurs_presents: List[JoueurPresent], nombre_equipes: int, 
                           contraintes: List[ContrainteAffinite], joueurs_map: Dict[str, Player]) -> tuple:
    """Génère des équipes équilibrées"""
    notes_map = {jp.joueur_id: jp.note_temporaire for jp in joueurs_presents}
    joueur_ids = list(notes_map.keys())
    n_joueurs = len(joueur_ids)
    
    if n_joueurs < nombre_equipes:
        raise ValueError("Pas assez de joueurs pour former le nombre d'équipes demandé")
    
    # Stratégie : essayer plusieurs distributions aléatoires et garder la meilleure
    best_teams = None
    best_score = float('inf')
    warning_message = None
    
    max_attempts = 1000
    valid_attempts = 0
    
    for attempt in range(max_attempts):
        # Mélanger les joueurs
        shuffled = joueur_ids.copy()
        random.shuffle(shuffled)
        
        # Distribution de base
        base_size = n_joueurs // nombre_equipes
        extra = n_joueurs % nombre_equipes
        
        teams = []
        idx = 0
        for i in range(nombre_equipes):
            team_size = base_size + (1 if i < extra else 0)
            teams.append(shuffled[idx:idx + team_size])
            idx += team_size
        
        # Vérifier les contraintes
        if not check_constraints(teams, contraintes):
            continue
        
        valid_attempts += 1
        
        # Calculer le score (différence entre équipes)
        team_stats = [calculate_team_stats(team, joueurs_map, notes_map) for team in teams]
        notes_moyennes = [stats["note_moyenne"] for stats in team_stats]
        
        # Score basé sur l'écart-type des notes moyennes
        mean_of_means = sum(notes_moyennes) / len(notes_moyennes)
        variance = sum((nm - mean_of_means) ** 2 for nm in notes_moyennes) / len(notes_moyennes)
        note_score = variance
        
        # Score basé sur la distribution des postes
        poste_score = 0
        all_postes = set()
        for stats in team_stats:
            all_postes.update(stats["postes"].keys())
        
        for poste in all_postes:
            poste_counts = [stats["postes"].get(poste, 0) for stats in team_stats]
            if poste_counts:
                mean_poste = sum(poste_counts) / len(poste_counts)
                poste_variance = sum((pc - mean_poste) ** 2 for pc in poste_counts) / len(poste_counts)
                poste_score += poste_variance
        
        total_score = note_score * 2 + poste_score  # Prioriser l'équilibre des notes
        
        if total_score < best_score:
            best_score = total_score
            best_teams = teams
            
            # Vérifier si déséquilibre majeur
            max_note = max(notes_moyennes)
            min_note = min(notes_moyennes)
            if max_note - min_note > 1.5:
                warning_message = f"⚠️ Les contraintes d'affinité forcent un déséquilibre : écart de {max_note - min_note:.2f} points entre l'équipe la plus forte et la plus faible."
    
    if best_teams is None:
        raise ValueError("Impossible de générer des équipes respectant toutes les contraintes")
    
    # Si joueurs en surplus, les ajouter aux équipes les plus faibles
    if n_joueurs % nombre_equipes != 0:
        final_stats = [calculate_team_stats(team, joueurs_map, notes_map) for team in best_teams]
        team_notes = [(i, stats["note_moyenne"]) for i, stats in enumerate(final_stats)]
        team_notes.sort(key=lambda x: x[1])
    
    return best_teams, warning_message

@api_router.post("/events/{event_id}/generate", response_model=GenerateTeamsResponse)
async def generate_teams(event_id: str, current_user: User = Depends(get_current_user)):
    event_doc = await db.events.find_one({"id": event_id}, {"_id": 0})
    if not event_doc:
        raise HTTPException(status_code=404, detail="Événement non trouvé")
    
    event = Event(**event_doc)
    if current_user.role != "admin" and event.organisateur_id != current_user.id:
        raise HTTPException(status_code=403, detail="Accès refusé")
    
    if not event.joueurs_presents:
        raise HTTPException(status_code=400, detail="Aucun joueur présent")
    
    # Récupérer les détails des joueurs
    joueur_ids = [jp.joueur_id for jp in event.joueurs_presents]
    joueurs_map = await get_player_details(joueur_ids)
    
    # Générer les équipes
    try:
        teams, warning = generate_balanced_teams(
            event.joueurs_presents,
            event.nombre_equipes,
            event.contraintes_affinite,
            joueurs_map
        )
        
        # Sauvegarder les équipes
        await db.events.update_one(
            {"id": event_id},
            {"$set": {"equipes_generees": teams, "warning_message": warning}}
        )
        
        # Préparer la réponse avec les statistiques
        notes_map = {jp.joueur_id: jp.note_temporaire for jp in event.joueurs_presents}
        response_teams = []
        
        for team in teams:
            stats = calculate_team_stats(team, joueurs_map, notes_map)
            joueurs_data = []
            for jid in team:
                player = joueurs_map.get(jid)
                if player:
                    joueurs_data.append({
                        "id": jid,
                        "nom": player.nom,
                        "note": notes_map.get(jid, player.note_de_base),
                        "postes": player.postes
                    })
            
            response_teams.append(TeamStats(
                note_moyenne=stats["note_moyenne"],
                postes=stats["postes"],
                joueurs=joueurs_data
            ))
        
        return GenerateTeamsResponse(equipes=response_teams, warning_message=warning)
    
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

# ============= SHARE LINK =============

@api_router.get("/share/{share_token}")
async def get_shared_event(share_token: str):
    event_doc = await db.events.find_one({"share_token": share_token}, {"_id": 0})
    if not event_doc:
        raise HTTPException(status_code=404, detail="Événement non trouvé")
    
    event = Event(**event_doc)
    
    if not event.equipes_generees:
        raise HTTPException(status_code=400, detail="Les équipes n'ont pas encore été générées")
    
    # Récupérer les détails des joueurs
    all_joueur_ids = [jp.joueur_id for jp in event.joueurs_presents]
    joueurs_map = await get_player_details(all_joueur_ids)
    notes_map = {jp.joueur_id: jp.note_temporaire for jp in event.joueurs_presents}
    
    # Préparer les équipes avec statistiques
    response_teams = []
    for team in event.equipes_generees:
        stats = calculate_team_stats(team, joueurs_map, notes_map)
        joueurs_data = []
        for jid in team:
            player = joueurs_map.get(jid)
            if player:
                joueurs_data.append({
                    "id": jid,
                    "nom": player.nom,
                    "note": notes_map.get(jid, player.note_de_base),
                    "postes": player.postes
                })
        
        response_teams.append({
            "note_moyenne": stats["note_moyenne"],
            "postes": stats["postes"],
            "joueurs": joueurs_data
        })
    
    return {
        "nom_evenement": event.nom_evenement,
        "equipes": response_teams,
        "warning_message": event.warning_message
    }

# ============= ROOT ROUTES =============

@api_router.get("/")
async def root():
    return {"message": "API Générateur d'Équipes de Foot"}

# Include router
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()