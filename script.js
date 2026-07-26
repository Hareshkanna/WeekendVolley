// --- AUTHENTICATION & ROLE MANAGEMENT ---
let currentUser = null;
let isAdmin = false;

auth.onAuthStateChanged((user) => {
  currentUser = user;
  const badge = document.getElementById("userRoleBadge");
  const loginBtn = document.getElementById("loginBtn");
  const logoutBtn = document.getElementById("logoutBtn");

  if (user) {
    isAdmin = true;
    if (badge) badge.innerText = "Role: Admin 👑";
    if (loginBtn) loginBtn.style.display = "none";
    if (logoutBtn) logoutBtn.style.display = "inline-block";
  } else {
    isAdmin = false;
    if (badge) badge.innerText = "Role: Player/Viewer";
    if (loginBtn) loginBtn.style.display = "inline-block";
    if (logoutBtn) logoutBtn.style.display = "none";
  }
  
  if (typeof renderRoster === "function") {
    renderRoster();
  }
});

window.openLoginModal = function() {
  const modal = document.getElementById("loginModal");
  if (modal) modal.style.display = "flex";
  else alert("Modal element #loginModal not found in HTML!");
};

window.closeLoginModal = function() {
  const modal = document.getElementById("loginModal");
  if (modal) modal.style.display = "none";
};

function handleLogin(e) {
  e.preventDefault();
  const email = document.getElementById("loginEmail").value;
  const pass = document.getElementById("loginPassword").value;

  auth.signInWithEmailAndPassword(email, pass)
    .then(() => closeLoginModal())
    .catch((error) => {
      document.getElementById("loginError").innerText = error.message;
    });
}

function handleLogout() {
  auth.signOut();
}

const DEFAULT_AVATAR = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%2394a3b8'><path d='M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z'/></svg>";

// GLOBAL STATE
let players = JSON.parse(localStorage.getItem('vb_hub_players')) || [
  { id: '1', name: 'Alex Cruz', pos: 'Attacker', jersey: 7, photo: DEFAULT_AVATAR, stats: { atk:85, srv:78, rcv:70, blk:72, stm:80, tmw:82 }, ovr: 78, mvps: 2, cardTheme: 'gold' },
  { id: '2', name: 'Sam Taylor', pos: 'Setter', jersey: 12, photo: DEFAULT_AVATAR, stats: { atk:60, srv:82, rcv:88, blk:65, stm:78, tmw:92 }, ovr: 78, mvps: 1, cardTheme: 'emerald' }
];

let matchHistory = JSON.parse(localStorage.getItem('vb_hub_history')) || [];
let appSettings = JSON.parse(localStorage.getItem('vb_hub_settings')) || {
  bgPreset: 'midnight',
  bgCustomPhoto: '',
  globalCardDesignImg: '',
  accentColor: '#fbbf24'
};

let selectedPlayerIds = new Set(players.map(p => p.id));
let currentMatchData = null;
let tempPhotoBase64 = null;
let tempPlayerCardFrameBase64 = null;

let currentEditingPlayer = null;
let isPhotoRemoved = false;
let isCardFrameRemoved = false;

function saveAll() {
  if (!window.db) return;
  db.collection("appData").doc("roster").set({
    players: players,
    matchHistory: matchHistory,
    appSettings: appSettings
  })
  .then(() => console.log("Synced to Cloud!"))
  .catch((err) => console.error("Cloud Save Error: ", err));
}

function calcOVR(stats) {
  const w = { atk:0.25, srv:0.20, rcv:0.20, blk:0.15, stm:0.10, tmw:0.10 };
  let sum = 0;
  for (let k in w) sum += (stats[k] || 70) * w[k];
  return Math.min(99, Math.max(1, Math.round(sum)));
}

