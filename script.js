// --- AUTHENTICATION & ROLE MANAGEMENT ---
let currentUser = null;
let isAdmin = false;

// Monitor login status automatically
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
  
  // Refresh UI based on user permissions
if (typeof renderRoster === "function") {
    renderRoster();
  }
});

// Add/replace this in script.js
window.openLoginModal = function() {
  const modal = document.getElementById("loginModal");
  if (modal) {
    modal.style.display = "flex";
  } else {
    alert("Modal element #loginModal not found in HTML!");
  }
};

window.closeLoginModal = function() {
  const modal = document.getElementById("loginModal");
  if (modal) {
    modal.style.display = "none";
  }
};

function handleLogin(e) {
  e.preventDefault();
  const email = document.getElementById("loginEmail").value;
  const pass = document.getElementById("loginPassword").value;

  auth.signInWithEmailAndPassword(email, pass)
    .then(() => {
      closeLoginModal();
    })
    .catch((error) => {
      document.getElementById("loginError").innerText = error.message;
    });
}

function handleLogout() {
  auth.signOut();
}



const DEFAULT_AVATAR = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%2394a3b8'><path d='M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z'/></svg>";

// PREDEFINED FUT METALLIC GRADIENTS
const CARD_PRESETS = {
  gold: { gradient: 'linear-gradient(180deg, #fef08a 0%, #f59e0b 55%, #78350f 100%)', text: '#3a1300' },
  emerald: { gradient: 'linear-gradient(180deg, #a7f3d0 0%, #059669 55%, #064e3b 100%)', text: '#01271c' },
  crimson: { gradient: 'linear-gradient(180deg, #fca5a5 0%, #dc2626 55%, #7f1d1d 100%)', text: '#3b0000' },
  obsidian: { gradient: 'linear-gradient(180deg, #71717a 0%, #27272a 55%, #09090b 100%)', text: '#f4f4f5' },
  cyan: { gradient: 'linear-gradient(180deg, #67e8f9 0%, #0891b2 55%, #164e63 100%)', text: '#041f2c' }
};

// LOCAL STORAGE INITIALIZATION
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

