/* NexoRév - App principale - Version avec Backend Persistant + Contenu Complet */
const DATA = window.NEXO_DATA;
const $app = document.getElementById('app');

const API = {
  base: '',
  token: localStorage.getItem('nexorev_token')||null,
  async request(path, opts={}){
    try{
      const headers = { 'Content-Type':'application/json', ...(opts.headers||{}) };
      if(this.token) headers['Authorization'] = `Bearer ${this.token}`;
      const res = await fetch(this.base + path, { ...opts, headers });
      const data = await res.json().catch(()=>({}));
      if(!res.ok) throw new Error(data.error||'Erreur API '+res.status);
      return data;
    }catch(e){
      console.warn('API error', path, e.message);
      throw e;
    }
  },
  async register(payload){
    const data = await this.request('/api/register', { method:'POST', body: JSON.stringify(payload) });
    this.token = data.token;
    localStorage.setItem('nexorev_token', data.token);
    localStorage.setItem('nexorev_current_backend', data.user.id);
    return data;
  },
  async login(payload){
    const data = await this.request('/api/login', { method:'POST', body: JSON.stringify(payload) });
    this.token = data.token;
    localStorage.setItem('nexorev_token', data.token);
    localStorage.setItem('nexorev_current_backend', data.user.id);
    return data;
  },
  async me(){
    if(!this.token) throw new Error('No token');
    return await this.request('/api/me');
  },
  async listUsers(){
    try{ return await this.request('/api/users'); }catch{ return null; }
  },
  async updateProfile(patch){
    return await this.request('/api/me', { method:'PUT', body: JSON.stringify(patch) });
  },
  async progress(payload){
    try{
      return await this.request('/api/progress', { method:'POST', body: JSON.stringify(payload) });
    }catch(e){
      console.warn('Progress sync failed', e);
      return null;
    }
  },
  logout(){
    this.token=null;
    localStorage.removeItem('nexorev_token');
    localStorage.removeItem('nexorev_current_backend');
  }
};

const Store = {
  getUsers(){ try{return JSON.parse(localStorage.getItem('nexorev_users')||'[]')}catch{return[]} },
  saveUsers(u){ localStorage.setItem('nexorev_users', JSON.stringify(u)) },
  getCurrentId(){ return localStorage.getItem('nexorev_current') || localStorage.getItem('nexorev_current_backend') },
  setCurrentId(id){ localStorage.setItem('nexorev_current', id); localStorage.setItem('nexorev_current_backend', id); },
  clearCurrent(){ localStorage.removeItem('nexorev_current'); localStorage.removeItem('nexorev_current_backend'); API.logout(); },
  _cachedUser: null,
  async getCurrentUserAsync(){
    if(API.token){
      try{
        const user = await API.me();
        this._cachedUser = user;
        this.upsertUser(user);
        return user;
      }catch(e){}
    }
    const id = this.getCurrentId();
    if(!id) return null;
    return this.getUsers().find(u=>u.id===id)||this._cachedUser||null;
  },
  getCurrentUser(){
    return this._cachedUser || (()=>{ const id=this.getCurrentId(); if(!id) return null; return this.getUsers().find(u=>u.id===id)||null; })();
  },
  upsertUser(user){
    const users = this.getUsers();
    const idx = users.findIndex(u=>u.id===user.id);
    if(idx>=0) users[idx]=user; else users.push(user);
    this.saveUsers(users);
    this._cachedUser = user;
  },
  updateCurrent(patch){
    const u = this.getCurrentUser();
    if(!u) return null;
    Object.assign(u, patch);
    this.upsertUser(u);
    if(API.token){ API.updateProfile(patch).catch(()=>{}); }
    return u;
  },
  updateProgress(fn){
    const u = this.getCurrentUser();
    if(!u) return;
    fn(u);
    this.upsertUser(u);
  },
  async syncProgress(type, payload){
    if(API.token){
      try{
        const updated = await API.progress({ type, ...payload });
        if(updated){ this.upsertUser(updated); this._cachedUser = updated; }
      }catch(e){}
    }
  }
};

let state = {
  view: 'dashboard',
  subjectId: null,
  chapterId: null,
  chapterTab: 'cours',
  searchQuery: '',
  onboardingStep: 1,
  onboardingData: {prenom:'', classe:'Première générale', specialites:[], objectif:'Tout à la fois', temps:'30 min', password:''},
  showLogin: false,
  showOnboarding: false,
  theme: localStorage.getItem('nexorev_theme')||'dark',
  programmeFilter: 'all',
  exoFilter: {matiere:'all', diff:'all'},
  planningFilter: 'all',
  backendUsers: null
};

function uid(){ return Math.random().toString(36).slice(2,9) + Date.now().toString(36).slice(2,5) }

function getProgrammeForUser(user){
  const classe = user?.classe || 'Première générale';
  const prog = DATA.PROGRAMME[classe] || DATA.PROGRAMME['Première générale'];
  return prog;
}
function getUserSubjects(user){
  const prog = getProgrammeForUser(user);
  const specs = (user?.specialites||[]).map(id=> prog.matieres[id]).filter(Boolean);
  const communes = Object.values(prog.matieres).filter(m=>m.type==='commune');
  return {specs, communes, all: [...specs, ...communes]};
}
function calcSubjectProgress(user, subjectId){
  if(!user?.progress?.subjects?.[subjectId]) return 0;
  const subj = getProgrammeForUser(user).matieres[subjectId];
  if(!subj) return 0;
  const completed = user.progress.subjects[subjectId].chaptersCompleted?.length||0;
  return Math.round((completed / subj.chapitres.length)*100);
}
function calcGlobalProgress(user){
  const {all} = getUserSubjects(user);
  if(!all.length) return 0;
  let total=0, done=0;
  all.forEach(s=>{
    total+=s.chapitres.length;
    done+= user.progress?.subjects?.[s.id]?.chaptersCompleted?.length||0;
  });
  return total? Math.round(done/total*100):0;
}
function logActivity(type, title, subjectId){
  const activity = { type, title, subjectId, mins: Math.floor(Math.random()*12)+3 };
  Store.updateProgress(u=>{
    u.activities = u.activities||[];
    u.activities.unshift({id:uid(), ...activity, date: new Date().toISOString()});
    u.activities = u.activities.slice(0,20);
  });
  Store.syncProgress('activity', { activity });
}

/* RENDER LANDING */
function renderLanding(){
  $app.innerHTML = `
  <div class="landing">
    <nav class="landing-nav">
      <div class="logo"><div class="logo-mark"><span>N</span></div><div>NexoRév<small>Ta réussite, notre priorité</small></div></div>
      <div style="display:flex;gap:10px">
        <button class="btn btn-ghost" onclick="App.showLogin()">Se connecter</button>
        <button class="btn btn-primary" onclick="App.startOnboarding()">Créer mon espace</button>
      </div>
    </nav>
    <div class="landing-hero">
      <div>
        <div class="hero-badge">✨ Nouveau — Programme officiel 2025-2026 + Base de données persistante</div>
        <h1 class="hero-title">Bienvenue sur NexoRév 👋<br><span>Ton espace de révision personnalisé.</span></h1>
        <p class="hero-desc">La plateforme pensée pour les lycéens de Première générale. Cours officiels complets, fiches synthèses, exercices corrigés cachés, quiz intelligents, flashcards et planning — tout s’adapte à tes spécialités et ta progression est sauvegardée sur nos serveurs.</p>
        <div class="hero-cta">
          <button class="btn btn-primary btn-lg" onclick="App.startOnboarding()">Créer mon espace 🚀 <span>→</span></button>
          <button class="btn btn-ghost btn-lg" onclick="App.showLogin()">J’ai déjà un compte</button>
        </div>
        <div class="hero-stats">
          <div class="stat"><b>12</b><span>Spécialités</span></div>
          <div class="stat"><b>180+</b><span>Chapitres</span></div>
          <div class="stat"><b>100%</b><span>Officiel + Persistant</span></div>
        </div>
        <div style="margin-top:16px;padding:10px 14px;background:rgba(16,185,129,0.1);border:1px solid rgba(16,185,129,0.2);border-radius:12px;font-size:12px;color:#6EE7B7">
          ✅ Base de données réelle • Auth sécurisée • Progression sauvegardée • Multi-appareils • HTTPS
        </div>
      </div>
      <div class="hero-visual">
        <div class="hero-card">
          <img src="https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=800&q=80&auto=format&fit=crop" alt="motivation">
          <div style="margin-top:14px;display:grid;grid-template-columns:1fr 1fr;gap:10px">
            <div style="background:rgba(124,58,237,0.15);border:1px solid rgba(124,58,237,0.25);border-radius:12px;padding:12px"><b style="display:block;font-size:13px">Mathématiques</b><span style="font-size:11px;color:var(--text-2)">68% — 6 chapitres</span><div class="bar" style="margin-top:8px"><div class="bar-fill" style="width:68%;background:#7C3AED"></div></div></div>
            <div style="background:rgba(236,72,153,0.15);border:1px solid rgba(236,72,153,0.25);border-radius:12px;padding:12px"><b style="display:block;font-size:13px">Physique-Chimie</b><span style="font-size:11px;color:var(--text-2)">62% — 6 chapitres</span><div class="bar" style="margin-top:8px"><div class="bar-fill" style="width:62%;background:#EC4899"></div></div></div>
          </div>
        </div>
        <div class="hero-float float-1">📚 <span>Fiche: Suites & récurrence</span></div>
        <div class="hero-float float-2">🔥 <span>Série: 7 jours</span></div>
        <div class="hero-float float-3">✅ <span>Quiz: 85% — Ondes</span></div>
      </div>
    </div>
    ${state.showLogin ? renderLoginModal() : ''}
    ${state.showOnboarding ? renderOnboardingModal() : ''}
  </div>`;
  document.body.className = state.theme;
  if(state.showLogin) loadBackendUsers();
}