// THEME & SETTINGS
const BACKGROUND_PRESETS = {
  midnight: '#0b0f19',
  stadium: 'radial-gradient(circle at center, #1e3a8a 0%, #090d16 100%)',
  court: 'linear-gradient(135deg, #431407 0%, #0f172a 100%)',
  charcoal: 'linear-gradient(180deg, #18181b 0%, #09090b 100%)',
  neon: 'radial-gradient(circle at top, #065f46 0%, #022c22 50%, #050505 100%)'
};

function applySettings() {
  if (appSettings.bgCustomPhoto) {
    document.body.style.background = `url('${appSettings.bgCustomPhoto}') center/cover fixed no-repeat`;
  } else {
    document.body.style.background = BACKGROUND_PRESETS[appSettings.bgPreset] || BACKGROUND_PRESETS.midnight;
  }

  document.documentElement.style.setProperty('--accent-color', appSettings.accentColor || '#fbbf24');

  if (document.getElementById('bgPresetSelect')) document.getElementById('bgPresetSelect').value = appSettings.bgPreset;
  if (document.getElementById('appAccentColor')) document.getElementById('appAccentColor').value = appSettings.accentColor;
}

function handleBgFileUpload(e) {
  const file = e.target.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onloadend = () => {
      appSettings.bgCustomPhoto = reader.result;
      saveAll();
      applySettings();
    };
    reader.readAsDataURL(file);
  }
}

function applyBgPreset(val) {
  appSettings.bgPreset = val;
  appSettings.bgCustomPhoto = '';
  saveAll();
  applySettings();
}

function updateAppAccent(color) {
  appSettings.accentColor = color;
  saveAll();
  applySettings();
}

function handleGlobalCardDesignUpload(e) {
  const file = e.target.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onloadend = () => {
      appSettings.globalCardDesignImg = reader.result;
      saveAll();
      renderRoster();
    };
    reader.readAsDataURL(file);
  }
}

function clearGlobalCardDesign() {
  appSettings.globalCardDesignImg = '';
  saveAll();
  renderRoster();
}

// BACKUP & RESTORE
function exportDataBackup() {
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({ players, matchHistory, appSettings }));
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute("href", dataStr);
  downloadAnchor.setAttribute("download", `volleyball_hub_backup_${new Date().toISOString().slice(0,10)}.json`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
}

function importDataBackup(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(event) {
    try {
      const parsed = JSON.parse(event.target.result);
      if (parsed.players) players = parsed.players;
      if (parsed.matchHistory) matchHistory = parsed.matchHistory;
      if (parsed.appSettings) appSettings = parsed.appSettings;
      saveAll();
      applySettings();
      renderRoster();
      alert('Backup restored successfully!');
    } catch (err) {
      alert('Invalid backup JSON file.');
    }
  };
  reader.readAsText(file);
}

// NAVIGATION
function switchTab(tabId, event) {
  document.querySelectorAll('.page-content').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  
  const targetTab = document.getElementById(tabId);
  if (targetTab) targetTab.classList.add('active');
  if (event && event.currentTarget) event.currentTarget.classList.add('active');

  if (tabId === 'dashboardTab') renderDashboard();
  if (tabId === 'playersTab') renderRoster();
  if (tabId === 'historyTab') renderHistory();
  if (tabId === 'settingsTab') applySettings();
}