function saveAll() {
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

// THEME & CUSTOM CARD DESIGN UPLOAD
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

// BACKUP / EXPORT SYSTEM
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

// NAVIGATION SYSTEM
function switchTab(tabId, event) {
  document.querySelectorAll('.page-content').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  
  document.getElementById(tabId).classList.add('active');
  if (event && event.currentTarget) {
    event.currentTarget.classList.add('active');
  }

  if (tabId === 'dashboardTab') renderDashboard();
  if (tabId === 'playersTab') renderRoster();
  if (tabId === 'historyTab') renderHistory();
  if (tabId === 'settingsTab') applySettings();
}

// DASHBOARD RENDERER
function renderDashboard() {
  document.getElementById('dashTotalPlayers').innerText = players.length;
  document.getElementById('dashTotalMatches').innerText = matchHistory.length;

  const sortedByMVP = [...players].sort((a,b) => (b.mvps || 0) - (a.mvps || 0));
  const topMVP = sortedByMVP[0] && (sortedByMVP[0].mvps || 0) > 0 ? `${sortedByMVP[0].name} (${sortedByMVP[0].mvps})` : 'None';
  document.getElementById('dashTopMVP').innerText = topMVP;

  const topOvr = [...players].sort((a,b) => b.ovr - a.ovr).slice(0, 5);
  document.getElementById('topPlayersList').innerHTML = topOvr.map(p => `
    <div class="list-row">
      <span>${p.name} (${p.pos})</span>
      <span style="font-weight:bold; color:var(--accent-color);">${p.ovr} OVR</span>
    </div>
  `).join('');

  document.getElementById('mvpLeaderboardList').innerHTML = sortedByMVP.map(p => `
    <div class="list-row">
      <span>${p.name}</span>
      <span style="font-weight:bold; color:var(--accent-color);">${p.mvps || 0} MVPs</span>
    </div>
  `).join('');
}

// ROSTER & CARDS RENDERER (SUPPORT FOR CUSTOM CARD FRAME OVERLAYS)
function getPlayerCardStyle(player) {
  if (player.cardTheme === 'custom' && player.cardCustomColor) {
    return {
      gradient: `linear-gradient(180deg, ${player.cardCustomBorder || '#fef08a'} 0%, ${player.cardCustomColor} 100%)`,
      text: '#ffffff'
    };
  }
  return CARD_PRESETS[player.cardTheme] || CARD_PRESETS.gold;
}

function renderRoster() {
  const grid = document.getElementById('rosterGrid');
  if (!grid) return;

  // Toggle "+ Add Player" button visibility based on Admin status
  const addBtn = document.querySelector(".modal-btn");
  if (addBtn) {
    addBtn.style.display = isAdmin ? "inline-block" : "none";
  }

  // Hide "Batch Add" panel if not Admin
  const batchPanel = document.getElementById("batchNames")?.closest(".panel");
  if (batchPanel) {
    batchPanel.style.display = isAdmin ? "block" : "none";
  }

  grid.innerHTML = players.map(p => {
    const isSel = selectedPlayerIds.has(p.id);
    const style = getPlayerCardStyle(p);
    const customCardImg = p.customCardFrame || appSettings.globalCardDesignImg;

    return `
      <div class="fifa-card-container ${isSel ? 'selected' : ''}" onclick="toggleSelect('${p.id}')">
        <div class="fifa-card-shield ${!customCardImg ? 'use-polygon-clip use-preset-border' : ''}" 
             style="background: ${customCardImg ? 'transparent' : style.gradient}; color: ${customCardImg ? '#3a1300' : style.text};">
          
          ${customCardImg ? `<img src="${customCardImg}" class="fifa-custom-frame-img" alt="Card Template">` : '<div class="fifa-card-texture"></div>'}

          <!-- Rating & Position Stack -->
          <div class="fut-badge-stack">
            <div class="fut-ovr">${p.ovr}</div>
            <div class="fut-pos">${p.pos ? p.pos.substring(0,3) : 'UNI'}</div>
            <div class="fut-line-separator"></div>
            <div class="fut-jersey">#${p.jersey || '0'}</div>
          </div>

          <!-- Cutout Render Canvas -->
          <div class="fut-player-render">
            <img src="${p.photo || ''}" alt="${p.name}">
          </div>

          <!-- Player Name Banner -->
          <div class="fut-name-ribbon">${p.name}</div>

          <!-- FUT Stats Columns -->
          <div class="fut-stats-grid">
            <div class="fut-stat-item"><span class="fut-stat-val">${p.stats?.atk || 70}</span><span class="fut-stat-lbl">ATK</span></div>
            <div class="fut-stat-item"><span class="fut-stat-val">${p.stats?.blk || 70}</span><span class="fut-stat-lbl">BLK</span></div>
            <div class="fut-stat-item"><span class="fut-stat-val">${p.stats?.srv || 70}</span><span class="fut-stat-lbl">SRV</span></div>
            <div class="fut-stat-item"><span class="fut-stat-val">${p.stats?.stm || 70}</span><span class="fut-stat-lbl">STM</span></div>
            <div class="fut-stat-item"><span class="fut-stat-val">${p.stats?.rcv || 70}</span><span class="fut-stat-lbl">RCV</span></div>
            <div class="fut-stat-item"><span class="fut-stat-val">${p.stats?.tmw || 70}</span><span class="fut-stat-lbl">TMW</span></div>
          </div>

          <!-- Edit Action Button (ONLY VISIBLE IF ADMIN) -->
          ${isAdmin ? `
            <div class="fut-card-actions">
              <button onclick="event.stopPropagation(); openPlayerModal('${p.id}')" class="btn btn-sec btn-sm">Edit Card</button>
            </div>
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
      id: Date.now().toString() + i,
      name, pos: 'Universal', jersey: Math.floor(Math.random()*99)+1,
      photo: DEFAULT_AVATAR, stats: defaultStats, ovr: calcOVR(defaultStats), mvps: 0, cardTheme: 'gold'
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

  document.getElementById('generatedMatchPanel').style.display = 'block';
  document.getElementById('diffIndicator').innerText = `Δ ${Math.abs(avgA - avgB)} OVR (${currentMatchData.mode})`;

  document.getElementById('teamABox').innerHTML = `<h4 class="text-gold">Team A (Avg ${avgA})</h4>` +
    teamA.map(p => `<div style="font-size:0.8rem;">${p.name} (${p.ovr})</div>`).join('');

  document.getElementById('teamBBox').innerHTML = `<h4 class="text-blue">Team B (Avg ${avgB})</h4>` +
    teamB.map(p => `<div style="font-size:0.8rem;">${p.name} (${p.ovr})</div>`).join('');

  const mvpSelect = document.getElementById('mvpSelect');
  mvpSelect.innerHTML = '<option value="">Select Match MVP (Optional)</option>' +
    pool.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
}

function saveMatchResult() {
  if (!currentMatchData) return;

  const scoreA = Number(document.getElementById('scoreA').value) || 0;
  const scoreB = Number(document.getElementById('scoreB').value) || 0;
  const mvpId = document.getElementById('mvpSelect').value;

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
  document.getElementById('generatedMatchPanel').style.display = 'none';
}

// MATCH HISTORY RENDERER
function renderHistory() {
  const container = document.getElementById('historyContainer');
  if (matchHistory.length === 0) {
    container.innerHTML = '<p class="sub-text">No past matches recorded yet.</p>';
    return;
  }

  container.innerHTML = matchHistory.map(m => `
    <div class="history-card">
      <div class="history-header">
        <span>${m.date}</span>
        <span style="font-weight:bold; color:var(--accent-color);">${m.scoreA} - ${m.scoreB}</span>
      </div>
      <div class="history-teams">
        <div><strong class="text-gold">Team A:</strong> ${m.teamA.join(', ')}</div>
        <div><strong class="text-blue">Team B:</strong> ${m.teamB.join(', ')}</div>
      </div>
      ${m.mvpName !== 'None' ? `<div class="mvp-badge">⭐ MVP: ${m.mvpName}</div>` : ''}
    </div>
  `).join('');
}

// MODAL HANDLERS
function toggleCustomColorInputs(themeVal) {
  const row = document.getElementById('customCardColorsRow');
  row.style.display = (themeVal === 'custom') ? 'grid' : 'none';
}

function openPlayerModal(id = null) {
  tempPhotoBase64 = null;
  tempPlayerCardFrameBase64 = null;

  if (id) {
    const p = players.find(x => x.id === id);
    document.getElementById('modalTitle').innerText = 'Edit Player';
    document.getElementById('editId').value = p.id;
    document.getElementById('editName').value = p.name;
    document.getElementById('editPos').value = p.pos;
    document.getElementById('editJersey').value = p.jersey;
    document.getElementById('editCardTheme').value = p.cardTheme || 'gold';
    
    if (p.cardCustomColor) document.getElementById('editCardColor').value = p.cardCustomColor;
    if (p.cardCustomBorder) document.getElementById('editCardBorder').value = p.cardCustomBorder;
    toggleCustomColorInputs(p.cardTheme || 'gold');

    ['Atk','Srv','Rcv','Blk','Stm','Tmw'].forEach(k => {
      const val = p.stats[k.toLowerCase()];
      document.getElementById(`stat${k}`).value = val;
      document.getElementById(`lbl${k}`).innerText = val;
    });
    document.getElementById('btnDeletePlayer').style.display = 'block';
  } else {
    document.getElementById('modalTitle').innerText = 'New Player';
    document.getElementById('editId').value = '';
    document.getElementById('editName').value = '';
    document.getElementById('editJersey').value = 10;
    document.getElementById('editCardTheme').value = 'gold';
    toggleCustomColorInputs('gold');

    ['Atk','Srv','Rcv','Blk','Stm','Tmw'].forEach(k => {
      document.getElementById(`stat${k}`).value = 70;
      document.getElementById(`lbl${k}`).innerText = 70;
    });
    document.getElementById('btnDeletePlayer').style.display = 'none';
  }
  document.getElementById('playerModal').classList.add('active');
}

function closePlayerModal() {
  document.getElementById('playerModal').classList.remove('active');
}

function updateSliderLbl(k) {
  document.getElementById(`lbl${k}`).innerText = document.getElementById(`stat${k}`).value;
}

document.getElementById('editPhoto').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onloadend = () => { tempPhotoBase64 = reader.result; };
    reader.readAsDataURL(file);
  }
});

