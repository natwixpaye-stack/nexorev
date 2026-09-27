import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.join(__dirname, '..');
const DB_PATH = path.join(ROOT, 'nexorev-database.json');
const JWT_SECRET = process.env.JWT_SECRET || 'nexorev-secret-key-2025-premium-secure';

const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '2mb' }));

// --- Database JSON file persistence ---
function loadDB(){
  try{
    if(!fs.existsSync(DB_PATH)){
      const init = { users: [], sessions: [] };
      fs.writeFileSync(DB_PATH, JSON.stringify(init, null, 2));
      return init;
    }
    return JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
  }catch(e){
    console.error('DB load error', e);
    return { users: [] };
  }
}
function saveDB(db){
  try{
    fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
  }catch(e){ console.error('DB save error', e); }
}
let db = loadDB();

function uid(){ return Math.random().toString(36).slice(2,9) + Date.now().toString(36); }

// --- Auth middleware ---
function authMiddleware(req,res,next){
  const token = req.headers.authorization?.replace('Bearer ','');
  if(!token) return res.status(401).json({error:'No token'});
  try{
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.userId;
    next();
  }catch(e){
    return res.status(401).json({error:'Invalid token'});
  }
}

// --- API Routes ---

// Register
app.post('/api/register', async (req,res)=>{
  const { prenom, classe, specialites, objectif, temps, password } = req.body;
  if(!prenom || !prenom.trim()) return res.status(400).json({error:'Prénom requis'});
  if(!classe) return res.status(400).json({error:'Classe requise'});
  
  // Check if user with same prenom exists? Allow duplicates but with password
  const existing = db.users.find(u=>u.prenom.toLowerCase()===prenom.toLowerCase() && u.classe===classe);
  // For simplicity allow same prenom, but if password provided we check
  let passwordHash = null;
  if(password){
    passwordHash = await bcrypt.hash(password, 10);
  }

  const user = {
    id: uid(),
    prenom: prenom.trim(),
    classe: classe || 'Première générale',
    specialites: specialites || [],
    objectif: objectif || 'Tout à la fois',
    temps: temps || '30 min',
    passwordHash,
    createdAt: new Date().toISOString(),
    progress: { subjects: {} },
    planning: [
      {id: uid(), type:'Contrôle', matiere:'Mathématiques', titre:'Contrôle de maths', date:new Date(Date.now()+3*86400000).toISOString().slice(0,10)},
      {id: uid(), type:'Devoir', matiere:'SES', titre:'Devoir de SES', date:new Date(Date.now()+6*86400000).toISOString().slice(0,10)},
      {id: uid(), type:'Oral', matiere:'Français', titre:'Oral français', date:new Date(Date.now()+10*86400000).toISOString().slice(0,10)},
    ],
    activities: [],
    fichesPerso: [],
    flashcardsState: {}
  };
  db.users.push(user);
  saveDB(db);
  const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '30d' });
  const { passwordHash: _, ...safeUser } = user;
  res.json({ token, user: safeUser });
});

// Login (by prenom + password OR by id)
app.post('/api/login', async (req,res)=>{
  const { prenom, password, userId } = req.body;
  let user = null;
  if(userId){
    user = db.users.find(u=>u.id===userId);
  } else if(prenom){
    const candidates = db.users.filter(u=>u.prenom.toLowerCase()===prenom.toLowerCase());
    if(candidates.length===0) return res.status(404).json({error:'Utilisateur non trouvé'});
    if(candidates.length===1){
      user = candidates[0];
      if(user.passwordHash && password){
        const ok = await bcrypt.compare(password, user.passwordHash);
        if(!ok) return res.status(401).json({error:'Mot de passe incorrect'});
      }
    } else {
      // Multiple same prenom, need password to distinguish
      if(!password) return res.status(400).json({error:'Plusieurs comptes avec ce prénom, mot de passe requis', needPassword:true, count:candidates.length});
      for(const c of candidates){
        if(c.passwordHash && await bcrypt.compare(password, c.passwordHash)){
          user = c; break;
        }
      }
      if(!user) return res.status(401).json({error:'Mot de passe incorrect'});
    }
  } else {
    return res.status(400).json({error:'prenom ou userId requis'});
  }
  if(!user) return res.status(404).json({error:'Utilisateur non trouvé'});
  const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '30d' });
  const { passwordHash: _, ...safeUser } = user;
  res.json({ token, user: safeUser });
});

// List users (for login screen, only id and prenom and classe)
app.get('/api/users', (req,res)=>{
  const list = db.users.map(u=>({ id: u.id, prenom: u.prenom, classe: u.classe, specialites: u.specialites, createdAt: u.createdAt }));
  res.json(list);
});