// DASHBOARD
function renderDashboard() {
  if (document.getElementById('dashTotalPlayers')) document.getElementById('dashTotalPlayers').innerText = players.length;
  if (document.getElementById('dashTotalMatches')) document.getElementById('dashTotalMatches').innerText = matchHistory.length;

  const sortedByMVP = [...players].sort((a,b) => (b.mvps || 0) - (a.mvps || 0));
  const topMVP = sortedByMVP[0] && (sortedByMVP[0].mvps || 0) > 0 ? `${sortedByMVP[0].name} (${sortedByMVP[0].mvps})` : 'None';
  if (document.getElementById('dashTopMVP')) document.getElementById('dashTopMVP').innerText = topMVP;

  const topOvr = [...players].sort((a,b) => b.ovr - a.ovr).slice(0, 5);
  const topList = document.getElementById('topPlayersList');
  if (topList) {
    topList.innerHTML = topOvr.map(p => `
      <div class="list-row">
        <span>${p.name} (${p.pos})</span>
        <span style="font-weight:bold; color:var(--accent-color);">${p.ovr} OVR</span>
      </div>
    `).join('');
  }

  const mvpList = document.getElementById('mvpLeaderboardList');
  if (mvpList) {
    mvpList.innerHTML = sortedByMVP.map(p => `
      <div class="list-row">
        <span>${p.name}</span>
        <span style="font-weight:bold; color:var(--accent-color);">${p.mvps || 0} MVPs</span>
      </div>
    `).join('');
  }
}

// MODAL CONTROLS
window.closePlayerModal = function() {
  const modal = document.getElementById("playerModal");
  if (modal) modal.style.display = "none";
};

window.removeUploadedPhoto = function() {
  const photoInput = document.getElementById("editPhoto");
  if (photoInput) photoInput.value = "";
  tempPhotoBase64 = "";
  isPhotoRemoved = true;
  alert("Photo cleared! Click 'Save Card' to confirm.");
};

window.removeUploadedCardDesign = function() {
  const frameInput = document.getElementById("editCustomCardFrame");
  const urlInput = document.getElementById("editCardImageUrl");
  if (frameInput) frameInput.value = "";
  if (urlInput) urlInput.value = "";
  tempPlayerCardFrameBase64 = "";
  isCardFrameRemoved = true;
  alert("Card template cleared! Click 'Save Card' to confirm.");
};

window.openPlayerModal = function(id = null) {
  if (!isAdmin) {
    alert("Permission denied. Only Admins can edit players.");
    return;
  }

  isPhotoRemoved = false;
  isCardFrameRemoved = false;
  tempPhotoBase64 = "";
  tempPlayerCardFrameBase64 = "";

  const modal = document.getElementById("playerModal");
  if (!modal) return;

  if (id) {
    currentEditingPlayer = players.find(p => p.id === id) || null;
    if (currentEditingPlayer) {
      if (document.getElementById("editId")) document.getElementById("editId").value = currentEditingPlayer.id;
      if (document.getElementById("editName")) document.getElementById("editName").value = currentEditingPlayer.name || "";
      if (document.getElementById("editPos")) document.getElementById("editPos").value = currentEditingPlayer.pos || "OH";
      if (document.getElementById("editJersey")) document.getElementById("editJersey").value = currentEditingPlayer.jersey || "0";
      if (document.getElementById("editTextColor")) document.getElementById("editTextColor").value = currentEditingPlayer.textColor || "#220e02";
      if (document.getElementById("editCardImageUrl")) document.getElementById("editCardImageUrl").value = currentEditingPlayer.cardFrameUrl || "";

      if (currentEditingPlayer.stats) {
        if (document.getElementById("statAtk")) document.getElementById("statAtk").value = currentEditingPlayer.stats.atk || 70;
        if (document.getElementById("statSrv")) document.getElementById("statSrv").value = currentEditingPlayer.stats.srv || 70;
        if (document.getElementById("statRcv")) document.getElementById("statRcv").value = currentEditingPlayer.stats.rcv || 70;
        if (document.getElementById("statBlk")) document.getElementById("statBlk").value = currentEditingPlayer.stats.blk || 70;
        if (document.getElementById("statStm")) document.getElementById("statStm").value = currentEditingPlayer.stats.stm || 70;
        if (document.getElementById("statTmw")) document.getElementById("statTmw").value = currentEditingPlayer.stats.tmw || 70;

        ['Atk', 'Srv', 'Rcv', 'Blk', 'Stm', 'Tmw'].forEach(s => {
          const lbl = document.getElementById(`lbl${s}`);
          const input = document.getElementById(`stat${s}`);
          if (lbl && input) lbl.innerText = input.value;
        });
      }
    }
  } else {
    currentEditingPlayer = null;
    const form = document.getElementById("playerForm");
    if (form) form.reset();
    if (document.getElementById("editId")) document.getElementById("editId").value = "";
    if (document.getElementById("editTextColor")) document.getElementById("editTextColor").value = "#220e02";
  }

  modal.style.display = "block";
};