document.getElementById('editCustomCardFrame').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onloadend = () => { tempPlayerCardFrameBase64 = reader.result; };
    reader.readAsDataURL(file);
  }
});

function handleSavePlayer(e) {
  e.preventDefault();
  if (!isAdmin) {
    alert("Permission denied. Only Admins can edit or add players.");
    return;
  }
  const id = document.getElementById('editId').value;
  const stats = {
    atk: Number(document.getElementById('statAtk').value),
    srv: Number(document.getElementById('statSrv').value),
    rcv: Number(document.getElementById('statRcv').value),
    blk: Number(document.getElementById('statBlk').value),
    stm: Number(document.getElementById('statStm').value),
    tmw: Number(document.getElementById('statTmw').value)
  };

  const cardTheme = document.getElementById('editCardTheme').value;
  const cardCustomColor = document.getElementById('editCardColor').value;
  const cardCustomBorder = document.getElementById('editCardBorder').value;

  if (id) {
    const p = players.find(x => x.id === id);
    p.name = document.getElementById('editName').value;
    p.pos = document.getElementById('editPos').value;
    p.jersey = Number(document.getElementById('editJersey').value);
    p.stats = stats;
    p.ovr = calcOVR(stats);
    p.cardTheme = cardTheme;
    p.cardCustomColor = cardCustomColor;
    p.cardCustomBorder = cardCustomBorder;
    if (tempPhotoBase64) p.photo = tempPhotoBase64;
    if (tempPlayerCardFrameBase64) p.customCardFrame = tempPlayerCardFrameBase64;
  } else {
    const newP = {
      id: Date.now().toString(),
      name: document.getElementById('editName').value,
      pos: document.getElementById('editPos').value,
      jersey: Number(document.getElementById('editJersey').value),
      photo: tempPhotoBase64 || DEFAULT_AVATAR,
      customCardFrame: tempPlayerCardFrameBase64 || '',
      stats, ovr: calcOVR(stats), mvps: 0,
      cardTheme, cardCustomColor, cardCustomBorder
    };
    players.push(newP);
    selectedPlayerIds.add(newP.id);
  }

  saveAll();
  renderRoster();
  closePlayerModal();
}

function handleDeletePlayer() {

  if (!isAdmin) {
    alert("Permission denied. Only Admins can delete players.");
    return;
  }

  const id = document.getElementById('editId').value;
  if (id && confirm('Delete this player?')) {
    players = players.filter(p => p.id !== id);
    selectedPlayerIds.delete(id);
    saveAll();
    renderRoster();
    closePlayerModal();
  }
}

function syncCloudData() {
  db.collection("appData").doc("roster").onSnapshot((doc) => {
    if (doc.exists) {
      const data = doc.data();
      if (data.players) players = data.players;
      if (data.matchHistory) matchHistory = data.matchHistory;
      if (data.appSettings) appSettings = data.appSettings;
      
      applySettings();
      renderRoster();
      renderDashboard();
    }
  });
}

// Start live sync
syncCloudData();

// INITIAL LOAD
applySettings();
renderDashboard();