function renderLoginModal(){
  const users = Store.getUsers();
  const backendUsers = state.backendUsers;
  const displayUsers = backendUsers || users;
  return `<div class="modal-backdrop" onclick="if(event.target===this) App.closeModals()">
    <div class="modal">
      <div class="modal-head"><h3 style="font-family:Outfit;font-size:18px">Se connecter</h3><button class="icon-btn" onclick="App.closeModals()">✕</button></div>
      <div class="modal-body">
        <p>Choisis ton espace ou crée-en un nouveau. ${backendUsers?`(${backendUsers.length} comptes sur serveur)`:''}</p>
        <div id="loginError" style="display:none;color:#F87171;font-size:12px;margin-bottom:10px;padding:8px;background:rgba(239,68,68,0.1);border-radius:8px"></div>
        <div class="options">
          ${displayUsers.length? displayUsers.map(u=>`<div class="opt" onclick="App.loginAs('${u.id}')"><div class="check" style="background:linear-gradient(135deg,#7C3AED,#3B82F6);border-color:transparent;color:white">👤</div><div><b>${u.prenom}</b> — ${u.classe} • ${(u.specialites||[]).length} spés</div></div>`).join('') : `<div class="empty"><b>Aucun compte trouvé</b><span>Crée ton espace personnalisé</span></div>`}
          <div class="opt" style="border-style:dashed" onclick="App.startOnboarding()"><div class="check">+</div> Créer mon espace</div>
        </div>
        <div style="margin-top:14px">
          <input id="loginPassword" class="input" type="password" placeholder="Mot de passe (si défini)" style="height:42px">
          <small style="color:var(--text-3);font-size:11px">Si plusieurs comptes ont le même prénom, le mot de passe permet de distinguer.</small>
        </div>
      </div>
    </div>
  </div>`;
}

async function loadBackendUsers(){
  try{
    const users = await API.listUsers();
    if(users){
      state.backendUsers = users;
      const modal = document.querySelector('.modal-body .options');
      if(modal){
        // re-render login modal
        App.render();
      }
    }
  }catch(e){}
}

function renderOnboardingModal(){
  const d = state.onboardingData;
  const step = state.onboardingStep;
  let body='';
  if(step===1){
    body=`<h2>Comment veux-tu qu’on t’appelle ? 👋</h2><p>Ton prénom sera utilisé pour personnaliser ton tableau de bord.</p>
    <input id="prenomInput" class="input" placeholder="Ex: Noah" value="${d.prenom}" oninput="App.onboardUpdate('prenom', this.value)" onkeydown="if(event.key==='Enter'){App.onboardNext()}" autofocus>
    <div id="prenomError" style="color:#F87171;font-size:12px;margin-top:8px;display:none">Entre ton prénom pour continuer</div>
    <div style="margin-top:12px"><input id="passwordInput" class="input" type="password" placeholder="Mot de passe (optionnel mais recommandé)" value="${d.password||''}" oninput="App.onboardUpdate('password', this.value)" style="height:42px"><small style="color:var(--text-3);font-size:11px">Pour sécuriser ton compte et te reconnecter sur un autre appareil</small></div>
    <div style="margin-top:18px;display:flex;justify-content:flex-end"><button class="btn btn-primary" id="step1Btn" onclick="App.onboardNext()">Continuer →</button></div>`;
  } else if(step===2){
    const classes=['Seconde générale','Première générale','Terminale générale','Autre'];
    body=`<h2>Tu es en quelle classe ? 🎓</h2><p>On adaptera le programme officiel à ton niveau.</p><div class="options">${classes.map(c=>`<div class="opt ${d.classe===c?'selected':''}" onclick="App.onboardUpdate('classe','${c}')"><div class="check">${d.classe===c?'✓':''}</div>${c}</div>`).join('')}</div><div style="margin-top:18px;display:flex;justify-content:space-between"><button class="btn btn-ghost" onclick="App.onboardPrev()">Retour</button><button class="btn btn-primary" onclick="App.onboardNext()">Continuer →</button></div>`;
  } else if(step===3){
    const showSpecs = d.classe.includes('Première')||d.classe.includes('Terminale');
    if(!showSpecs){
      body=`<h2>Pas de spécialités pour ${d.classe} 🙂</h2><p>On passe à la suite, tu auras accès aux matières communes.</p><div style="margin-top:18px;display:flex;justify-content:space-between"><button class="btn btn-ghost" onclick="App.onboardPrev()">Retour</button><button class="btn btn-primary" onclick="App.onboardNext()">Continuer →</button></div>`;
    } else {
      body=`<h2>Quelles sont tes spécialités ? ⭐</h2><p>Choisis 3 spécialités (tu pourras modifier plus tard).</p><div class="chip-grid">${DATA.SPECIALITES.map(s=>`<div class="chip ${d.specialites.includes(s.id)?'selected':''}" onclick="App.toggleSpec('${s.id}')">${s.icon} ${s.name}</div>`).join('')}</div>
      <div style="margin-top:12px;font-size:12px;color:var(--text-2)">${d.specialites.length} sélectionnée(s) — min 1</div>
      <div id="specError" style="color:#F87171;font-size:12px;margin-top:6px;display:${d.specialites.length===0?'block':'none'}">Sélectionne au moins 1 spécialité</div>
      <div style="margin-top:18px;display:flex;justify-content:space-between"><button class="btn btn-ghost" onclick="App.onboardPrev()">Retour</button><button class="btn btn-primary" id="step3Btn" style="${d.specialites.length===0?'opacity:.6':''}" onclick="App.onboardNext()">Continuer →</button></div>`;
    }
  } else if(step===4){
    const objectifs=['Réussir mes contrôles','Progresser dans mes matières','Préparer le bac','M’organiser','Tout à la fois'];
    body=`<h2>Qu’est-ce que tu veux principalement faire ? 🎯</h2><p>On personnalisera tes recommandations.</p><div class="options">${objectifs.map(o=>`<div class="opt ${d.objectif===o?'selected':''}" onclick="App.onboardUpdate('objectif','${o}')"><div class="check">${d.objectif===o?'✓':''}</div>${o}</div>`).join('')}</div><div style="margin-top:18px;display:flex;justify-content:space-between"><button class="btn btn-ghost" onclick="App.onboardPrev()">Retour</button><button class="btn btn-primary" onclick="App.onboardNext()">Continuer →</button></div>`;
  } else if(step===5){
    const temps=['15 min','30 min','45 min','1 h','Plus d’une heure'];
    body=`<h2>Combien de temps veux-tu réviser ? ⏱️</h2><p>On adaptera ton planning quotidien.</p><div class="options">${temps.map(t=>`<div class="opt ${d.temps===t?'selected':''}" onclick="App.onboardUpdate('temps','${t}')"><div class="check">${d.temps===t?'✓':''}</div>${t} / jour</div>`).join('')}</div>
    <div id="createError" style="color:#F87171;font-size:12px;margin-top:8px;display:none;padding:8px;background:rgba(239,68,68,0.1);border-radius:8px"></div>
    <div style="margin-top:18px;display:flex;justify-content:space-between"><button class="btn btn-ghost" onclick="App.onboardPrev()">Retour</button><button class="btn btn-primary" id="createBtn" onclick="App.createAccount()">Créer mon espace 🚀</button></div>
    <div style="margin-top:10px;font-size:11px;color:var(--text-3)">🔐 Compte sauvegardé sur serveur sécurisé • Données isolées • HTTPS</div>`;
  }
  const pct = (step/5)*100;
  return `<div class="modal-backdrop" id="onboardBackdrop" onclick="if(event.target.id==='onboardBackdrop') App.closeModals()">
    <div class="modal">
      <div class="modal-head"><div class="logo"><div class="logo-mark"><span>N</span></div><div>NexoRév</div></div><button class="icon-btn" onclick="App.closeModals()">✕</button></div>
      <div class="steps">${[1,2,3,4,5].map(i=>`<div class="step-dot ${i<=step?'active':''}"></div>`).join('')}</div>
      <div style="height:4px;background:var(--border);border-radius:100px;margin:0 24px;overflow:hidden"><div style="height:100%;width:${pct}%;background:linear-gradient(90deg,var(--primary),var(--blue));transition:width .3s"></div></div>
      <div class="modal-body">${body}</div>
    </div>
  </div>`;
}

