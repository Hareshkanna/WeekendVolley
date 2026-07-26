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

  grid.innerHTML = players.map(p => {
    const isSel = selectedPlayerIds.has(p.id);
    
    // Path to Python-rendered image card or fallback
    const cardImgPath = p.generatedCardUrl || `cards/${p.id}.png`;

    return `
      <div class="fifa-card-container ${isSel ? 'selected' : ''}" onclick="toggleSelect('${p.id}')">
        <div class="fifa-card-shield" style="background: transparent;">
          
          <!-- Python Generated FIFA Card Graphic -->
          <img src="${cardImgPath}" 
               onerror="this.onerror=null; this.src='assets/frames/gold.png';" 
               alt="${p.name} Card" 
               style="width: 100%; height: 100%; object-fit: contain;">

          <!-- Edit Action Button (Admin Only Overlay) -->
          ${isAdmin ? `
            <div class="fut-card-actions" style="position: absolute; bottom: 15px; left: 0; right: 0; text-align: center;">
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

window.openPlayerModal = function(id = null) {
  if (!isAdmin) {
    alert("Permission denied. Only Admins can edit players.");
    return;
  }

  const modal = document.getElementById("playerModal");
  if (!modal) return;

  // Prevent background page from moving while scrolling modal
  document.body.classList.add("modal-open");

  if (id) {
    const p = players.find(player => player.id === id);
    if (p) {
      if (document.getElementById("editId")) document.getElementById("editId").value = p.id;
      if (document.getElementById("editName")) document.getElementById("editName").value = p.name || "";
      if (document.getElementById("editPos")) document.getElementById("editPos").value = p.pos || "Universal";
      if (document.getElementById("editJersey")) document.getElementById("editJersey").value = p.jersey || "";
      
      if (p.stats) {
        if (document.getElementById("statAtk")) document.getElementById("statAtk").value = p.stats.atk || 70;
        if (document.getElementById("statSrv")) document.getElementById("statSrv").value = p.stats.srv || 70;
        if (document.getElementById("statRcv")) document.getElementById("statRcv").value = p.stats.rcv || 70;
        if (document.getElementById("statBlk")) document.getElementById("statBlk").value = p.stats.blk || 70;
        if (document.getElementById("statStm")) document.getElementById("statStm").value = p.stats.stm || 70;
        if (document.getElementById("statTmw")) document.getElementById("statTmw").value = p.stats.tmw || 70;

        ['Atk', 'Srv', 'Rcv', 'Blk', 'Stm', 'Tmw'].forEach(s => {
          const lbl = document.getElementById(`lbl${s}`);
          const input = document.getElementById(`stat${s}`);
          if (lbl && input) lbl.innerText = input.value;
        });
      }

      const modalTitle = document.getElementById("modalTitle");
      if (modalTitle) modalTitle.innerText = "Edit Player Card";
    }
  } else {
    const form = document.getElementById("playerForm");
    if (form) form.reset();
    if (document.getElementById("editId")) document.getElementById("editId").value = "";
    const modalTitle = document.getElementById("modalTitle");
    if (modalTitle) modalTitle.innerText = "Add New Player";
  }

  modal.style.display = "block"; // Note: changed to block for native scroll container
  modal.scrollTop = 0; // Reset scroll position to top
};

window.closePlayerModal = function() {
  const modal = document.getElementById("playerModal");
  if (modal) modal.style.display = "none";
  document.body.classList.remove("modal-open");
};

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

window.handleSavePlayer = async function(e) {
  if (e) e.preventDefault();
  
  if (!isAdmin) {
    alert("Permission denied. Only Admins can save players.");
    return;
  }

  const editId = document.getElementById("editId")?.value || "p_" + Date.now();
  const name = document.getElementById("editName")?.value || "Player";
  const pos = document.getElementById("editPos")?.value || "Universal";
  const jersey = document.getElementById("editJersey")?.value || "0";
  const cardTheme = document.getElementById("editCardTheme")?.value || "gold";

  // Read direct image URL input or check for custom uploaded frame
  let cardUrl = document.getElementById("editCardImageUrl")?.value?.trim() || "";
  const customFrameFile = document.getElementById("editCustomCardFrame")?.files[0];

  // If a PNG file was selected in the file input, convert it directly to Base64
  if (customFrameFile) {
    try {
      cardUrl = await convertFileToBase64(customFrameFile);
    } catch (err) {
      console.error("Error converting file to Base64:", err);
    }
  }

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
    name: name,
    pos: pos,
    jersey: jersey,
    stats: stats,
    ovr: ovr,
    cardTheme: cardTheme,
    cardImageUrl: cardUrl
  };

  // Save directly to Cloud Firestore
  try {
    await db.collection("players").doc(playerData.id).set({
      name: playerData.name,
      pos: playerData.pos,
      jersey: playerData.jersey,
      stats: playerData.stats,
      ovr: playerData.ovr,
      cardTheme: playerData.cardTheme,
      cardImageUrl: playerData.cardImageUrl,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    console.log("Player successfully saved!");
    if (typeof closePlayerModal === "function") closePlayerModal();
  } catch (err) {
    console.error("Error saving player to database:", err);
    alert("Failed to save player: " + err.message);
  }
};

window.handleDeletePlayer = function() {
  if (!isAdmin) {
    alert("Permission denied. Only Admins can delete players.");
    return;
  }

  const editId = document.getElementById("editId").value;
  if (!editId) return;

  if (confirm("Are you sure you want to delete this player?")) {
    players = players.filter(p => p.id !== editId);
    saveAll();
    closePlayerModal();
    renderRoster();
  }
};

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

/* ==========================================================================
   FIREBASE BACKEND INTEGRATION (SENDS DATA TO PYTHON CARD GENERATOR)
   ========================================================================== */

// 1. Helper function to upload photo & save player data to Firebase Firestore
async function savePlayerToDatabase(playerData, imageFile) {
  try {
    let photoUrl = "";
    
    // Upload raw player photo to Firebase Storage if an image was picked
    if (imageFile) {
      const storageRef = firebase.storage().ref(`raw_photos/${playerData.id}.png`);
      await storageRef.put(imageFile);
      photoUrl = await storageRef.getDownloadURL();
    }

    // Save document into Firestore database
    await firebase.firestore().collection("players").doc(playerData.id).set({
      name: playerData.name,
      pos: playerData.pos,
      jersey: playerData.jersey,
      stats: playerData.stats,
      ovr: playerData.ovr,
      cardTheme: playerData.cardTheme || "gold",
      rawPhotoUrl: photoUrl,
      generatedCardUrl: "", // Python worker script will process this and upload card URL here
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    console.log("Player successfully saved to Firestore!");
    if (typeof closePlayerModal === "function") closePlayerModal();
  } catch (err) {
    console.error("Error saving player to database:", err);
    alert("Failed to save player to Firebase. Check console for details.");
  }
}

// 2. Real-time Listener: Updates Roster grid automatically when Python uploads generated card
function listenToPlayerRoster() {
  if (!window.firebase || !firebase.firestore) return;

  firebase.firestore().collection("players").onSnapshot(snapshot => {
    const grid = document.getElementById('rosterGrid');
    if (!grid) return;

    grid.innerHTML = snapshot.docs.map(doc => {
      const p = doc.data();
      const pId = doc.id;
      const isSel = typeof selectedPlayerIds !== 'undefined' && selectedPlayerIds.has(pId);
      
      // Use uploaded card image, generated URL, or default gold fallback
      const cardImg = p.cardImageUrl || p.generatedCardUrl || 'assets/frames/gold.png';

      return `
        <div class="fifa-card-container ${isSel ? 'selected' : ''}" onclick="toggleSelect('${pId}')">
          <div class="fifa-card-wrapper" style="position: relative; width: 220px; height: 320px;">
            <img src="${cardImg}" 
                 alt="${p.name}" 
                 style="width: 100%; height: 100%; object-fit: contain;"
                 onerror="this.onerror=null; this.src='assets/frames/gold.png';">
            
            ${isAdmin ? `
              <div style="position: absolute; bottom: 12px; left: 0; right: 0; text-align: center;">
                <button onclick="event.stopPropagation(); openPlayerModal('${pId}')" class="btn btn-sec btn-sm">Edit Card</button>
              </div>
            ` : ''}
          </div>
        </div>
      `;
    }).join('');
  });
}

// Start listening when DOM loads
document.addEventListener("DOMContentLoaded", listenToPlayerRoster);

// HELPER: Convert Uploaded File to Base64 String
function convertFileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = (error) => reject(error);
  });
}