// Get me
app.get('/api/me', authMiddleware, (req,res)=>{
  const user = db.users.find(u=>u.id===req.userId);
  if(!user) return res.status(404).json({error:'User not found'});
  const { passwordHash: _, ...safeUser } = user;
  res.json(safeUser);
});

// Update profile
app.put('/api/me', authMiddleware, (req,res)=>{
  const user = db.users.find(u=>u.id===req.userId);
  if(!user) return res.status(404).json({error:'User not found'});
  const { prenom, classe, specialites, objectif, temps } = req.body;
  if(prenom) user.prenom = prenom;
  if(classe) user.classe = classe;
  if(specialites) user.specialites = specialites;
  if(objectif) user.objectif = objectif;
  if(temps) user.temps = temps;
  saveDB(db);
  const { passwordHash: _, ...safeUser } = user;
  res.json(safeUser);
});

// Update progress
app.post('/api/progress', authMiddleware, (req,res)=>{
  const user = db.users.find(u=>u.id===req.userId);
  if(!user) return res.status(404).json({error:'User not found'});
  const { type, subjectId, chapterId, exoId, quizResult, flashcard, fiche, planning, activity } = req.body;
  
  user.progress = user.progress || { subjects: {} };
  user.progress.subjects = user.progress.subjects || {};
  
  if(type==='chapter_complete' && subjectId && chapterId){
    user.progress.subjects[subjectId] = user.progress.subjects[subjectId] || { chaptersCompleted: [], exosDone: [], quizResults: [] };
    if(!user.progress.subjects[subjectId].chaptersCompleted.includes(chapterId)){
      user.progress.subjects[subjectId].chaptersCompleted.push(chapterId);
    }
    user.lastChapter = { subjectId, chapterId };
  }
  if(type==='exo_done' && subjectId && exoId){
    user.progress.subjects[subjectId] = user.progress.subjects[subjectId] || { chaptersCompleted: [], exosDone: [], quizResults: [] };
    user.progress.subjects[subjectId].exosDone = user.progress.subjects[subjectId].exosDone || [];
    if(!user.progress.subjects[subjectId].exosDone.includes(exoId)){
      user.progress.subjects[subjectId].exosDone.push(exoId);
    }
  }
  if(type==='quiz' && quizResult){
    const { subjectId: sid, chapterId: cid, score } = quizResult;
    user.progress.subjects[sid] = user.progress.subjects[sid] || { chaptersCompleted: [], exosDone: [], quizResults: [] };
    user.progress.subjects[sid].quizResults = user.progress.subjects[sid].quizResults || [];
    user.progress.subjects[sid].quizResults.push({ chapterId: cid, score, date: new Date().toISOString() });
  }
  if(type==='activity' && activity){
    user.activities = user.activities || [];
    user.activities.unshift({ id: uid(), ...activity, date: new Date().toISOString() });
    user.activities = user.activities.slice(0,50);
  }
  if(type==='fiche' && fiche){
    user.fichesPerso = user.fichesPerso || [];
    const idx = user.fichesPerso.findIndex(f=>f.chapterId===fiche.chapterId);
    if(idx>=0) user.fichesPerso[idx].content = fiche.content;
    else user.fichesPerso.push({ id: uid(), ...fiche, date: new Date().toISOString() });
  }
  if(type==='planning_add' && planning){
    user.planning = user.planning || [];
    user.planning.push({ id: uid(), ...planning });
  }
  if(type==='planning_delete' && planning?.id){
    user.planning = (user.planning||[]).filter(p=>p.id!==planning.id);
  }
  if(type==='flashcard' && flashcard){
    user.flashcardsState = user.flashcardsState || {};
    user.flashcardsState[flashcard.key] = flashcard;
  }
  
  saveDB(db);
  const { passwordHash: _, ...safeUser } = user;
  res.json(safeUser);
});

// Delete account
app.delete('/api/me', authMiddleware, (req,res)=>{
  db.users = db.users.filter(u=>u.id!==req.userId);
  saveDB(db);
  res.json({ ok:true });
});

// Health
app.get('/api/health', (req,res)=>{
  res.json({ ok:true, users: db.users.length, uptime: process.uptime(), dbPath: DB_PATH });
});

// Serve static files (frontend)
app.use(express.static(ROOT, { index: false }));

// Fallback to index.html for SPA
app.get('*', (req,res)=>{
  if(req.path.startsWith('/api/')) return res.status(404).json({error:'Not found'});
  res.sendFile(path.join(ROOT, 'index.html'));
});

const PORT = process.env.PORT || 5173;
app.listen(PORT, '0.0.0.0', ()=>{
  console.log(`✅ NexoRév Server running on http://0.0.0.0:${PORT}`);
  console.log(`📁 DB: ${DB_PATH} (${db.users.length} users)`);
  console.log(`🔐 JWT Secret: ${JWT_SECRET.slice(0,10)}...`);
});