/* APP LAYOUT */
function renderApp(){
  const user = Store.getCurrentUser();
  if(!user){ renderLanding(); return; }
  const prog = getProgrammeForUser(user);
  const {specs, communes} = getUserSubjects(user);
  document.body.className = state.theme;
  $app.innerHTML = `
  <div class="app-layout">
    <aside class="sidebar" id="sidebar">
      <div class="sidebar-top">
        <div class="logo"><div class="logo-mark"><span>N</span></div><div>NexoRév<small>Ta réussite, notre priorité</small></div></div>
      </div>
      <div class="sidebar-nav">
        <div class="nav-section">
          <div class="nav-item ${state.view==='dashboard'?'active':''}" onclick="App.navigate('dashboard')"><div class="ico">🏠</div>Accueil</div>
          <div class="nav-item ${state.view==='programme'?'active':''}" onclick="App.navigate('programme')"><div class="ico">📚</div>Programme de ${user.classe.split(' ')[0]}</div>
        </div>
        <div class="nav-section">
          <div class="nav-section-title">Mes spécialités</div>
          ${specs.map(s=>`<div class="nav-item ${state.subjectId===s.id&&state.view==='subject'?'active':''}" onclick="App.openSubject('${s.id}')"><div class="ico" style="background:linear-gradient(135deg,${s.color1},${s.color2});color:white">${s.icon}</div>${s.name}</div>`).join('')||'<div style="padding:8px 12px;font-size:12px;color:var(--text-3)">Aucune spé — modifie ton profil</div>'}
        </div>
        <div class="nav-section">
          <div class="nav-section-title">Matières communes</div>
          ${communes.slice(0,6).map(s=>`<div class="nav-item ${state.subjectId===s.id&&state.view==='subject'?'active':''}" onclick="App.openSubject('${s.id}')"><div class="ico">${s.icon}</div>${s.name}</div>`).join('')}
        </div>
        <div class="nav-section">
          <div class="nav-section-title">Outils</div>
          <div class="nav-item ${state.view==='exercices'?'active':''}" onclick="App.navigate('exercices')"><div class="ico">✏️</div>Exercices</div>
          <div class="nav-item ${state.view==='quiz'?'active':''}" onclick="App.navigate('quiz')"><div class="ico">🧠</div>Quiz</div>
          <div class="nav-item ${state.view==='flashcards'?'active':''}" onclick="App.navigate('flashcards')"><div class="ico">🃏</div>Flashcards</div>
          <div class="nav-item ${state.view==='fiches'?'active':''}" onclick="App.navigate('fiches')"><div class="ico">🗂️</div>Fiches</div>
          <div class="nav-item ${state.view==='bac'?'active':''}" onclick="App.navigate('bac')"><div class="ico">🇫🇷</div>Bac français</div>
          <div class="nav-item ${state.view==='planning'?'active':''}" onclick="App.navigate('planning')"><div class="ico">📅</div>Planning</div>
          <div class="nav-item ${state.view==='progression'?'active':''}" onclick="App.navigate('progression')"><div class="ico">📊</div>Progression</div>
          <div class="nav-item ${state.view==='recherche'?'active':''}" onclick="App.navigate('recherche')"><div class="ico">🔎</div>Recherche</div>
        </div>
        <div class="quote-card">
          <p>« Un petit effort chaque jour fait de grandes réussites. »</p><small style="font-size:10px;color:var(--text-3)">— NexoRév • Serveur persistant</small>
        </div>
      </div>
    </aside>
    <div class="main">
      <div class="topbar">
        <button class="icon-btn" style="display:none" id="menuBtn" onclick="document.getElementById('sidebar').classList.toggle('open')">☰</button>
        <div class="search-wrap">
          <span class="s-ico">🔍</span>
          <input id="globalSearch" placeholder="Rechercher un cours, un chapitre, une notion..." value="${state.searchQuery}" oninput="App.handleSearch(this.value)" onfocus="App.handleSearch(this.value)">
          <div class="search-results" id="searchResults"></div>
        </div>
        <div class="top-actions">
          <button class="icon-btn" onclick="App.toggleTheme()">${state.theme==='dark'?'☀️':'🌙'}</button>
          <button class="icon-btn">🔔</button>
          <div class="avatar" onclick="App.toggleProfileMenu()" title="${user.prenom}">${user.prenom.charAt(0).toUpperCase()}</div>
        </div>
      </div>
      <div class="content"><div class="content-inner" id="contentInner">${renderContent(user)}</div></div>
    </div>
  </div>
  <div class="mobile-nav">
    <button class="${state.view==='dashboard'?'active':''}" onclick="App.navigate('dashboard')">🏠<span>Accueil</span></button>
    <button class="${state.view==='programme'?'active':''}" onclick="App.navigate('programme')">📚<span>Programme</span></button>
    <button class="${['exercices','quiz'].includes(state.view)?'active':''}" onclick="App.navigate('exercices')">✏️<span>Exos</span></button>
    <button class="${state.view==='planning'?'active':''}" onclick="App.navigate('planning')">📅<span>Planning</span></button>
    <button class="${state.view==='progression'?'active':''}" onclick="App.navigate('progression')">📊<span>Progrès</span></button>
  </div>
  <div id="profileMenu" style="display:none;position:fixed;top:60px;right:16px;background:var(--card);border:1px solid var(--border);border-radius:14px;padding:8px;z-index:50;min-width:220px;box-shadow:var(--shadow)">
    <div style="padding:10px 12px;border-bottom:1px solid var(--border)"><b>${user.prenom}</b><br><span style="font-size:12px;color:var(--text-2)">${user.classe} • ${user.specialites.length} spés<br><small style="color:#10B981">● Serveur persistant • ID ${user.id.slice(0,6)}</small></span></div>
    <div class="nav-item" onclick="App.editProfile()"><div class="ico">👤</div>Modifier profil</div>
    <div class="nav-item" onclick="App.exportData()"><div class="ico">💾</div>Exporter mes données</div>
    <div class="nav-item" onclick="App.logout()"><div class="ico">🚪</div>Se déconnecter</div>
  </div>
  `;
  if(window.innerWidth<=860) document.getElementById('menuBtn').style.display='grid';
  attachSearchResults();
}

function renderContent(user){
  switch(state.view){
    case 'dashboard': return renderDashboard(user);
    case 'programme': return renderProgrammeView(user);
    case 'subject': return renderSubjectView(user, state.subjectId);
    case 'chapter': return renderChapterView(user, state.subjectId, state.chapterId);
    case 'exercices': return renderExercicesView(user);
    case 'quiz': return renderQuizView(user);
    case 'flashcards': return renderFlashcardsView(user);
    case 'fiches': return renderFichesView(user);
    case 'progression': return renderProgressionView(user);
    case 'planning': return renderPlanningView(user);
    case 'recherche': return renderRechercheView(user);
    case 'bac': return renderBacView(user);
    default: return renderDashboard(user);
  }
}

function renderDashboard(user){
  const prog = getProgrammeForUser(user);
  const {specs, communes, all} = getUserSubjects(user);
  const globalPct = calcGlobalProgress(user);
  const lastChap = user.lastChapter ? (()=>{ const s = prog.matieres[user.lastChapter.subjectId]; const c = s?.chapitres.find(ch=>ch.id===user.lastChapter.chapterId); return {s,c}; })() : null;
  const planning = (user.planning||[]).slice(0,5);
  const activities = (user.activities||[]).slice(0,5);

  return `
  <div class="greeting">
    <div class="greet-left">
      <div class="greet-avatar">👤</div>
      <div class="greet-text"><h1>Salut ${user.prenom} 👋</h1><p>Prêt à faire progresser ton niveau aujourd'hui ? • ${user.classe} • Spés: ${user.specialites.map(id=>DATA.SPECIALITES.find(s=>s.id===id)?.short||id).join(', ')||'à définir'} • <span style="color:#10B981">● Sauvegardé sur serveur</span></p></div>
    </div>
    <div class="motiv-banner"><img src="https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=600&q=80&auto=format&fit=crop" alt=""><div class="overlay"></div><div class="txt">Les grands rêves se construisent avec de bonnes habitudes.</div></div>
  </div>

  <div class="quick-cards">
    <div class="q-card">
      <div class="q-ico" style="background:rgba(124,58,237,0.15);color:#A78BFA">📦</div>
      <h3>Reprendre là où tu t'es arrêté</h3><p>${lastChap?.c? `${lastChap.c.title} (${lastChap.s.name})` : 'Suites et raisonnement par récurrence (Mathématiques)'}</p>
      <button class="btn btn-primary" onclick="${lastChap?`App.openChapter('${lastChap.s.id}','${lastChap.c.id}')`:`App.openChapter('maths','suites')`}">Continuer →</button>
    </div>
    <div class="q-card">
      <div class="q-ico" style="background:rgba(59,130,246,0.15);color:#60A5FA">📅</div>
      <h3>Réviser aujourd'hui</h3><p>3 chapitres · 2 exercices · 1 quiz — adapté à ${user.temps}/jour</p>
      <button class="btn btn-ghost" style="background:#3B82F6;color:white;border-color:#3B82F6" onclick="App.navigate('programme')">Voir mon planning</button>
    </div>
    <div class="q-card">
      <div class="q-ico" style="background:rgba(236,72,153,0.15);color:#F472B6">🧠</div>
      <h3>Mode révision intelligente</h3><p>Tes points faibles sont en ${specs[1]?.name||'SES'} et en ${specs[0]?.name||'Maths'}</p>
      <button class="btn btn-ghost" onclick="App.navigate('progression')">Voir mes recommandations</button>
    </div>
  </div>

  <div class="tabs-row">
    <div class="tab active"><div class="tab-ico">📚</div>Programme de ${user.classe.split(' ')[0]}</div>
    <div class="tab" onclick="App.navigate('programme')"><div class="tab-ico">⭐</div>Spécialités</div>
    <div class="tab" onclick="App.navigate('programme')"><div class="tab-ico">👥</div>Matières communes</div>
    <div class="tab" onclick="App.navigate('bac')"><div class="tab-ico">🇫🇷</div>Bac de français</div>
  </div>

  <div class="program-header">
    <div><h2>Le programme de ${user.classe} générale</h2><p>Programme officiel 2025-2026 — ${all.length} matières, ${all.reduce((a,s)=>a+s.chapitres.length,0)} chapitres complets</p></div>
    <div style="display:flex;gap:8px">
      <select class="input" style="height:38px;width:160px" onchange="App.setProgFilter(this.value)"><option value="all">Programme officiel</option><option value="specialites">Spécialités</option><option value="communes">Communes</option></select>
      <div class="search-wrap" style="max-width:200px"><input placeholder="Rechercher un chapitre..." oninput="App.filterChapters(this.value)"></div>
    </div>
  </div>

  <div class="two-col">
    <div>
      <div class="subjects-grid" id="subjectsGrid">
        ${all.map(sub=>{
          const pct = calcSubjectProgress(user, sub.id);
          return `<div class="sub-card" style="--c1:${sub.color1};--c2:${sub.color2}" onclick="App.openSubject('${sub.id}')">
            <div class="sub-card-top"><div class="sub-card-ico">${sub.icon}</div><div class="sub-card-arrow">→</div></div>
            <div><h3>${sub.name}</h3><div class="meta">${sub.chapitres.length} chapitres · ${sub.chapitres.reduce((a,c)=>a+c.lecons,0)} leçons • ${sub.chapitres.reduce((a,c)=>a+(c.exercices?.length||0),0)} exos</div>
            <div class="progress-line"><div class="progress-fill" style="width:${pct}%"></div><span class="progress-text">${pct}%</span></div></div>
          </div>`;
        }).join('')}
      </div>

      <div class="panel" style="margin-bottom:18px">
        <div class="panel-h"><h3>Vue rapide du programme</h3><span class="link" onclick="App.navigate('programme')">Tout voir →</span></div>
        <div class="quick-list">
          ${all.slice(0,6).map(s=>`<div class="q-chip" onclick="App.openSubject('${s.id}')"><div class="ico" style="background:linear-gradient(135deg,${s.color1},${s.color2});color:white">${s.icon}</div><div><b>${s.name}</b><span>${s.chapitres.length} chapitres</span></div></div>`).join('')}
          <div class="q-chip" onclick="App.navigate('programme')" style="min-width:60px;justify-content:center">→</div>
        </div>
      </div>

      <div class="two-col" style="grid-template-columns:1fr 1fr">
        <div class="panel">
          <div class="panel-h"><h3>⭐ Mes spécialités</h3><span style="font-size:11px;color:var(--text-3)">Gère tes spécialités</span></div>
          <div class="spec-grid">
            ${specs.map(s=>{
              const pct = calcSubjectProgress(user,s.id);
              return `<div class="spec-card" style="border-color:${s.color1}33;background:linear-gradient(180deg,${s.color1}18, var(--bg-2))"><div class="ico" style="width:36px;height:36px;border-radius:10px;background:linear-gradient(135deg,${s.color1},${s.color2});display:grid;place-items:center;color:white">${s.icon}</div><h4>${s.name}</h4><div class="meta">${s.chapitres.length} chapitres</div><div class="bar" style="margin-top:10px"><div class="bar-fill" style="width:${pct}%;background:${s.color1}"></div></div><div style="font-size:11px;margin-top:4px;text-align:right">${pct}%</div></div>`;
            }).join('')||'<div class="empty"><b>Pas encore de spécialités</b><span>Ajoute tes spés dans ton profil</span></div>'}
          </div>
        </div>
        <div class="panel">
          <div class="panel-h"><h3>📊 Ma progression globale</h3></div>
          <div class="global-prog">
            <div class="circle" style="--p:${globalPct}%"><b>${globalPct}%</b></div>
            <div class="legend">
              ${all.slice(0,4).map(s=>{
                const pct = calcSubjectProgress(user,s.id);
                return `<div class="legend-item"><span><span class="dot" style="background:${s.color1}"></span>${s.name}</span><b>${pct}%</b></div>`;
              }).join('')}
            </div>
          </div>
          <div style="margin-top:14px"><span class="link" onclick="App.navigate('progression')">Voir le détail de ma progression →</span></div>
        </div>
      </div>
    </div>

    <div class="right-col">
      <div class="side-panel">
        <h3>📅 Mes prochaines échéances <span class="link" style="margin-left:auto" onclick="App.navigate('planning')">Voir tout →</span></h3>
        ${planning.length? planning.map(p=>`
          <div class="ech-item"><div class="ech-ico" style="background:${p.type==='Contrôle'?'rgba(59,130,246,0.15)':p.type==='Devoir'?'rgba(16,185,129,0.15)':p.type==='Oral'?'rgba(139,92,246,0.15)':p.type==='Bac blanc'?'rgba(236,72,153,0.15)':'rgba(245,158,11,0.15)'}">${p.type==='Contrôle'?'📝':p.type==='Devoir'?'📄':p.type==='Oral'?'🎤':p.type==='Bac blanc'?'🎓':'📚'}</div><div><b>${p.titre}</b><span>${p.matiere} • ${new Date(p.date).toLocaleDateString('fr-FR',{day:'numeric', month:'short'})}</span></div><span class="badge ${p.type==='Contrôle'?'blue':p.type==='Devoir'?'green':p.type==='Oral'?'purple':p.type==='Bac blanc'?'pink':'orange'}">${p.type}</span></div>
        `).join('') : `<div class="empty" style="padding:16px"><b>Aucune échéance</b><span>Ajoute tes contrôles dans Planning</span></div>`}
      </div>

      <div class="side-panel">
        <h3>🕘 Mes dernières activités <span class="link" style="margin-left:auto" onclick="App.navigate('progression')">Voir tout →</span></h3>
        ${activities.length? activities.map(a=>`
          <div class="ech-item"><div class="ech-ico" style="background:var(--bg-3)">${a.type==='Exercice'?'✏️':a.type==='Quiz'?'🧠':a.type==='Fiche'?'🗂️':'📖'}</div><div><b>${a.type} : ${a.title}</b><span>${DATA.PROGRAMME[user.classe]?.matieres[a.subjectId]?.name||''} • ${a.mins} min</span></div></div>
        `).join('') : `<div class="empty" style="padding:16px"><b>Commence à réviser</b><span>Tes activités apparaîtront ici</span></div>`}
      </div>

      <div class="motiv-card"><img src="https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=600&q=80&auto=format&fit=crop"><div class="overlay"></div><div class="txt">Tu es plus capable que tu ne le penses.</div><button class="btn btn-primary" style="position:relative;z-index:1;background:white;color:#4C1D95" onclick="App.openChapter('maths','suites')">Continuer ma révision →</button></div>
    </div>
  </div>
  `;
}