// SAVE PLAYER
window.handleSavePlayer = async function(e) {
  if (e) e.preventDefault();

  if (!isAdmin) {
    alert("Permission denied. Only Admins can save players.");
    return;
  }

  const editId = document.getElementById("editId")?.value || "p_" + Date.now();
  const name = document.getElementById("editName")?.value || "Player";
  const pos = document.getElementById("editPos")?.value || "OH";
  const jersey = document.getElementById("editJersey")?.value || "0";
  const textColor = document.getElementById("editTextColor")?.value || "#220e02";

  const photoFile = document.getElementById("editPhoto")?.files[0];
  const customFrameFile = document.getElementById("editCustomCardFrame")?.files[0];
  let directCardUrl = document.getElementById("editCardImageUrl")?.value?.trim() || "";

  let photoUrl = "";
  if (photoFile) photoUrl = await convertFileToBase64(photoFile);
  else if (tempPhotoBase64) photoUrl = tempPhotoBase64;
  else if (currentEditingPlayer && !isPhotoRemoved) photoUrl = currentEditingPlayer.photoUrl || currentEditingPlayer.photo || "";

  if (isPhotoRemoved) photoUrl = "";

  let cardFrameUrl = "";
  if (customFrameFile) cardFrameUrl = await convertFileToBase64(customFrameFile);
  else if (directCardUrl) cardFrameUrl = directCardUrl;
  else if (tempPlayerCardFrameBase64) cardFrameUrl = tempPlayerCardFrameBase64;
  else if (currentEditingPlayer && !isCardFrameRemoved) cardFrameUrl = currentEditingPlayer.cardFrameUrl || "";

  if (isCardFrameRemoved) cardFrameUrl = "";

  const stats = {
    atk: parseInt(document.getElementById("statAtk")?.value || 70),
    srv: parseInt(document.getElementById("statSrv")?.value || 70),
    rcv: parseInt(document.getElementById("statRcv")?.value || 70),
    blk: parseInt(document.getElementById("statBlk")?.value || 70),
    stm: parseInt(document.getElementById("statStm")?.value || 70),
    tmw: parseInt(document.getElementById("statTmw")?.value || 70)
  };

  const ovr = Math.round((stats.atk + stats.srv + stats.rcv + stats.blk + stats.stm + stats.tmw) / 6);

  const playerData = {
    id: editId,
    name, pos, jersey, stats, ovr,
    photoUrl, cardFrameUrl, textColor,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  };

  try {
    if (window.db) {
      await db.collection("players").doc(editId).set(playerData, { merge: true });
    }

    const idx = players.findIndex(p => p.id === editId);
    if (idx >= 0) {
      players[idx] = { ...players[idx], ...playerData };
    } else {
      players.push(playerData);
      selectedPlayerIds.add(editId);
    }

    saveAll();
    closePlayerModal();
    renderRoster();
  } catch (err) {
    alert("Failed to save player: " + err.message);
  }
};

window.handleDeletePlayer = function() {
  if (!isAdmin) {
    alert("Permission denied. Only Admins can delete players.");
    return;
  }

  const editId = document.getElementById("editId")?.value;
  if (!editId) return;

  if (confirm("Are you sure you want to delete this player?")) {
    players = players.filter(p => p.id !== editId);
    selectedPlayerIds.delete(editId);
    if (window.db) {
      db.collection("players").doc(editId).delete().catch(e => console.error("Error deleting doc:", e));
    }
    saveAll();
    closePlayerModal();
    renderRoster();
  }
};

