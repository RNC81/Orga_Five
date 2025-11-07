from fastapi import FastAPI, APIRouter, HTTPException, Depends, status, Body
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
import secrets
import string

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT Configuration
SECRET_KEY = os.environ.get('SECRET_KEY', 'your-secret-key-change-in-production-' + str(uuid.uuid4()))
CRON_SECRET = os.environ.get('CRON_SECRET', 'your-cron-secret-change-this')
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 7 days

# Create the main app
app = FastAPI()
api_router = APIRouter(prefix="/api")
security = HTTPBearer()

# ============= NOUVELLE FONCTION DE CALCUL DU GÉNÉRAL =============

def calculate_general(player_data: dict) -> float:
    postes = player_data.get('postes', [])
    is_gardien = any(p.lower() == 'gardien' for p in postes)
    attrs = {
        'vitesse': player_data.get('vitesse', 5.0),
        'technique': player_data.get('technique', 5.0),
        'tir': player_data.get('tir', 5.0),
        'passe': player_data.get('passe', 5.0),
        'defense': player_data.get('defense', 5.0),
        'physique': player_data.get('physique', 5.0),
        'reflexes_gk': player_data.get('reflexes_gk', 1.0),
        'plongeon_gk': player_data.get('plongeon_gk', 1.0),
        'jeu_au_pied_gk': player_data.get('jeu_au_pied_gk', 1.0),
    }
    if is_gardien:
        note = (
            attrs['reflexes_gk'] * 0.20 +
            attrs['plongeon_gk'] * 0.20 +
            attrs['jeu_au_pied_gk'] * 0.20 +
            attrs['technique'] * 0.10 +
            attrs['passe'] * 0.10 +
            attrs['vitesse'] * 0.05 +
            attrs['defense'] * 0.05 +
            attrs['physique'] * 0.05 +
            attrs['tir'] * 0.05
        )
    else:
        note = (
            attrs['vitesse'] +
            attrs['technique'] +
            attrs['tir'] +
            attrs['passe'] +
            attrs['defense'] +
            attrs['physique']
        ) / 6
    return round(note, 2)

# ============= MODELS =============