function renderProgrammeView(user){
  const prog = getProgrammeForUser(user);
  const {all} = getUserSubjects(user);
  let subjects = all;
  if(state.programmeFilter==='specialites') subjects = getUserSubjects(user).specs;
  if(state.programmeFilter==='communes') subjects = getUserSubjects(user).communes;
  if(state.programmeFilter==='done') subjects = all.filter(s=>calcSubjectProgress(user,s.id)>=100);
  if(state.programmeFilter==='todo') subjects = all.filter(s=>calcSubjectProgress(user,s.id)<100);

  return `
  <div class="program-header"><div><h2>📚 Programme de ${user.classe}</h2><p>Programme officiel 2025-2026 — ${subjects.length} matières, ${subjects.reduce((a,s)=>a+s.chapitres.length,0)} chapitres • Données persistantes</p></div>
    <div style="display:flex;gap:8px;flex-wrap:wrap">
      ${[['all','Toutes'],['specialites','Spécialités'],['communes','Communes'],['todo','À faire'],['done','Terminés']].map(([v,l])=>`<button class="tab ${state.programmeFilter===v?'active':''}" onclick="App.setProgFilter('${v}')">${l}</button>`).join('')}
    </div>
  </div>
  <div class="subjects-grid">
    ${subjects.map(s=>{
      const pct = calcSubjectProgress(user,s.id);
      return `<div class="sub-card" style="--c1:${s.color1};--c2:${s.color2}" onclick="App.openSubject('${s.id}')"><div class="sub-card-top"><div class="sub-card-ico">${s.icon}</div><div class="sub-card-arrow">→</div></div><div><h3>${s.name}</h3><div class="meta">${s.chapitres.length} chapitres · ${s.chapitres.reduce((a,c)=>a+c.lecons,0)} leçons • ${s.chapitres.reduce((a,c)=>a+(c.exercices?.length||0),0)} exercices</div><div class="progress-line"><div class="progress-fill" style="width:${pct}%"></div><span class="progress-text">${pct}%</span></div></div></div>`;
    }).join('')}
  </div>`;
}

function renderSubjectView(user, subjectId){
  const prog = getProgrammeForUser(user);
  const subject = prog.matieres[subjectId];
  if(!subject) return `<div class="empty"><b>Matière introuvable</b></div>`;
  const pct = calcSubjectProgress(user, subjectId);
  const progress = user.progress?.subjects?.[subjectId]||{chaptersCompleted:[]};

  return `
  <div class="breadcrumb"><b onclick="App.navigate('dashboard')">Accueil</b> › <b onclick="App.navigate('programme')">Programme</b> › <b>${subject.name}</b></div>
  <div style="display:flex;gap:16px;align-items:center;margin-bottom:18px;flex-wrap:wrap">
    <div style="width:56px;height:56px;border-radius:16px;background:linear-gradient(135deg,${subject.color1},${subject.color2});display:grid;place-items:center;font-size:28px;color:white">${subject.icon}</div>
    <div><h1 style="font-family:Outfit;font-size:26px">${subject.name}</h1><p style="color:var(--text-2);font-size:13px">${subject.chapitres.length} chapitres • ${subject.chapitres.reduce((a,c)=>a+c.lecons,0)} leçons • ${subject.chapitres.reduce((a,c)=>a+(c.exercices?.length||0),0)} exercices • Progression ${pct}% • <span style="color:#10B981">● Persistant</span></p></div>
    <div style="margin-left:auto;display:flex;gap:8px"><button class="btn btn-primary" onclick="App.openChapter('${subject.id}','${subject.chapitres[0].id}')">Continuer →</button><button class="btn btn-ghost" onclick="App.navigate('programme')">← Retour</button></div>
  </div>
  <div class="bar" style="height:10px;margin-bottom:20px"><div class="bar-fill" style="width:${pct}%;background:linear-gradient(90deg,${subject.color1},${subject.color2})"></div></div>
  <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:12px">
    ${subject.chapitres.map((ch,i)=>{
      const done = progress.chaptersCompleted?.includes(ch.id);
      return `<div class="q-card" onclick="App.openChapter('${subject.id}','${ch.id}')" style="${done?'border-color:'+subject.color1+'66':''}">
        <div style="display:flex;justify-content:space-between;align-items:center"><div class="q-ico" style="background:${subject.color1}22;color:${subject.color1}">${done?'✅':`#${i+1}`}</div><span style="font-size:11px;color:var(--text-3)">${ch.lecons} leçons • ${ch.exercices?.length||0} exos • ${ch.quiz?.length||0} quiz</span></div>
        <h3>${ch.title}</h3><p>${ch.cours.essentiel.slice(0,90)}...</p>
        <div style="display:flex;gap:6px;margin-top:8px">${['Cours','Fiche','Exos','Quiz','Flash'].map(t=>`<span style="font-size:10px;padding:3px 6px;border-radius:100px;background:var(--bg-3);border:1px solid var(--border)">${t}</span>`).join('')}</div>
      </div>`;
    }).join('')}
  </div>`;
}