// LISTEN TO FIRESTORE ROSTER
function listenToPlayerRoster() {
  if (!window.firebase || !firebase.firestore || !window.db) {
    renderRoster();
    return;
  }

  db.collection("players").onSnapshot(snapshot => {
    if (snapshot && !snapshot.empty) {
      players = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      // Auto-select players on first load
      players.forEach(p => selectedPlayerIds.add(p.id));
    }
    renderRoster();
  }, err => {
    console.error("Roster snapshot error:", err);
    renderRoster();
  });
}

// RENDER ROSTER
function renderRoster() {
  const grid = document.getElementById('rosterGrid');
  if (!grid) return;

  if (!players || players.length === 0) {
    grid.innerHTML = '<p style="color: #94a3b8; text-align: center; width: 100%;">No players found.</p>';
    return;
  }

  grid.innerHTML = players.map(p => {
    const pId = p.id;
    const isSel = typeof selectedPlayerIds !== 'undefined' && selectedPlayerIds.has(pId);

    const bgGif = p.cardFrameUrl || appSettings.globalCardDesignImg || 'assets/frames/gold.png';
    const photo = p.photoUrl || p.photo || '';
    const textColor = p.textColor || '#220e02';
    const name = (p.name || 'PLAYER').toUpperCase();
    const pos = (p.pos || 'OH').substring(0, 3).toUpperCase();
    const stats = p.stats || { atk: 70, rcv: 70, blk: 70, stm: 70, srv: 70, tmw: 70 };
    const ovr = p.ovr || 70;

    return `
      <div class="fifa-card-container ${isSel ? 'selected' : ''}" onclick="toggleSelect('${pId}')" 
           style="display:inline-block; margin: 10px; cursor: pointer; user-select: none;">
        
        <div style="position: relative; width: 220px; height: 330px; filter: drop-shadow(0 8px 16px rgba(0,0,0,0.5));">
          
          <!-- LAYER 1: ANIMATED GIF / BLANK FRAME -->
          <img src="${bgGif}" alt="Card Frame" 
               style="position: absolute; top:0; left:0; width:100%; height:100%; object-fit: contain; z-index: 1;"
               onerror="this.onerror=null; this.src='assets/frames/gold.png';">

          <!-- LAYER 2: PLAYER CUTOUT PHOTO -->
          ${photo ? `
            <img src="${photo}" alt="${name}" 
                 style="position: absolute; top: 42px; left: 45px; width: 130px; height: 130px; object-fit: contain; z-index: 2;">
          ` : ''}

          <!-- LAYER 3: OVR RATING & POSITION -->
          <div style="position: absolute; top: 22px; left: 24px; z-index: 3; color: ${textColor}; text-align: center; font-family: 'Arial Black', sans-serif;">
            <div style="font-size: 32px; font-weight: 900; line-height: 1;">${ovr}</div>
            <div style="font-size: 13px; font-weight: 800; font-family: sans-serif; margin-top: 2px;">${pos}</div>
          </div>

          <!-- LAYER 4: PLAYER NAME -->
          <div style="position: absolute; top: 188px; width: 100%; text-align: center; z-index: 3; color: ${textColor}; font-family: 'Arial Black', sans-serif; font-size: 16px; letter-spacing: 0.5px;">
            ${name}
          </div>

          <!-- LAYER 5: STATS GRID -->
          <div style="position: absolute; top: 232px; left: 35px; right: 35px; z-index: 3; display: grid; grid-template-columns: 1fr 1fr; row-gap: 3px; color: ${textColor}; font-family: sans-serif; font-size: 12px; font-weight: 900;">
            <div style="text-align: left;">${stats.atk || 70} <span style="font-size: 9px; font-weight: 700; opacity: 0.85;">ATK</span></div>
            <div style="text-align: right;">${stats.rcv || 70} <span style="font-size: 9px; font-weight: 700; opacity: 0.85;">RCV</span></div>
            <div style="text-align: left;">${stats.blk || 70} <span style="font-size: 9px; font-weight: 700; opacity: 0.85;">BLK</span></div>
            <div style="text-align: right;">${stats.stm || 70} <span style="font-size: 9px; font-weight: 700; opacity: 0.85;">STM</span></div>
            <div style="text-align: left;">${stats.srv || 70} <span style="font-size: 9px; font-weight: 700; opacity: 0.85;">SRV</span></div>
            <div style="text-align: right;">${stats.tmw || 70} <span style="font-size: 9px; font-weight: 700; opacity: 0.85;">TMW</span></div>
          </div>

          <!-- LAYER 6: EDIT BUTTON (ADMIN ONLY) -->
          ${isAdmin ? `
            <button onclick="event.stopPropagation(); openPlayerModal('${pId}')" class="btn btn-sec btn-sm" 
                    style="position: absolute; bottom: 8px; left: 50%; transform: translateX(-50%); width: 80%; padding: 4px; font-size: 0.7rem; background: rgba(15, 23, 42, 0.9); border: 1px solid rgba(255,255,255,0.2); color: #fff; border-radius: 6px; z-index: 10;">Edit Card</button>
          ` : ''}

        </div>
      </div>
    `;
  }).join('');

  const selectedCountEl = document.getElementById('selectedCount');
  if (selectedCountEl) {
    selectedCountEl.innerText = `${selectedPlayerIds.size} Selected`;
  }
}