class User(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    email: EmailStr
    password_hash: str
    role: str = "admin"
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class UserCreate(BaseModel):
    email: EmailStr
    password: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    id: str
    email: str
    role: str

class GuestLogin(BaseModel):
    name: str = Field(..., min_length=2)
    code: str = Field(..., min_length=6)

class GuestCode(BaseModel):
    id: str = Field(default="singleton")
    code: str
    expires_at: datetime

class GuestLogResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    code_used: str
    logged_in_at: datetime

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse

class PlayerBase(BaseModel):
    nom: str
    postes: List[str]
    vitesse: float = Field(default=5.0, ge=1, le=10)
    technique: float = Field(default=5.0, ge=1, le=10)
    tir: float = Field(default=5.0, ge=1, le=10)
    passe: float = Field(default=5.0, ge=1, le=10)
    defense: float = Field(default=5.0, ge=1, le=10)
    physique: float = Field(default=5.0, ge=1, le=10)
    reflexes_gk: float = Field(default=1.0, ge=1, le=10)
    plongeon_gk: float = Field(default=1.0, ge=1, le=10)
    jeu_au_pied_gk: float = Field(default=1.0, ge=1, le=10)

class PlayerCreate(PlayerBase):
    pass

class PlayerUpdate(BaseModel):
    nom: Optional[str] = None
    postes: Optional[List[str]] = None
    vitesse: Optional[float] = Field(None, ge=1, le=10)
    technique: Optional[float] = Field(None, ge=1, le=10)
    tir: Optional[float] = Field(None, ge=1, le=10)
    passe: Optional[float] = Field(None, ge=1, le=10)
    defense: Optional[float] = Field(None, ge=1, le=10)
    physique: Optional[float] = Field(None, ge=1, le=10)
    reflexes_gk: Optional[float] = Field(None, ge=1, le=10)
    plongeon_gk: Optional[float] = Field(None, ge=1, le=10)
    jeu_au_pied_gk: Optional[float] = Field(None, ge=1, le=10)

class PlayerInDB(PlayerBase):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    note_generale: float

class JoueurPresent(BaseModel):
    joueur_id: str
    note_temporaire: float = Field(ge=1, le=10)

class ContrainteAffinite(BaseModel):
    type: str
    joueurs: List[str]

class Event(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    nom_evenement: str
    organisateur_id: str
    joueurs_presents: List[JoueurPresent] = []
    nombre_equipes: int = 2
    contraintes_affinite: List[ContrainteAffinite] = []
    equipes_generees: List[List[str]] = []
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

class TeamStats(BaseModel):
    note_moyenne: float
    postes: Dict[str, int]
    joueurs: List[Dict[str, Any]]

class GenerateTeamsResponse(BaseModel):
    equipes: List[TeamStats]
    warning_message: Optional[str] = None

# ============= AUTH HELPERS (Inchangé) =============

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    if "role" not in to_encode: to_encode["role"] = "co-organisateur"
    if "name" not in to_encode and "email" in to_encode: to_encode["name"] = to_encode["email"]
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> UserResponse:
    try:
        token = credentials.credentials
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None: raise HTTPException(status_code=401, detail="Token invalide")
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expiré")
    except jwt.JWTError:
        raise HTTPException(status_code=401, detail="Token invalide")
    user_doc = await db.users.find_one({"id": user_id}, {"_id": 0})
    if user_doc:
        return UserResponse(id=user_doc["id"], email=user_doc["email"], role=user_doc["role"])
    role = payload.get("role")
    name = payload.get("name")
    if role == "co-organisateur" and name:
        return UserResponse(id=user_id, email=name, role=role)
    raise HTTPException(status_code=401, detail="Utilisateur non trouvé")

async def get_admin_user(current_user: UserResponse = Depends(get_current_user)) -> UserResponse:
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Accès réservé aux administrateurs")
    return current_user

# ============= AUTH ROUTES (Inchangé) =============

@api_router.post("/auth/register", response_model=TokenResponse)
async def register(user_data: UserCreate):
    user_count = await db.users.count_documents({})
    if user_count > 0:
        raise HTTPException(status_code=403, detail="L'inscription est désactivée.")
    role = "admin"
    user = User(email=user_data.email, password_hash=hash_password(user_data.password), role=role)
    user_dict = user.model_dump()
    user_dict['created_at'] = user_dict['created_at'].isoformat()
    await db.users.insert_one(user_dict)
    access_token = create_access_token(data={"sub": user.id, "role": user.role, "name": user.email})
    return TokenResponse(access_token=access_token, user=UserResponse(id=user.id, email=user.email, role=user.role))

@api_router.post("/auth/login", response_model=TokenResponse)
async def login(credentials: UserLogin):
    user_doc = await db.users.find_one({"email": credentials.email}, {"_id": 0})
    if not user_doc: raise HTTPException(status_code=401, detail="Email ou mot de passe incorrect")
    user = User(**user_doc)
    if not verify_password(credentials.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Email ou mot de passe incorrect")
    access_token = create_access_token(data={"sub": user.id, "role": user.role, "name": user.email})
    return TokenResponse(access_token=access_token, user=UserResponse(id=user.id, email=user.email, role=user.role))

@api_router.post("/auth/guest-login", response_model=TokenResponse)
async def guest_login(credentials: GuestLogin):
    code_doc = await db.guest_codes.find_one({"id": "singleton"}, {"_id": 0})
    if not code_doc or credentials.code != code_doc["code"]:
        raise HTTPException(status_code=401, detail="Code d'invitation incorrect")
    expires_at = datetime.fromisoformat(code_doc["expires_at"])
    if datetime.now(timezone.utc) > expires_at:
        raise HTTPException(status_code=401, detail="Le code d'invitation a expiré")
    log_entry = {
        "id": str(uuid.uuid4()),
        "name": credentials.name,
        "code_used": credentials.code,
        "logged_in_at": datetime.now(timezone.utc).isoformat()
    }
    await db.guest_logs.insert_one(log_entry)
    guest_id = f"guest_{credentials.name.lower()}_{str(uuid.uuid4())[:4]}"
    guest_role = "co-organisateur"
    access_token = create_access_token(data={"sub": guest_id, "role": guest_role, "name": credentials.name})
    return TokenResponse(access_token=access_token, user=UserResponse(id=guest_id, email=credentials.name, role=guest_role))

@api_router.get("/auth/me", response_model=UserResponse)
async def get_me(current_user: UserResponse = Depends(get_current_user)):
    return current_user

# ============= GUEST CODE (Admin only) (Inchangé) =============

async def generate_new_guest_code() -> GuestCode:
    alphabet = string.ascii_uppercase + string.digits
    code = ''.join(secrets.choice(alphabet) for i in range(6))
    expires_at = datetime.now(timezone.utc) + timedelta(days=7)
    code_data = GuestCode(code=code, expires_at=expires_at)
    await db.guest_codes.update_one(
        {"id": "singleton"},
        {"$set": {"code": code_data.code, "expires_at": code_data.expires_at.isoformat()}},
        upsert=True
    )
    return code_data

async def get_or_create_guest_code() -> GuestCode:
    code_doc = await db.guest_codes.find_one({"id": "singleton"}, {"_id": 0})
    if not code_doc or datetime.now(timezone.utc) > datetime.fromisoformat(code_doc["expires_at"]):
        return await generate_new_guest_code()
    return GuestCode(code=code_doc["code"], expires_at=datetime.fromisoformat(code_doc["expires_at"]))

@api_router.get("/admin/guest-code", response_model=GuestCode)
async def get_guest_code(current_user: UserResponse = Depends(get_admin_user)):
    code = await get_or_create_guest_code()
    return code

@api_router.post("/admin/guest-code", response_model=GuestCode)
async def create_new_guest_code(current_user: UserResponse = Depends(get_admin_user)):
    code = await generate_new_guest_code()
    return code

@api_router.get("/admin/guest-logs", response_model=List[GuestLogResponse])
async def get_guest_logs(current_user: UserResponse = Depends(get_admin_user)):
    logs_cursor = db.guest_logs.find({}, {"_id": 0}).sort("logged_in_at", -1).limit(100)
    logs = await logs_cursor.to_list(100)
    for log in logs:
        if isinstance(log.get('logged_in_at'), str):
            log['logged_in_at'] = datetime.fromisoformat(log['logged_in_at'])
    return [GuestLogResponse(**log) for log in logs]


# ============= CRON JOB ROUTE (Secret) (Inchangé) =============

@api_router.post("/cron/regenerate-code")
async def cron_regenerate_code(secret: str = Body(..., embed=True)):
    if secret != CRON_SECRET:
        raise HTTPException(status_code=403, detail="Accès non autorisé")
    await generate_new_guest_code()
    return {"message": "Nouveau code généré avec succès"}


# ============= PLAYERS ROUTES (Inchangé) =============
# (La logique de création/MAJ avec les attributs est déjà correcte)

@api_router.get("/players", response_model=List[PlayerInDB])
async def get_players(current_user: UserResponse = Depends(get_current_user)):
    players = await db.players.find({}, {"_id": 0}).to_list(1000)
    for player in players:
        if isinstance(player.get('created_at'), str):
            player['created_at'] = datetime.fromisoformat(player['created_at'])
    return players

@api_router.post("/players", response_model=PlayerInDB)
async def create_player(player_data: PlayerCreate, current_user: UserResponse = Depends(get_current_user)):
    player_dict = player_data.model_dump()
    note_generale = calculate_general(player_dict)
    player = PlayerInDB(**player_dict, note_generale=note_generale)
    db_player_dict = player.model_dump()
    db_player_dict['created_at'] = db_player_dict['created_at'].isoformat()
    await db.players.insert_one(db_player_dict)
    return player

@api_router.put("/players/{player_id}", response_model=PlayerInDB)
async def update_player(player_id: str, player_update: PlayerUpdate, current_user: UserResponse = Depends(get_current_user)):
    player_doc = await db.players.find_one({"id": player_id}, {"_id": 0})
    if not player_doc:
        raise HTTPException(status_code=404, detail="Joueur non trouvé")
    update_data = player_update.model_dump(exclude_unset=True)
    updated_doc_data = {**player_doc, **update_data}
    note_generale = calculate_general(updated_doc_data)
    update_data['note_generale'] = note_generale
    if update_data:
        await db.players.update_one({"id": player_id}, {"$set": update_data})
    updated_doc = await db.players.find_one({"id": player_id}, {"_id": 0})
    if isinstance(updated_doc.get('created_at'), str):
        updated_doc['created_at'] = datetime.fromisoformat(updated_doc['created_at'])
    return PlayerInDB(**updated_doc)

@api_router.delete("/players/{player_id}")
async def delete_player(player_id: str, current_user: UserResponse = Depends(get_admin_user)):
    result = await db.players.delete_one({"id": player_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Joueur non trouvé")
    return {"message": "Joueur supprimé avec succès"}

# ============= EVENTS ROUTES (MODIFIÉES) =============

### MODIFIÉ ###
@api_router.get("/events", response_model=List[Event])
async def get_events(current_user: UserResponse = Depends(get_current_user)):
    # Tous les utilisateurs connectés (admin ou invité) voient TOUS les matchs.
    query = {} 
    events = await db.events.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)
    
    for event in events:
        if isinstance(event.get('created_at'), str):
            event['created_at'] = datetime.fromisoformat(event['created_at'])
    return events

### MODIFIÉ ###
@api_router.get("/events/{event_id}", response_model=Event)
async def get_event(event_id: str, current_user: UserResponse = Depends(get_current_user)):
    # N'importe quel utilisateur connecté peut voir n'importe quel match
    event_doc = await db.events.find_one({"id": event_id}, {"_id": 0})
    if not event_doc:
        raise HTTPException(status_code=404, detail="Événement non trouvé")
    
    if isinstance(event_doc.get('created_at'), str):
        event_doc['created_at'] = datetime.fromisoformat(event_doc['created_at'])
    
    return event_doc # On peut renvoyer le doc directement car Event hérite de BaseModel

@api_router.post("/events", response_model=Event)
async def create_event(event_data: EventCreate, current_user: UserResponse = Depends(get_current_user)):
    event = Event(
        **event_data.model_dump(),
        organisateur_id=current_user.id # On garde la trace de qui a créé
    )
    event_dict = event.model_dump()
    event_dict['created_at'] = event_dict['created_at'].isoformat()
    await db.events.insert_one(event_dict)
    return event

### MODIFIÉ ###
@api_router.put("/events/{event_id}", response_model=Event)
async def update_event(event_id: str, event_update: EventUpdate, current_user: UserResponse = Depends(get_current_user)):
    # N'importe quel utilisateur connecté peut modifier n'importe quel match
    event_doc = await db.events.find_one({"id": event_id}, {"_id": 0})
    if not event_doc:
        raise HTTPException(status_code=404, detail="Événement non trouvé")
    
    update_data = {k: v for k, v in event_update.model_dump().items() if v is not None}
    if update_data:
        await db.events.update_one({"id": event_id}, {"$set": update_data})
    
    updated_doc = await db.events.find_one({"id": event_id}, {"_id": 0})
    if isinstance(updated_doc.get('created_at'), str):
        updated_doc['created_at'] = datetime.fromisoformat(updated_doc['created_at'])
    return Event(**updated_doc)

### MODIFIÉ ###
@api_router.delete("/events/{event_id}")
async def delete_event(event_id: str, current_user: UserResponse = Depends(get_current_user)):
    # N'importe quel utilisateur connecté peut supprimer n'importe quel match
    # (On pourrait changer ça plus tard pour "admin-only" si besoin)
    event_doc = await db.events.find_one({"id": event_id}, {"_id": 0})
    if not event_doc:
        raise HTTPException(status_code=404, detail="Événement non trouvé")
    
    await db.events.delete_one({"id": event_id})
    return {"message": "Événement supprimé avec succès"}

# ============= TEAM GENERATION ALGORITHM (MODIFIÉ) =============

# On change la signature pour accepter PlayerInDB
async def get_player_details(joueur_ids: List[str]) -> Dict[str, PlayerInDB]:
    players = await db.players.find({"id": {"$in": joueur_ids}}, {"_id": 0}).to_list(1000)
    return {p["id"]: PlayerInDB(**p) for p in players}

# On change la signature pour accepter PlayerInDB
def calculate_team_stats(team: List[str], joueurs_map: Dict[str, PlayerInDB], notes_map: Dict[str, float]) -> Dict:
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

# (check_constraints est inchangé)
def check_constraints(teams: List[List[str]], contraintes: List[ContrainteAffinite]) -> bool:
    for contrainte in contraintes:
        if contrainte.type == "lier":
            joueur_teams = {}
            for team_idx, team in enumerate(teams):
                for joueur_id in contrainte.joueurs:
                    if joueur_id in team:
                        joueur_teams[joueur_id] = team_idx
            if len(set(joueur_teams.values())) > 1: return False
        elif contrainte.type == "separer":
            for team in teams:
                joueurs_in_team = [j for j in contrainte.joueurs if j in team]
                if len(joueurs_in_team) > 1: return False
    return True

# On change la signature pour accepter PlayerInDB
def generate_balanced_teams(joueurs_presents: List[JoueurPresent], nombre_equipes: int, 
                           contraintes: List[ContrainteAffinite], joueurs_map: Dict[str, PlayerInDB]) -> tuple:
    notes_map = {jp.joueur_id: jp.note_temporaire for jp in joueurs_presents}
    joueur_ids = list(notes_map.keys())
    n_joueurs = len(joueur_ids)
    if n_joueurs < nombre_equipes:
        raise ValueError("Pas assez de joueurs pour former le nombre d'équipes demandé")
    best_teams = None
    best_score = float('inf')
    warning_message = None
    max_attempts = 1000
    for attempt in range(max_attempts):
        shuffled = joueur_ids.copy()
        random.shuffle(shuffled)
        base_size = n_joueurs // nombre_equipes
        extra = n_joueurs % nombre_equipes
        teams = []
        idx = 0
        for i in range(nombre_equipes):
            team_size = base_size + (1 if i < extra else 0)
            teams.append(shuffled[idx:idx + team_size])
            idx += team_size
        if not check_constraints(teams, contraintes): continue
        team_stats = [calculate_team_stats(team, joueurs_map, notes_map) for team in teams]
        notes_moyennes = [stats["note_moyenne"] for stats in team_stats]
        mean_of_means = sum(notes_moyennes) / len(notes_moyennes)
        variance = sum((nm - mean_of_means) ** 2 for nm in notes_moyennes) / len(notes_moyennes)
        note_score = variance
        poste_score = 0
        all_postes = set()
        for stats in team_stats: all_postes.update(stats["postes"].keys())
        for poste in all_postes:
            poste_counts = [stats["postes"].get(poste, 0) for stats in team_stats]
            if poste_counts:
                mean_poste = sum(poste_counts) / len(poste_counts)
                poste_variance = sum((pc - mean_poste) ** 2 for pc in poste_counts) / len(poste_counts)
                poste_score += poste_variance
        total_score = note_score * 2 + poste_score
        if total_score < best_score:
            best_score = total_score
            best_teams = teams
            max_note = max(notes_moyennes)
            min_note = min(notes_moyennes)
            if max_note - min_note > 1.5:
                warning_message = f"⚠️ Les contraintes d'affinité forcent un déséquilibre : écart de {max_note - min_note:.2f} points."
    if best_teams is None:
        raise ValueError("Impossible de générer des équipes respectant toutes les contraintes")
    return best_teams, warning_message

### MODIFIÉ ###
@api_router.post("/events/{event_id}/generate", response_model=GenerateTeamsResponse)
async def generate_teams(event_id: str, current_user: UserResponse = Depends(get_current_user)):
    # N'importe quel utilisateur connecté peut générer
    event_doc = await db.events.find_one({"id": event_id}, {"_id": 0})
    if not event_doc: raise HTTPException(status_code=404, detail="Événement non trouvé")
    event = Event(**event_doc)
    if not event.joueurs_presents:
        raise HTTPException(status_code=400, detail="Aucun joueur présent")
    
    joueur_ids = [jp.joueur_id for jp in event.joueurs_presents]
    joueurs_map = await get_player_details(joueur_ids)
    
    try:
        teams, warning = generate_balanced_teams(
            event.joueurs_presents,
            event.nombre_equipes,
            event.contraintes_affinite,
            joueurs_map
        )
        await db.events.update_one(
            {"id": event_id},
            {"$set": {"equipes_generees": teams, "warning_message": warning}}
        )
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
                        "note": notes_map.get(jid, player.note_generale),
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

# ============= SHARE LINK (MODIFIÉ) =============
@api_router.get("/share/{share_token}")
async def get_shared_event(share_token: str):
    event_doc = await db.events.find_one({"share_token": share_token}, {"_id": 0})
    if not event_doc: raise HTTPException(status_code=404, detail="Événement non trouvé")
    event = Event(**event_doc)
    if not event.equipes_generees:
        raise HTTPException(status_code=400, detail="Les équipes n'ont pas encore été générées")
    
    all_joueur_ids = [jp.joueur_id for jp in event.joueurs_presents]
    joueurs_map = await get_player_details(all_joueur_ids)
    notes_map = {jp.joueur_id: jp.note_temporaire for jp in event.joueurs_presents}
    
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
                    "note": notes_map.get(jid, player.note_generale),
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
    return {"message": "API Générateur d'Équipes de Foot V5 (Collaboratif)"}

# Include router
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()