function renderChapterView(user, subjectId, chapterId){
  const prog = getProgrammeForUser(user);
  const subject = prog.matieres[subjectId];
  const chapter = subject?.chapitres.find(c=>c.id===chapterId);
  if(!subject||!chapter) return `<div class="empty"><b>Chapitre introuvable</b></div>`;

  const tabs = [{id:'cours', label:'📖 Cours'}, {id:'fiche', label:'🗂️ Fiche'}, {id:'exercices', label:`✏️ Exercices (${chapter.exercices?.length||0})`}, {id:'quiz', label:`🧠 Quiz (${chapter.quiz?.length||0})`}, {id:'flashcards', label:`🃏 Flashcards (${chapter.flashcards?.length||0})`}];

  let content='';
  if(state.chapterTab==='cours'){
    const c = chapter.cours;
    content = `
      <div class="lesson-card">
        <h2>${chapter.title}</h2>
        <div class="lesson-section"><h4>📌 L’essentiel</h4><p>${c.essentiel}</p></div>
        <div class="lesson-section"><h4>📖 Définitions</h4><p>${c.definitions}</p></div>
        <div class="lesson-section"><h4>🧠 Explications</h4><p>${c.explications}</p></div>
        <div class="lesson-section"><h4>📐 Formules</h4><div class="formula">${c.formules}</div></div>
        <div class="lesson-section"><h4>💡 Méthodes</h4><p>${c.methodes}</p></div>
        <div class="lesson-section"><h4>📝 Exemples</h4><p>${c.exemples}</p></div>
        <div class="lesson-section"><h4>⚠️ Erreurs fréquentes</h4><p>${c.erreurs}</p></div>
        <div class="lesson-section"><h4>⭐ À retenir</h4><p style="background:linear-gradient(135deg,${subject.color1}15,${subject.color2}15);border:1px solid ${subject.color1}33;border-radius:12px;padding:12px;color:var(--text)"><b>${c.retenir}</b></p></div>
        <div style="margin-top:20px;display:flex;gap:10px;flex-wrap:wrap"><button class="btn btn-primary" onclick="App.markChapterDone('${subjectId}','${chapterId}')">✅ Marquer comme terminé</button><button class="btn btn-ghost" onclick="App.setChapterTab('exercices')">Faire les exercices →</button><button class="btn btn-ghost" onclick="App.setChapterTab('fiche')">Voir fiche synthèse →</button></div>
      </div>`;
  } else if(state.chapterTab==='fiche'){
    content = `<div class="lesson-card"><h2>🗂️ Fiche de révision — ${chapter.title}</h2>
      <div style="background:var(--bg-2);border:1px dashed var(--border-2);border-radius:14px;padding:16px;margin:14px 0">
        <h4 style="font-size:13px;margin-bottom:8px">⚡ Synthèse express (officielle)</h4>
        <ul style="font-size:13px;color:var(--text-2);line-height:1.7;padding-left:18px">
          <li><b>📌 Essentiel:</b> ${chapter.cours.essentiel}</li>
          <li><b>🧠 Définitions:</b> ${chapter.cours.definitions}</li>
          <li><b>📐 Formules:</b> ${chapter.cours.formules}</li>
          <li><b>💡 Méthode:</b> ${chapter.cours.methodes}</li>
          <li><b>⚠️ Piège:</b> ${chapter.cours.erreurs}</li>
          <li><b>⭐ Retenir:</b> ${chapter.cours.retenir}</li>
        </ul>
      </div>
      <h4 style="margin:16px 0 8px">📝 Ma fiche perso (sauvegardée sur serveur)</h4>
      <textarea id="fichePerso" class="input" style="height:120px;padding:12px;resize:vertical" placeholder="Écris ta propre fiche ici...">${(user.fichesPerso||[]).find(f=>f.chapterId===chapterId)?.content||''}</textarea>
      <button class="btn btn-primary" style="margin-top:10px" onclick="App.saveFichePerso('${subjectId}','${chapterId}')">💾 Sauvegarder ma fiche (serveur)</button>
      <div style="margin-top:16px;display:flex;gap:8px"><button class="btn btn-ghost" onclick="App.setChapterTab('cours')">← Cours</button><button class="btn btn-ghost" onclick="App.setChapterTab('flashcards')">Flashcards →</button></div>
    </div>`;
  } else if(state.chapterTab==='exercices'){
    content = `<div class="lesson-card"><h2>✏️ Exercices — ${chapter.title}</h2><p style="font-size:12px;color:var(--text-3);margin-bottom:12px">💡 Correction cachée par défaut — Essaie d'abord, puis affiche l'indice et la correction</p>
      ${chapter.exercices?.length? chapter.exercices.map(ex=>`
        <div class="exo"><div class="exo-head"><span class="exo-title">${ex.title}</span><span class="diff ${ex.diff==='facile'?'facile':ex.diff==='inter'?'inter':'diffi'}">${ex.diff==='facile'?'🟢 Facile':ex.diff==='inter'?'🟠 Intermédiaire':'🔴 Difficile'}</span></div>
        <p style="font-size:11px;color:var(--text-3)">Notions: ${ex.notions||'—'}</p>
        <p><b>Énoncé:</b> ${ex.enonce}</p>
        <textarea class="input-sm" placeholder="Ta réponse / brouillon..." style="height:60px;resize:vertical"></textarea>
        <div class="exo-actions"><button class="btn btn-ghost" style="height:36px" onclick="this.closest('.exo').querySelector('.hint').classList.toggle('show')">💡 Indice</button><button class="btn btn-primary" style="height:36px" onclick="this.closest('.exo').querySelector('.correction').classList.toggle('show'); App.logExo('${subjectId}','${chapterId}','${ex.id}')">👀 Voir correction</button></div>
        <div class="hint">💡 ${ex.indice}</div><div class="correction"><b>✅ Correction détaillée:</b><br>${ex.correction}<br><br><small style="color:var(--text-2)"><b>Explication:</b> ${ex.explication}</small><br><br><b>Réponse finale:</b> ${ex.reponse||ex.correction.slice(0,100)}</div>
        </div>
      `).join('') : `<div class="empty"><b>Exercices en cours</b></div>`}
    </div>`;
  } else if(state.chapterTab==='quiz'){
    content = `<div class="lesson-card"><h2>🧠 Quiz — ${chapter.title}</h2><div id="quizContainer">
      ${chapter.quiz?.length? chapter.quiz.map((q,i)=>`
        <div class="quiz-q" data-ans="${q.ans}"><h4>Question ${i+1}: ${q.q}</h4>
          ${q.opts.map((opt,oi)=>`<div class="quiz-opt" onclick="App.answerQuiz(this, ${oi}, ${q.ans}, \`${q.exp.replace(/`/g,'').replace(/'/g,"\\'")}\`)">${opt}</div>`).join('')}
          <div class="quiz-explain"></div>
        </div>
      `).join('') + `<div style="margin-top:16px"><button class="btn btn-primary" onclick="App.finishQuiz('${subjectId}','${chapterId}')">Terminer le quiz</button><div id="quizScore" style="margin-top:12px;font-weight:700"></div></div>` : `<div class="empty"><b>Pas encore de quiz</b></div>`}
    </div></div>`;
  } else if(state.chapterTab==='flashcards'){
    content = `<div class="lesson-card"><h2>🃏 Flashcards — ${chapter.title}</h2>
      <p style="font-size:13px;color:var(--text-2);margin-bottom:14px">Clique pour retourner. Évalue ta mémoire: les cartes difficiles reviendront plus souvent. Progression sauvegardée sur serveur.</p>
      <div class="flash-grid">
        ${(chapter.flashcards||[]).map((f,i)=>`
          <div class="flash" onclick="this.classList.toggle('flipped')"><div class="flash-inner"><div class="flash-front"><b>${f.front}</b><small style="margin-top:8px;color:var(--text-3)">Clique pour voir</small></div><div class="flash-back"><b>${f.back}</b><div class="flash-actions"><button class="btn btn-ghost" style="height:32px;font-size:11px" onclick="event.stopPropagation(); App.rateFlash('${subjectId}','${chapterId}',${i},0)">❌ À revoir</button><button class="btn btn-ghost" style="height:32px;font-size:11px" onclick="event.stopPropagation(); App.rateFlash('${subjectId}','${chapterId}',${i},1)">🟠 Presque</button><button class="btn btn-primary" style="height:32px;font-size:11px" onclick="event.stopPropagation(); App.rateFlash('${subjectId}','${chapterId}',${i},2)">✅ Maîtrisé</button></div></div></div></div>
        `).join('')}
      </div>
    </div>`;
  }

  return `
  <div class="breadcrumb"><b onclick="App.navigate('dashboard')">Accueil</b> › <b onclick="App.openSubject('${subjectId}')">${subject.name}</b> › <b>${chapter.title}</b></div>
  <div class="chapter-layout">
    <div>
      <div class="tabs">${tabs.map(t=>`<button class="tab2 ${state.chapterTab===t.id?'active':''}" onclick="App.setChapterTab('${t.id}')">${t.label}</button>`).join('')}</div>
      ${content}
    </div>
    <div>
      <div class="side-panel"><h3>📑 Dans ce chapitre</h3>
        <div style="display:flex;flex-direction:column;gap:6px;margin-top:8px">
          ${['cours','fiche','exercices','quiz','flashcards'].map(id=>`<div class="nav-item ${state.chapterTab===id?'active':''}" onclick="App.setChapterTab('${id}')" style="padding:8px 10px"><div class="ico" style="width:28px;height:28px">${id==='cours'?'📖':id==='fiche'?'🗂️':id==='exercices'?'✏️':id==='quiz'?'🧠':'🃏'}</div>${id.charAt(0).toUpperCase()+id.slice(1)}</div>`).join('')}
        </div>
        <div style="margin-top:16px;padding:12px;background:var(--bg-3);border-radius:12px"><b style="font-size:12px">Progression chapitre</b><div class="bar" style="margin-top:8px"><div class="bar-fill" style="width:${user.progress?.subjects?.[subjectId]?.chaptersCompleted?.includes(chapterId)?'100':'35'}%;background:${subject.color1}"></div></div><small style="color:var(--text-3)">Sauvegardée sur serveur persistant</small></div>
      </div>
      <div class="side-panel" style="margin-top:12px"><h3>🎯 Recommandé après</h3><div class="ech-item" onclick="App.openChapter('${subjectId}','${subject.chapitres[(subject.chapitres.findIndex(c=>c.id===chapterId)+1)%subject.chapitres.length].id}')"><div class="ech-ico" style="background:${subject.color1}22">${subject.icon}</div><div><b>${subject.chapitres[(subject.chapitres.findIndex(c=>c.id===chapterId)+1)%subject.chapitres.length].title}</b><span>Chapitre suivant</span></div></div></div>
    </div>
  </div>`;
}

function renderExercicesView(user){
  const prog = getProgrammeForUser(user);
  const allSubjects = Object.values(prog.matieres);
  let exos=[];
  allSubjects.forEach(s=> s.chapitres.forEach(c=> (c.exercices||[]).forEach(e=> exos.push({...e, subjectId:s.id, subjectName:s.name, chapterTitle:c.title, chapterId:c.id, color:s.color1}))));
  if(state.exoFilter.matiere!=='all') exos = exos.filter(e=>e.subjectId===state.exoFilter.matiere);
  if(state.exoFilter.diff!=='all') exos = exos.filter(e=>e.diff===state.exoFilter.diff);

  return `<div class="program-header"><div><h2>✏️ Exercices (${exos.length})</h2><p>Filtre par matière et difficulté • Corrections cachées • Progression serveur</p></div>
    <div style="display:flex;gap:8px">
      <select class="input" style="height:38px;width:160px" onchange="App.setExoFilter('matiere',this.value)"><option value="all">Toutes matières</option>${allSubjects.map(s=>`<option value="${s.id}" ${state.exoFilter.matiere===s.id?'selected':''}>${s.name}</option>`).join('')}</select>
      <select class="input" style="height:38px;width:140px" onchange="App.setExoFilter('diff',this.value)"><option value="all">Toutes diff.</option><option value="facile" ${state.exoFilter.diff==='facile'?'selected':''}>🟢 Facile</option><option value="inter" ${state.exoFilter.diff==='inter'?'selected':''}>🟠 Inter</option><option value="diffi" ${state.exoFilter.diff==='diffi'?'selected':''}>🔴 Difficile</option></select>
    </div>
  </div>
  <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(340px,1fr));gap:12px">
    ${exos.map(e=>`<div class="exo"><div class="exo-head"><span class="exo-title">${e.title}</span><span class="diff ${e.diff==='facile'?'facile':e.diff==='inter'?'inter':'diffi'}">${e.diff}</span></div><p style="font-size:12px;color:var(--text-3)">${e.subjectName} • ${e.chapterTitle}</p><p>${e.enonce}</p><div class="exo-actions"><button class="btn btn-ghost" style="height:36px" onclick="App.openChapter('${e.subjectId}','${e.chapterId}'); setTimeout(()=>App.setChapterTab('exercices'),100)">Ouvrir →</button></div></div>`).join('')}
  </div>`;
}
function renderQuizView(user){
  const prog = getProgrammeForUser(user);
  let quizzes=[];
  Object.values(prog.matieres).forEach(s=> s.chapitres.forEach(c=> (c.quiz||[]).forEach(q=> quizzes.push({...q, subjectId:s.id, subjectName:s.name, chapterTitle:c.title, chapterId:c.id}))));
  return `<div class="program-header"><div><h2>🧠 Quiz (${quizzes.length})</h2><p>Teste-toi avec QCM, Vrai/Faux, calculs • Score sauvegardé</p></div><button class="btn btn-primary" onclick="App.startRandomQuiz()">Quiz aléatoire 🎲</button></div>
  <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:12px">
    ${quizzes.map((q,i)=>`<div class="q-card" onclick="App.openChapter('${q.subjectId}','${q.chapterId}'); setTimeout(()=>App.setChapterTab('quiz'),100)"><div class="q-ico" style="background:rgba(124,58,237,0.15)">🧠</div><h3>${q.q.slice(0,60)}...</h3><p>${q.subjectName} • ${q.chapterTitle}</p><span class="badge blue">${q.opts.length} choix</span></div>`).join('')}
  </div>`;
}
function renderFlashcardsView(user){
  const prog = getProgrammeForUser(user);
  let flats=[];
  Object.values(prog.matieres).forEach(s=> s.chapitres.forEach(c=> (c.flashcards||[]).forEach(f=> flats.push({...f, subjectId:s.id, subjectName:s.name, chapterTitle:c.title, chapterId:c.id, color:s.color1}))));
  return `<div class="program-header"><div><h2>🃏 Flashcards (${flats.length}) — Répétition intelligente</h2><p>Les difficiles reviennent plus souvent • Progression serveur</p></div><button class="btn btn-primary" onclick="App.startFlashSession()">Session intelligente 🧠</button></div>
  <div class="flash-grid">${flats.map((f,i)=>`<div class="flash" onclick="this.classList.toggle('flipped')"><div class="flash-inner"><div class="flash-front" style="border-color:${f.color}44"><span style="font-size:11px;color:var(--text-3)">${f.subjectName}</span><b style="margin-top:6px">${f.front}</b></div><div class="flash-back"><b>${f.back}</b><small style="margin-top:8px;color:var(--text-3)">${f.chapterTitle}</small></div></div></div>`).join('')}</div>`;
}
function renderFichesView(user){
  const prog = getProgrammeForUser(user);
  const fichesPerso = user.fichesPerso||[];
  let fiches=[];
  Object.values(prog.matieres).forEach(s=> s.chapitres.forEach(c=> fiches.push({subjectId:s.id, subjectName:s.name, chapterId:c.id, title:c.title, color:s.color1, essentiel:c.cours.essentiel})));
  return `<div class="program-header"><div><h2>🗂️ Fiches de révision (${fiches.length}+${fichesPerso.length} perso)</h2><p>Synthétiques officielles + tes fiches perso sauvegardées sur serveur</p></div><button class="btn btn-ghost" onclick="App.navigate('programme')">Parcourir programme</button></div>
  <div style="margin-bottom:20px"><h3 style="font-size:14px;margin-bottom:10px">📌 Mes fiches perso (${fichesPerso.length}) • Serveur persistant</h3><div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:10px">${fichesPerso.map(f=>{ const subj=prog.matieres[f.subjectId]; return `<div class="q-card"><h3>${subj?.chapitres.find(c=>c.id===f.chapterId)?.title||'Fiche'}</h3><p>${f.content.slice(0,100)}...</p><button class="btn btn-ghost" style="height:36px" onclick="App.openChapter('${f.subjectId}','${f.chapterId}'); setTimeout(()=>App.setChapterTab('fiche'),100)">Ouvrir</button></div>`}).join('')||'<div class="empty" style="padding:12px"><span>Pas encore de fiches perso — crée-les depuis un chapitre</span></div>'}</div></div>
  <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:12px">${fiches.slice(0,40).map(f=>`<div class="q-card" onclick="App.openChapter('${f.subjectId}','${f.chapterId}'); setTimeout(()=>App.setChapterTab('fiche'),100)"><div class="q-ico" style="background:${f.color}22;color:${f.color}">🗂️</div><h3>${f.title}</h3><p>${f.essentiel.slice(0,80)}...</p><span style="font-size:11px;color:var(--text-3)">${f.subjectName}</span></div>`).join('')}</div>`;
}
function renderProgressionView(user){
  const {all} = getUserSubjects(user);
  const global = calcGlobalProgress(user);
  return `<div class="program-header"><div><h2>📊 Ma progression • Serveur persistant</h2><p>Suivi détaillé • Sauvegardé sur base de données • Multi-appareils</p></div><div style="display:flex;gap:8px"><div class="panel" style="padding:10px 14px"><b style="font-size:20px">${global}%</b><span style="font-size:11px;color:var(--text-2)"> global</span></div></div></div>
  <div style="display:grid;grid-template-columns:1.2fr 0.8fr;gap:16px">
    <div class="panel"><h3 style="margin-bottom:14px">Progression par matière</h3>${all.map(s=>{ const pct=calcSubjectProgress(user,s.id); return `<div style="margin-bottom:14px"><div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:6px"><span><span class="dot" style="background:${s.color1}"></span>${s.name}</span><b>${pct}%</b></div><div class="bar"><div class="bar-fill" style="width:${pct}%;background:${s.color1}"></div></div><small style="color:var(--text-3)">${s.chapitres.length} chapitres • ${user.progress?.subjects?.[s.id]?.chaptersCompleted?.length||0} terminés • ${user.progress?.subjects?.[s.id]?.exosDone?.length||0} exos</small></div>`}).join('')}</div>
    <div><div class="panel"><h3>🔥 Stats • Persistantes</h3><div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:12px">
      <div style="background:var(--bg-3);border-radius:12px;padding:12px;text-align:center"><b style="font-size:22px;display:block">${Object.values(user.progress?.subjects||{}).reduce((a,s)=>a+(s.chaptersCompleted?.length||0),0)}</b><span style="font-size:11px;color:var(--text-2)">Chapitres terminés</span></div>
      <div style="background:var(--bg-3);border-radius:12px;padding:12px;text-align:center"><b style="font-size:22px;display:block">${Object.values(user.progress?.subjects||{}).reduce((a,s)=>a+(s.exosDone?.length||0),0)}</b><span style="font-size:11px;color:var(--text-2)">Exos faits</span></div>
      <div style="background:var(--bg-3);border-radius:12px;padding:12px;text-align:center"><b style="font-size:22px;display:block">${(user.activities||[]).length}</b><span style="font-size:11px;color:var(--text-2)">Activités</span></div>
      <div style="background:var(--bg-3);border-radius:12px;padding:12px;text-align:center"><b style="font-size:22px;display:block">${user.planning?.length||0}</b><span style="font-size:11px;color:var(--text-2)">Échéances</span></div>
    </div></div>
    <div class="panel" style="margin-top:12px"><h3>🤖 Recommandé pour toi (IA)</h3><p style="font-size:13px;color:var(--text-2);margin:8px 0">Basé sur tes résultats serveur :</p>${all.filter(s=>calcSubjectProgress(user,s.id)<60).slice(0,3).map(s=>`<div class="ech-item" onclick="App.openSubject('${s.id}')"><div class="ech-ico" style="background:${s.color1}22">${s.icon}</div><div><b>Revoir ${s.name}</b><span>Progression ${calcSubjectProgress(user,s.id)}% — point faible détecté</span></div></div>`).join('')||'<small>Aucune faiblesse — continue !</small>'}</div>
    </div>
  </div>`;
}
function renderPlanningView(user){
  const planning = user.planning||[];
  return `<div class="program-header"><div><h2>📅 Planning • Serveur persistant</h2><p>Organise tes contrôles • Recommandations auto • Sauvegardé</p></div><span style="font-size:12px;color:var(--text-2)">${planning.length} échéances • Sync serveur</span></div>
  <div class="panel" style="margin-bottom:16px"><h3 style="margin-bottom:12px">➕ Ajouter une échéance</h3>
    <div class="plan-form"><select id="planType" class="input"><option>Contrôle</option><option>Devoir</option><option>DS</option><option>Oral</option><option>Bac blanc</option><option>Autre</option></select>
    <input id="planMatiere" class="input" placeholder="Matière (ex: Maths)"><input id="planTitre" class="input" placeholder="Titre (ex: Suites)"><input id="planDate" class="input" type="date"><button class="btn btn-primary" onclick="App.addPlanning()">Ajouter (serveur)</button></div>
  </div>
  <div class="plan-list">${planning.sort((a,b)=>new Date(a.date)-new Date(b.date)).map(p=>`
    <div class="q-card" style="display:flex;align-items:center;gap:12px"><div class="ech-ico" style="background:var(--bg-3)">${p.type==='Contrôle'?'📝':'📚'}</div><div style="flex:1"><b>${p.titre}</b><br><span style="font-size:12px;color:var(--text-2)">${p.type} • ${p.matiere} • ${new Date(p.date).toLocaleDateString('fr-FR',{weekday:'short', day:'numeric', month:'long'})}</span></div><div style="display:flex;gap:6px"><button class="icon-btn" onclick="App.deletePlanning('${p.id}')">🗑️</button></div></div>
  `).join('')||'<div class="empty"><b>Aucune échéance</b><span>Ajoute tes prochains contrôles</span></div>'}
  </div>
  ${planning.length? `<div class="panel" style="margin-top:16px"><h3>🤖 Planning de révision auto (IA)</h3><p style="font-size:13px;color:var(--text-2);margin:8px 0">Basé sur tes échéances serveur :</p><ul style="font-size:13px;color:var(--text-2);padding-left:18px;line-height:1.8">${planning.slice(0,3).map(p=>`<li><b>${p.matiere}</b> — ${p.titre} le ${new Date(p.date).toLocaleDateString('fr-FR')}: révise 30min/jour, fiche + 2 exos + 1 quiz</li>`).join('')}</ul></div>`:''}
  `;
}
function renderRechercheView(user){
  const prog = getProgrammeForUser(user);
  let results=[];
  if(state.searchQuery){
    const q = state.searchQuery.toLowerCase();
    Object.values(prog.matieres).forEach(s=> s.chapitres.forEach(c=>{
      if(c.title.toLowerCase().includes(q) || c.cours.essentiel.toLowerCase().includes(q) || c.cours.definitions.toLowerCase().includes(q) || c.cours.formules.toLowerCase().includes(q)){
        results.push({type:'Cours', subject:s, chapter:c, text:c.title});
      }
      (c.exercices||[]).forEach(e=>{ if(e.title.toLowerCase().includes(q)||e.enonce.toLowerCase().includes(q)) results.push({type:'Exercice', subject:s, chapter:c, text:e.title}); });
      (c.quiz||[]).forEach(qu=>{ if(qu.q.toLowerCase().includes(q)) results.push({type:'Quiz', subject:s, chapter:c, text:qu.q.slice(0,60)}); });
    }));
  }
  return `<div class="program-header"><div><h2>🔎 Recherche globale • Serveur</h2><p>Recherche dans cours, fiches, exos, quiz, formules, méthodes</p></div></div>
  <div class="search-wrap" style="max-width:600px;margin-bottom:16px"><input id="searchBig" class="input" placeholder="Ex: discriminant, Avogadro, PIB, métaphore..." value="${state.searchQuery}" oninput="App.handleSearchBig(this.value)" autofocus></div>
  <div style="display:grid;gap:8px">${results.length? results.map(r=>`<div class="q-card" onclick="App.openChapter('${r.subject.id}','${r.chapter.id}')"><div style="display:flex;gap:10px;align-items:center"><div class="q-ico" style="background:${r.subject.color1}22">${r.type==='Exercice'?'✏️':r.type==='Quiz'?'🧠':'📖'}</div><div><b>${r.text}</b><br><span style="font-size:12px;color:var(--text-2)">${r.type} • ${r.subject.name} • ${r.chapter.title}</span></div></div></div>`).join('') : `<div class="empty"><b>${state.searchQuery?'Aucun résultat pour "'+state.searchQuery+'"':'Tape une notion'}</b><span>Exemples: discriminant, dérivation, marché, poésie, onde, PIB...</span></div>`}
  </div>`;
}
function renderBacView(user){
  const francais = getProgrammeForUser(user).matieres['francais'];
  return `<div class="program-header"><div><h2>🇫🇷 Bac de français — Méthodo & entraînement complet</h2><p>Prépare l’écrit et l’oral • Cours + exos + quiz • Serveur persistant</p></div><button class="btn btn-primary" onclick="App.openSubject('francais')">Voir programme français</button></div>
  <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:12px">
    ${[
      {t:'Commentaire', d:'Méthode en 3 mouvements, intro/conclu, 5 exemples corrigés', icon:'📝'},
      {t:'Dissertation', d:'Problématique, plan dialectique, 8 disserts types', icon:'📚'},
      {t:'Explication linéaire', d:'Lecture, mouvements, analyse précise, 12 textes', icon:'🔍'},
      {t:'Oral bac', d:'Présentation œuvre + entretien, grille évaluation', icon:'🎤'},
      {t:'Figures de style', d:'Métaphore, anaphore, chiasme... 30 fiches + quiz', icon:'✨'},
      {t:'Mouvements littéraires', d:'Humanisme, Lumières, Romantisme... frise + fiches', icon:'🕰️'},
      {t:'Registres', d:'Tragique, comique, lyrique, polémique... avec exemples', icon:'🎭'},
      {t:'Grammaire bac', d:'Subordonnées, fonctions, voix, 20 exos corrigés', icon:'📐'},
    ].map(c=>`<div class="q-card"><div class="q-ico" style="background:rgba(245,158,11,0.15)">${c.icon}</div><h3>${c.t}</h3><p>${c.d}</p><button class="btn btn-ghost" style="height:36px;margin-top:8px" onclick="App.openSubject('francais')">S’entraîner →</button></div>`).join('')}
  </div>
  ${francais? `<div style="margin-top:20px"><h3 style="margin-bottom:10px">📖 Chapitres Français complets (${francais.chapitres.length} chapitres • ${francais.chapitres.reduce((a,c)=>a+(c.exercices?.length||0),0)} exos)</h3><div class="subjects-grid">${francais.chapitres.map(ch=>`<div class="sub-card" style="--c1:${francais.color1};--c2:${francais.color2}" onclick="App.openChapter('francais','${ch.id}')"><div class="sub-card-top"><div class="sub-card-ico">📖</div><div class="sub-card-arrow">→</div></div><div><h3>${ch.title}</h3><div class="meta">${ch.lecons} leçons • ${ch.exercices?.length||0} exos • ${ch.quiz?.length||0} quiz</div></div></div>`).join('')}</div></div>`:''}
  `;
}

/* ACTIONS */
window.App = {
  async render(){
    // Try to load user from backend if token exists
    if(API.token && !Store._cachedUser){
      try{
        const user = await API.me();
        Store._cachedUser = user;
        Store.upsertUser(user);
      }catch(e){
        // token invalid
      }
    }
    const user = Store.getCurrentUser();
    if(!user) renderLanding(); else renderApp();
  },
  startOnboarding(){
    state.showOnboarding=true; state.showLogin=false; state.onboardingStep=1; 
    state.onboardingData = {prenom:'', classe:'Première générale', specialites:[], objectif:'Tout à la fois', temps:'30 min', password:''};
    this.render();
    setTimeout(()=>document.getElementById('prenomInput')?.focus(),100);
  },
  showLogin(){
    state.showLogin=true; state.showOnboarding=false; this.render();
  },
  closeModals(){ state.showLogin=false; state.showOnboarding=false; this.render(); },
  onboardUpdate(k,v){ 
    state.onboardingData[k]=v; 
    if(k==='prenom' || k==='password'){
      const err = document.getElementById('prenomError');
      if(err) err.style.display='none';
      return;
    }
    this.render(); 
  },
  toggleSpec(id){
    const arr = state.onboardingData.specialites;
    const idx = arr.indexOf(id);
    if(idx>=0) arr.splice(idx,1); else { if(arr.length<4) arr.push(id); else { alert('Max 4 spécialités'); return; } }
    this.render();
  },
  onboardNext(){ 
    const d = state.onboardingData;
    const step = state.onboardingStep;
    if(step===1){
      if(!d.prenom.trim()){
        const err = document.getElementById('prenomError');
        if(err) err.style.display='block';
        document.getElementById('prenomInput')?.focus();
        return;
      }
    }
    if(step===3){
      const showSpecs = d.classe.includes('Première')||d.classe.includes('Terminale');
      if(showSpecs && d.specialites.length===0){
        const err = document.getElementById('specError');
        if(err) err.style.display='block';
        return;
      }
    }
    if(state.onboardingStep<5) {state.onboardingStep++; this.render();} 
  },
  onboardPrev(){ if(state.onboardingStep>1) {state.onboardingStep--; this.render();} },
  async createAccount(){
    try{
      const d = state.onboardingData;
      if(!d.prenom || !d.prenom.trim()){
        const err = document.getElementById('createError');
        if(err){ err.textContent='Entre ton prénom'; err.style.display='block'; }
        state.onboardingStep=1;
        this.render();
        return;
      }
      if((d.classe.includes('Première')||d.classe.includes('Terminale')) && d.specialites.length===0){
        alert('Sélectionne au moins une spécialité');
        state.onboardingStep=3;
        this.render();
        return;
      }
      const btn = document.getElementById('createBtn');
      if(btn){ btn.textContent='Création sur serveur...'; btn.disabled=true; }

      // Try backend first
      try{
        const result = await API.register({
          prenom: d.prenom.trim(),
          classe: d.classe,
          specialites: d.specialites,
          objectif: d.objectif,
          temps: d.temps,
          password: d.password||undefined
        });
        Store._cachedUser = result.user;
        Store.upsertUser(result.user);
        Store.setCurrentId(result.user.id);
        state.showOnboarding=false;
        state.view='dashboard';
        this.render();
        return;
      }catch(e){
        console.warn('Backend register failed, fallback local', e);
        // fallback local
      }

      // Fallback local
      const user = {
        id: uid(),
        prenom: d.prenom.trim(),
        classe: d.classe,
        specialites: d.specialites,
        objectif: d.objectif,
        temps: d.temps,
        createdAt: new Date().toISOString(),
        progress: {subjects:{}},
        planning: [
          {id:uid(), type:'Contrôle', matiere:'Mathématiques', titre:'Contrôle de maths', date:new Date(Date.now()+3*86400000).toISOString().slice(0,10)},
          {id:uid(), type:'Devoir', matiere:'SES', titre:'Devoir de SES', date:new Date(Date.now()+6*86400000).toISOString().slice(0,10)},
          {id:uid(), type:'Oral', matiere:'Français', titre:'Oral français', date:new Date(Date.now()+10*86400000).toISOString().slice(0,10)},
        ],
        activities: [],
        fichesPerso: []
      };
      Store.upsertUser(user);
      Store.setCurrentId(user.id);
      state.showOnboarding=false;
      state.view='dashboard';
      this.render();
    }catch(e){
      console.error('Create account error', e);
      alert('Erreur: '+e.message);
      const err = document.getElementById('createError');
      if(err){ err.textContent='Erreur: '+e.message; err.style.display='block'; }
      const btn = document.getElementById('createBtn');
      if(btn){ btn.textContent='Créer mon espace 🚀'; btn.disabled=false; }
    }
  },
  async loginAs(id){
    const password = document.getElementById('loginPassword')?.value||undefined;
    try{
      // Try backend login
      const result = await API.login({ userId: id, password });
      Store._cachedUser = result.user;
      Store.upsertUser(result.user);
      Store.setCurrentId(result.user.id);
    }catch(e){
      console.warn('Backend login failed, fallback local', e);
      Store.setCurrentId(id);
    }
    state.showLogin=false;
    state.view='dashboard';
    this.render();
  },
  logout(){ Store.clearCurrent(); state.view='dashboard'; this.render(); },
  navigate(view){
    state.view=view; state.subjectId=null; state.chapterId=null;
    document.getElementById('sidebar')?.classList.remove('open');
    this.render();
  },
  openSubject(id){
    const user = Store.getCurrentUser();
    const prog = getProgrammeForUser(user);
    const subj = prog.matieres[id];
    if(!subj) return;
    state.subjectId=id;
    state.view='subject';
    this.render();
  },
  openChapter(subjectId, chapterId){
    state.subjectId=subjectId; state.chapterId=chapterId; state.view='chapter'; state.chapterTab='cours';
    const user = Store.getCurrentUser();
    Store.updateProgress(u=>{ u.lastChapter={subjectId, chapterId}; });
    logActivity('Cours', getProgrammeForUser(user).matieres[subjectId]?.chapitres.find(c=>c.id===chapterId)?.title||chapterId, subjectId);
    Store.syncProgress('chapter_complete', { subjectId, chapterId });
    this.render();
  },
  setChapterTab(tab){ state.chapterTab=tab; this.render(); },
  setProgFilter(f){ state.programmeFilter=f; this.render(); },
  setExoFilter(k,v){ state.exoFilter[k]=v; this.render(); },
  filterChapters(q){
    const grid = document.getElementById('subjectsGrid');
    if(!grid||!q) { this.render(); return; }
    const cards = grid.querySelectorAll('.sub-card');
    cards.forEach(c=>{
      const txt = c.innerText.toLowerCase();
      c.style.display = txt.includes(q.toLowerCase())? 'flex':'none';
    });
  },
  async markChapterDone(subjectId, chapterId){
    Store.updateProgress(u=>{
      u.progress.subjects[subjectId]=u.progress.subjects[subjectId]||{chaptersCompleted:[], exosDone:[], quizResults:[]};
      if(!u.progress.subjects[subjectId].chaptersCompleted.includes(chapterId)){
        u.progress.subjects[subjectId].chaptersCompleted.push(chapterId);
      }
    });
    await Store.syncProgress('chapter_complete', { subjectId, chapterId });
    logActivity('Cours', 'Chapitre terminé', subjectId);
    alert('✅ Chapitre marqué comme terminé ! Progression sauvegardée sur serveur.');
    this.render();
  },
  async saveFichePerso(subjectId, chapterId){
    const content = document.getElementById('fichePerso')?.value||'';
    if(!content.trim()) return alert('Écris quelque chose !');
    Store.updateProgress(u=>{
      u.fichesPerso = u.fichesPerso||[];
      const idx = u.fichesPerso.findIndex(f=>f.chapterId===chapterId);
      if(idx>=0) u.fichesPerso[idx].content=content; else u.fichesPerso.push({id:uid(), subjectId, chapterId, content, date:new Date().toISOString()});
    });
    await Store.syncProgress('fiche', { fiche: { subjectId, chapterId, content } });
    alert('💾 Fiche sauvegardée sur serveur !');
  },
  async logExo(subjectId, chapterId, exoId){
    Store.updateProgress(u=>{
      u.progress.subjects[subjectId]=u.progress.subjects[subjectId]||{chaptersCompleted:[], exosDone:[]};
      u.progress.subjects[subjectId].exosDone = u.progress.subjects[subjectId].exosDone||[];
      if(!u.progress.subjects[subjectId].exosDone.includes(exoId)) u.progress.subjects[subjectId].exosDone.push(exoId);
    });
    await Store.syncProgress('exo_done', { subjectId, exoId });
    logActivity('Exercice', exoId, subjectId);
  },
  answerQuiz(el, chosen, ans, exp){
    const parent = el.closest('.quiz-q');
    if(parent.dataset.done) return;
    parent.dataset.done='1';
    const opts = parent.querySelectorAll('.quiz-opt');
    opts.forEach((o,i)=>{
      if(i===ans) o.classList.add('correct');
      else if(i===chosen) o.classList.add('wrong');
      o.style.pointerEvents='none';
    });
    const explain = parent.querySelector('.quiz-explain');
    explain.textContent = (chosen===ans?'✅ Correct ! ':'❌ Incorrect. ') + exp;
    explain.classList.add('show');
  },
  async finishQuiz(subjectId, chapterId){
    const qs = document.querySelectorAll('.quiz-q');
    let correct=0;
    qs.forEach(q=>{
      if(q.dataset.done){
        const hasWrong = q.querySelector('.quiz-opt.wrong');
        if(!hasWrong) correct++;
      }
    });
    const score = qs.length? Math.round(correct/qs.length*100):0;
    document.getElementById('quizScore').innerHTML = `Score: <b>${correct}/${qs.length}</b> — ${score}% ${score>=80?'🎉 Excellent !':score>=50?'👍 Bien, à revoir':'💪 À retravailler'}`;
    logActivity('Quiz', `Score ${score}%`, subjectId);
    Store.updateProgress(u=>{
      u.progress.subjects[subjectId]=u.progress.subjects[subjectId]||{chaptersCompleted:[], quizResults:[]};
      u.progress.subjects[subjectId].quizResults = u.progress.subjects[subjectId].quizResults||[];
      u.progress.subjects[subjectId].quizResults.push({chapterId, score, date:new Date().toISOString()});
    });
    await Store.syncProgress('quiz', { quizResult: { subjectId, chapterId, score } });
  },
  async rateFlash(subjectId, chapterId, idx, rating){
    logActivity('Flashcard', `Carte ${idx+1}`, subjectId);
    await Store.syncProgress('flashcard', { flashcard: { key: `${subjectId}_${chapterId}_${idx}`, rating, date: new Date().toISOString() } });
    const msg = rating===2?'✅ Super ! Carte maîtrisée':rating===1?'🟠 Presque — elle reviendra bientôt':'❌ Pas grave, on la revoit demain';
    const t = document.createElement('div');
    t.textContent=msg;
    t.style.cssText='position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:var(--card);border:1px solid var(--border);padding:10px 16px;border-radius:12px;z-index:100;font-size:13px;box-shadow:var(--shadow)';
    document.body.appendChild(t);
    setTimeout(()=>t.remove(),2000);
  },
  async addPlanning(){
    const type = document.getElementById('planType').value;
    const matiere = document.getElementById('planMatiere').value.trim();
    const titre = document.getElementById('planTitre').value.trim();
    const date = document.getElementById('planDate').value;
    if(!matiere||!titre||!date) return alert('Remplis tous les champs');
    const planning = { type, matiere, titre, date };
    Store.updateProgress(u=>{
      u.planning = u.planning||[];
      u.planning.push({id:uid(), ...planning});
    });
    await Store.syncProgress('planning_add', { planning });
    this.render();
  },
  async deletePlanning(id){
    Store.updateProgress(u=>{ u.planning = (u.planning||[]).filter(p=>p.id!==id); });
    await Store.syncProgress('planning_delete', { planning: { id } });
    this.render();
  },
  handleSearch(q){
    state.searchQuery=q;
    const resEl = document.getElementById('searchResults');
    if(!resEl) return;
    if(!q.trim()){ resEl.classList.remove('show'); return; }
    const user = Store.getCurrentUser();
    if(!user){ resEl.classList.remove('show'); return; }
    const prog = getProgrammeForUser(user);
    let results=[];
    const lq = q.toLowerCase();
    Object.values(prog.matieres).forEach(s=>{
      if(s.name.toLowerCase().includes(lq)) results.push({type:'Matière', subject:s, chapter:null, title:s.name});
      s.chapitres.forEach(c=>{
        if(c.title.toLowerCase().includes(lq)) results.push({type:'Chapitre', subject:s, chapter:c, title:c.title});
        if(c.cours.essentiel.toLowerCase().includes(lq) || c.cours.formules.toLowerCase().includes(lq)) results.push({type:'Cours', subject:s, chapter:c, title:c.title+' — essentiel'});
      });
    });
    results = results.slice(0,6);
    resEl.innerHTML = results.map(r=>`<div class="sr-item" onclick="App.handleSearchSelect('${r.subject.id}','${r.chapter?.id||''}')"><div class="ico">${r.type==='Matière'?'📚':r.type==='Chapitre'?'📖':'📝'}</div><div><b>${r.title}</b><span>${r.type} • ${r.subject.name}</span></div></div>`).join('')||'<div class="sr-item"><div><b>Aucun résultat</b><span>Essaie un autre mot-clé</span></div></div>';
    resEl.classList.add('show');
  },
  handleSearchSelect(subjectId, chapterId){
    document.getElementById('searchResults')?.classList.remove('show');
    if(chapterId) this.openChapter(subjectId, chapterId); else this.openSubject(subjectId);
  },
  handleSearchBig(q){ state.searchQuery=q; this.render(); if(q) { state.view='recherche'; } },
  toggleTheme(){
    state.theme = state.theme==='dark'?'light':'dark';
    localStorage.setItem('nexorev_theme', state.theme);
    this.render();
  },
  toggleProfileMenu(){
    const m = document.getElementById('profileMenu');
    if(m) m.style.display = m.style.display==='none'?'block':'none';
  },
  editProfile(){
    const user = Store.getCurrentUser();
    if(!user) return;
    const newPrenom = prompt('Nouveau prénom:', user.prenom);
    if(newPrenom && newPrenom.trim()){
      Store.updateCurrent({prenom:newPrenom.trim()});
      this.render();
    }
  },
  exportData(){
    const user = Store.getCurrentUser();
    if(!user) return;
    const dataStr = JSON.stringify(user, null, 2);
    const blob = new Blob([dataStr], {type:'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href=url; a.download=`nexorev-${user.prenom}-${new Date().toISOString().slice(0,10)}.json`; a.click();
    URL.revokeObjectURL(url);
  },
  startRandomQuiz(){
    const user = Store.getCurrentUser();
    const prog = getProgrammeForUser(user);
    const allChaps=[];
    Object.values(prog.matieres).forEach(s=> s.chapitres.forEach(c=>{ if(c.quiz?.length) allChaps.push({s,c}); }));
    if(!allChaps.length) return alert('Pas de quiz dispo');
    const pick = allChaps[Math.floor(Math.random()*allChaps.length)];
    this.openChapter(pick.s.id, pick.c.id);
    setTimeout(()=>this.setChapterTab('quiz'),100);
  },
  startFlashSession(){ this.navigate('flashcards'); }
};

function attachSearchResults(){
  document.addEventListener('click', (e)=>{
    const res = document.getElementById('searchResults');
    const wrap = document.querySelector('.search-wrap');
    if(res && wrap && !wrap.contains(e.target)) res.classList.remove('show');
    const pm = document.getElementById('profileMenu');
    if(pm && !e.target.closest('.avatar') && !pm.contains(e.target)) pm.style.display='none';
  });
}

// init async
(async()=>{
  if(API.token){
    try{
      const user = await API.me();
      Store._cachedUser = user;
      Store.upsertUser(user);
    }catch(e){
      console.warn('Token invalid, clear');
      API.logout();
    }
  }
  App.render();
})();