function toggleSelect(id) {
  if (selectedPlayerIds.has(id)) selectedPlayerIds.delete(id);
  else selectedPlayerIds.add(id);
  renderRoster();
}

function selectAllPlayers(val) {
  if (val) selectedPlayerIds = new Set(players.map(p => p.id));
  else selectedPlayerIds.clear();
  renderRoster();
}

function handleBatchAdd() {
  const txt = document.getElementById('batchNames').value.trim();
  if (!txt) return;

  txt.split('\n').map(n => n.trim()).filter(Boolean).forEach((name, i) => {
    const defaultStats = { atk:70, srv:70, rcv:70, blk:70, stm:70, tmw:70 };
    const newP = {
      id: "p_" + Date.now() + "_" + i,
      name, pos: 'OH', jersey: Math.floor(Math.random()*99)+1,
      photoUrl: DEFAULT_AVATAR, stats: defaultStats, ovr: calcOVR(defaultStats), mvps: 0, cardFrameUrl: ''
    };
    players.push(newP);
    selectedPlayerIds.add(newP.id);
  });

  document.getElementById('batchNames').value = '';
  saveAll();
  renderRoster();
}

// MATCHMAKING ENGINE
function generateMatch(balanced) {
  const pool = players.filter(p => selectedPlayerIds.has(p.id));
  if (pool.length < 2) return alert('Select at least 2 players!');

  let teamA = [], teamB = [];

  if (balanced) {
    const sorted = [...pool].sort((a,b) => b.ovr - a.ovr);
    let sumA = 0, sumB = 0;
    sorted.forEach(p => {
      if (sumA <= sumB && teamA.length < Math.ceil(pool.length / 2)) {
        teamA.push(p); sumA += p.ovr;
      } else {
        teamB.push(p); sumB += p.ovr;
      }
    });
  } else {
    const shuffled = [...pool].sort(() => Math.random() - 0.5);
    const mid = Math.ceil(shuffled.length / 2);
    teamA = shuffled.slice(0, mid);
    teamB = shuffled.slice(mid);
  }

  const avgA = Math.round(teamA.reduce((s,p) => s + p.ovr, 0) / (teamA.length || 1));
  const avgB = Math.round(teamB.reduce((s,p) => s + p.ovr, 0) / (teamB.length || 1));

  currentMatchData = { teamA, teamB, avgA, avgB, mode: balanced ? 'Skill Balanced' : 'Pure Random' };

  const panel = document.getElementById('generatedMatchPanel');
  if (panel) panel.style.display = 'block';

  const diffEl = document.getElementById('diffIndicator');
  if (diffEl) diffEl.innerText = `Δ ${Math.abs(avgA - avgB)} OVR (${currentMatchData.mode})`;

  const boxA = document.getElementById('teamABox');
  if (boxA) {
    boxA.innerHTML = `<h4 class="text-gold" style="color:#fbbf24; margin-bottom:8px;">Team A (Avg ${avgA})</h4>` +
      teamA.map(p => `<div style="font-size:0.85rem; padding: 2px 0;">${p.name} (${p.ovr} OVR)</div>`).join('');
  }

  const boxB = document.getElementById('teamBBox');
  if (boxB) {
    boxB.innerHTML = `<h4 class="text-blue" style="color:#60a5fa; margin-bottom:8px;">Team B (Avg ${avgB})</h4>` +
      teamB.map(p => `<div style="font-size:0.85rem; padding: 2px 0;">${p.name} (${p.ovr} OVR)</div>`).join('');
  }

  const mvpSelect = document.getElementById('mvpSelect');
  if (mvpSelect) {
    mvpSelect.innerHTML = '<option value="">Select Match MVP (Optional)</option>' +
      pool.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
  }
}

function saveMatchResult() {
  if (!currentMatchData) return;

  const scoreA = Number(document.getElementById('scoreA')?.value) || 0;
  const scoreB = Number(document.getElementById('scoreB')?.value) || 0;
  const mvpId = document.getElementById('mvpSelect')?.value;

  if (mvpId) {
    const mvpPlayer = players.find(p => p.id === mvpId);
    if (mvpPlayer) mvpPlayer.mvps = (mvpPlayer.mvps || 0) + 1;
  }

  const record = {
    id: Date.now().toString(),
    date: new Date().toLocaleDateString(),
    teamA: currentMatchData.teamA.map(p => p.name),
    teamB: currentMatchData.teamB.map(p => p.name),
    scoreA, scoreB,
    mvpName: mvpId ? players.find(p => p.id === mvpId)?.name : 'None'
  };

  matchHistory.unshift(record);
  saveAll();
  alert('Match saved successfully!');
  const panel = document.getElementById('generatedMatchPanel');
  if (panel) panel.style.display = 'none';
}

// MATCH HISTORY
function renderHistory() {
  const container = document.getElementById('historyContainer');
  if (!container) return;

  if (matchHistory.length === 0) {
    container.innerHTML = '<p class="sub-text" style="color:#94a3b8;">No past matches recorded yet.</p>';
    return;
  }

  container.innerHTML = matchHistory.map(m => `
    <div class="history-card" style="background: rgba(255,255,255,0.05); padding: 12px; border-radius: 8px; margin-bottom: 10px; border: 1px solid rgba(255,255,255,0.1);">
      <div class="history-header" style="display: flex; justify-content: space-between; margin-bottom: 6px;">
        <span style="color: #94a3b8; font-size: 0.8rem;">${m.date}</span>
        <span style="font-weight:bold; color:var(--accent-color);">${m.scoreA} - ${m.scoreB}</span>
      </div>
      <div class="history-teams" style="font-size: 0.85rem;">
        <div><strong style="color:#fbbf24;">Team A:</strong> ${m.teamA.join(', ')}</div>
        <div><strong style="color:#60a5fa;">Team B:</strong> ${m.teamB.join(', ')}</div>
      </div>
      ${m.mvpName !== 'None' ? `<div class="mvp-badge" style="margin-top: 6px; font-size: 0.8rem; color: #fbbf24;">⭐ MVP: ${m.mvpName}</div>` : ''}
    </div>
  `).join('');
}

function convertFileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = (error) => reject(error);
  });
}

document.addEventListener("DOMContentLoaded", () => {
  listenToPlayerRoster();
  applySettings();
  renderDashboard();
});