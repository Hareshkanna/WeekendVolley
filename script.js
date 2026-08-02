// --- CONFIGURATION: CLOUDINARY DETAILS ---
const CLOUDINARY_CLOUD_NAME = "fsenwagl";
const CLOUDINARY_UPLOAD_PRESET = "WeekendVolley";

// --- SAFE LOCAL STORAGE PARSER ---
function safeGetStorage(key, fallback) {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : fallback;
  } catch (e) {
    console.warn(`localStorage parse error for key "${key}", resetting to fallback.`, e);
    return fallback;
  }
}

// --- MEDIA TYPE HELPER (DETECTS VIDEOS vs IMAGES/GIFs) ---
function isMediaVideo(url) {
  if (!url || typeof url !== 'string') return false;
  return url.includes('/video/upload/') || /\.(mp4|webm|ogg|mov|m4v)($|\?)/i.test(url);
}

// --- CLOUDINARY UPLOAD HELPER ---
async function uploadToCloudinary(file) {
  if (!file) return "";

  if (CLOUDINARY_CLOUD_NAME === "YOUR_CLOUD_NAME_HERE" || CLOUDINARY_UPLOAD_PRESET === "YOUR_UNSIGNED_PRESET_HERE") {
    alert("⚠️ Missing Cloudinary Credentials!\n\nPlease check lines 2 & 3 of script.js.");
    return "";
  }

  const resourceType = file.type.startsWith("video") ? "video" : "image";
  const url = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/${resourceType}/upload`;

  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);

  try {
    const res = await fetch(url, { method: "POST", body: formData });
    const data = await res.json();
    
    if (data.secure_url) {
      return data.secure_url;
    } else {
      throw new Error(data.error?.message || "Upload rejected by Cloudinary");
    }
  } catch (err) {
    console.error("Cloudinary upload failed:", err);
    alert("❌ Cloudinary Upload Error: " + err.message);
    return "";
  }
}

// --- SAFE FIREBASE DB RESOLVER ---
function getDb() {
  if (window.db) return window.db;
  if (typeof db !== 'undefined' && db) { 
    window.db = db; 
    return window.db; 
  }
  if (typeof firebase !== 'undefined' && firebase.firestore) {
    window.db = firebase.firestore();
    return window.db;
  }
  return null;
}

// --- AUTHENTICATION & ROLE MANAGEMENT ---
let currentUser = null;
let isAdmin = false;

if (typeof auth !== 'undefined' && auth) {
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
    
    document.querySelectorAll('.admin-only').forEach(el => {
      el.style.display = isAdmin ? '' : 'none';
    });

    renderAllViews();
  });
}

window.openLoginModal = function() {
  const modal = document.getElementById("loginModal");
  if (modal) modal.style.display = "flex";
};

window.closeLoginModal = function() {
  const modal = document.getElementById("loginModal");
  if (modal) modal.style.display = "none";
};

window.handleLogin = function(e) {
  if (e) e.preventDefault();
  const email = document.getElementById("loginEmail")?.value || "";
  const pass = document.getElementById("loginPassword")?.value || "";

  if (typeof auth !== 'undefined' && auth) {
    auth.signInWithEmailAndPassword(email, pass)
      .then(() => closeLoginModal())
      .catch((error) => {
        const errEl = document.getElementById("loginError");
        if (errEl) errEl.innerText = error.message;
      });
  }
};

window.handleLogout = function() {
  if (typeof auth !== 'undefined' && auth) auth.signOut();
};

const DEFAULT_AVATAR = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%2394a3b8'><path d='M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z'/></svg>";
const DEFAULT_CARD_FRAME = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='300' viewBox='0 0 200 300'><defs><linearGradient id='gold' x1='0%25' y1='0%25' x2='0%25' y2='100%25'><stop offset='0%25' stop-color='%23fef08a'/><stop offset='50%25' stop-color='%23f59e0b'/><stop offset='100%25' stop-color='%2378350f'/></linearGradient></defs><rect width='200' height='300' rx='16' fill='url(%23gold)' stroke='%23fef08a' stroke-width='4'/></svg>";

// GLOBAL APP STATE
let players = [];
let matchHistory = safeGetStorage('vb_hub_history', []);
let appSettings = safeGetStorage('vb_hub_settings', {
  bgPreset: 'midnight',
  bgCustomPhoto: '',
  globalCardDesignImg: '',
  accentColor: '#fbbf24'
});

let selectedPlayerIds = new Set();
let currentMatchData = null;
let tempPhotoBase64 = null;
let tempPlayerCardFrameBase64 = null;

let currentEditingPlayer = null;
let isPhotoRemoved = false;
let isCardFrameRemoved = false;

// REAL-TIME SPRITE ANIMATION ENGINE TICKER
let spriteTickerIndex = 0;
setInterval(() => {
  spriteTickerIndex++;
  document.querySelectorAll('.sprite-card-frame').forEach(el => {
    const total = parseInt(el.dataset.totalFrames) || 30;
    const active = parseInt(el.dataset.activeFrames) || total;
    const cardW = parseInt(el.dataset.cardWidth) || 200;
    const frame = spriteTickerIndex % active;
    el.style.backgroundPosition = `-${frame * cardW}px 0px`;
  });
}, 1000 / 30);

function renderAllViews() {
  renderRoster();
  renderMatchTab();
  renderDashboard();
  renderHistory();
  applySettings();
}

function saveAllAppData() {
  try {
    localStorage.setItem('vb_hub_history', JSON.stringify(matchHistory));
    localStorage.setItem('vb_hub_settings', JSON.stringify(appSettings));
  } catch (e) {
    console.warn("localStorage save failed", e);
  }

  const firestore = getDb();
  if (!firestore) return;

  firestore.collection("appData").doc("roster").set({
    matchHistory: matchHistory,
    appSettings: appSettings,
    updatedAt: new Date().toISOString()
  }, { merge: true }).catch((err) => console.error("Cloud AppData Save Error: ", err));
}

function calcOVR(stats) {
  if (!stats) return 70;
  const w = { atk:0.25, srv:0.20, rcv:0.20, blk:0.15, stm:0.10, tmw:0.10 };
  let sum = 0;
  for (let k in w) sum += (Number(stats[k]) || 70) * w[k];
  return Math.min(99, Math.max(1, Math.round(sum)));
}

// SAFE TAB NAVIGATION SWITCHER
window.switchTab = function(tabId, event) {
  try {
    document.querySelectorAll('.page-content').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    
    const targetTab = document.getElementById(tabId);
    if (targetTab) {
      targetTab.classList.add('active');
    } else {
      console.warn(`Tab element #${tabId} not found.`);
      return;
    }

    if (event && event.currentTarget) {
      event.currentTarget.classList.add('active');
    }

    if (tabId === 'dashboardTab') renderDashboard();
    if (tabId === 'playersTab') renderRoster();
    if (tabId === 'matchTab') renderMatchTab();
    if (tabId === 'historyTab') renderHistory();
    if (tabId === 'settingsTab') applySettings();
  } catch (err) {
    console.error("Tab switch error:", err);
  }
};

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

  if (document.getElementById('bgPresetSelect')) document.getElementById('bgPresetSelect').value = appSettings.bgPreset || 'midnight';
  if (document.getElementById('appAccentColor')) document.getElementById('appAccentColor').value = appSettings.accentColor || '#fbbf24';
}

window.handleBgFileUpload = async function(e) {
  const file = e.target?.files?.[0];
  if (file) {
    const uploadedUrl = await uploadToCloudinary(file);
    if (uploadedUrl) {
      appSettings.bgCustomPhoto = uploadedUrl;
      saveAllAppData();
      applySettings();
    }
  }
};

window.applyBgPreset = function(val) {
  appSettings.bgPreset = val;
  appSettings.bgCustomPhoto = '';
  saveAllAppData();
  applySettings();
};

window.updateAppAccent = function(color) {
  appSettings.accentColor = color;
  saveAllAppData();
  applySettings();
};

window.handleGlobalCardDesignUpload = async function(e) {
  const file = e.target?.files?.[0];
  if (file) {
    const uploadedUrl = await uploadToCloudinary(file);
    if (uploadedUrl) {
      appSettings.globalCardDesignImg = uploadedUrl;
      saveAllAppData();
      renderRoster();
      renderMatchTab();
    }
  }
};

window.clearGlobalCardDesign = function() {
  appSettings.globalCardDesignImg = '';
  saveAllAppData();
  renderRoster();
  renderMatchTab();
};

// DATA BACKUP & RESTORE
window.exportDataBackup = function() {
  const backupData = {
    players: players,
    matchHistory: matchHistory,
    appSettings: appSettings,
    exportedAt: new Date().toISOString()
  };
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backupData, null, 2));
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute("href", dataStr);
  downloadAnchor.setAttribute("download", `volleyball_hub_backup_${Date.now()}.json`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
};

window.importDataBackup = function(e) {
  const file = e.target?.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(event) {
    try {
      const data = JSON.parse(event.target.result);
      if (data.players && Array.isArray(data.players)) {
        players = data.players;
        const firestore = getDb();
        if (firestore) {
          data.players.forEach(p => {
            firestore.collection("players").doc(String(p.id)).set(p, { merge: true });
          });
        }
      }
      if (data.matchHistory && Array.isArray(data.matchHistory)) {
        matchHistory = data.matchHistory;
      }
      if (data.appSettings) {
        appSettings = { ...appSettings, ...data.appSettings };
      }
      saveAllAppData();
      renderAllViews();
      alert("✅ Data backup imported successfully!");
    } catch (err) {
      alert("❌ Invalid JSON backup file: " + err.message);
    }
  };
  reader.readAsText(file);
};

window.closePlayerModal = function() {
  const modal = document.getElementById("playerModal");
  if (modal) modal.style.display = "none";
};

window.removeUploadedPhoto = function() {
  const photoInput = document.getElementById("editPhoto");
  if (photoInput) photoInput.value = "";
  tempPhotoBase64 = "";
  isPhotoRemoved = true;
  updateModalPreview();
};

window.removeUploadedCardDesign = function() {
  const frameInput = document.getElementById("editCustomCardFrame");
  const urlInput = document.getElementById("editCardImageUrl");
  if (frameInput) frameInput.value = "";
  if (urlInput) urlInput.value = "";
  tempPlayerCardFrameBase64 = "";
  isCardFrameRemoved = true;
  if (document.getElementById("editIsSpriteSheet")) document.getElementById("editIsSpriteSheet").checked = false;
  if (document.getElementById("spriteStatusBadge")) document.getElementById("spriteStatusBadge").style.display = "none";
  toggleSpriteMenuDisplay();
  updateModalPreview();
};

window.toggleSpriteMenuDisplay = function() {
  const chk = document.getElementById("editIsSpriteSheet");
  const block = document.getElementById("spriteControlsBlock");
  if (block) {
    block.style.display = chk && chk.checked ? "block" : "none";
  }
  updateModalPreview();
};

// LIVE CARD PREVIEW WITH INSTANT LOCAL FILE READERS, CUSTOM PIXEL DIMENSIONS & SKILLS GRID SETTINGS
window.updateModalPreview = function() {
  const previewBox = document.getElementById("cardCreatorLivePreview");
  if (!previewBox) return;

  const name = document.getElementById("editName")?.value || "PLAYER";
  const pos = document.getElementById("editPos")?.value || "OH";
  const jersey = document.getElementById("editJersey")?.value || "0";
  const textColor = document.getElementById("editTextColor")?.value || "#220e02";
  const statColor = document.getElementById("editStatColor")?.value || textColor;
  const hasShine = document.getElementById("editShineToggle")?.checked || false;
  const featureBadge = document.getElementById("editFeatureBadge")?.value || "";

  const cardWidth = parseInt(document.getElementById("editCardWidth")?.value) || 200;
  const cardHeight = parseInt(document.getElementById("editCardHeight")?.value) || 300;

  const imgX = parseInt(document.getElementById("editImgX")?.value) || 0;
  const imgY = parseInt(document.getElementById("editImgY")?.value) || 0;
  const imgScale = parseFloat(document.getElementById("editImgScale")?.value) || 1;

  const badgeX = parseInt(document.getElementById("editBadgeX")?.value) || 0;
  const badgeY = parseInt(document.getElementById("editBadgeY")?.value) || 0;
  const nameX = parseInt(document.getElementById("editNameX")?.value) || 0;
  const nameY = parseInt(document.getElementById("editNameY")?.value) || 0;
  const statsX = parseInt(document.getElementById("editStatsX")?.value) || 0;
  const statsY = parseInt(document.getElementById("editStatsY")?.value) || 0;
  const jerseyX = parseInt(document.getElementById("editJerseyX")?.value) || 0;
  const jerseyY = parseInt(document.getElementById("editJerseyY")?.value) || 0;

  const statsFontSize = parseInt(document.getElementById("editStatsFontSize")?.value) || 11;
  const statsRowGap = parseInt(document.getElementById("editStatsRowGap")?.value) || 2;

  if (document.getElementById('lblImgX')) document.getElementById('lblImgX').innerText = imgX;
  if (document.getElementById('lblImgY')) document.getElementById('lblImgY').innerText = imgY;
  if (document.getElementById('lblImgScale')) document.getElementById('lblImgScale').innerText = imgScale;
  if (document.getElementById('lblBadgeX')) document.getElementById('lblBadgeX').innerText = badgeX;
  if (document.getElementById('lblBadgeY')) document.getElementById('lblBadgeY').innerText = badgeY;
  if (document.getElementById('lblNameX')) document.getElementById('lblNameX').innerText = nameX;
  if (document.getElementById('lblNameY')) document.getElementById('lblNameY').innerText = nameY;
  if (document.getElementById('lblStatsX')) document.getElementById('lblStatsX').innerText = statsX;
  if (document.getElementById('lblStatsY')) document.getElementById('lblStatsY').innerText = statsY;
  if (document.getElementById('lblJerseyX')) document.getElementById('lblJerseyX').innerText = jerseyX;
  if (document.getElementById('lblJerseyY')) document.getElementById('lblJerseyY').innerText = jerseyY;
  if (document.getElementById('lblStatsFont')) document.getElementById('lblStatsFont').innerText = statsFontSize;
  if (document.getElementById('lblStatsRowGap')) document.getElementById('lblStatsRowGap').innerText = statsRowGap;

  const isSpriteSheet = document.getElementById("editIsSpriteSheet")?.checked || false;
  const spriteTotalFrames = parseInt(document.getElementById("editSpriteTotalFrames")?.value) || 30;
  const spriteActiveFrames = parseInt(document.getElementById("editSpriteActiveFrames")?.value) || 28;
  const spriteFPS = parseInt(document.getElementById("editSpriteFPS")?.value) || 30;

  const photoFileInput = document.getElementById("editPhoto")?.files?.[0];
  const frameFileInput = document.getElementById("editCustomCardFrame")?.files?.[0];

  let photo = "";
  if (photoFileInput) {
    photo = URL.createObjectURL(photoFileInput);
  } else if (!isPhotoRemoved) {
    photo = currentEditingPlayer?.photoUrl || currentEditingPlayer?.photo || "";
  }

  let cardUrl = document.getElementById("editCardImageUrl")?.value?.trim() || "";
  if (frameFileInput) {
    cardUrl = URL.createObjectURL(frameFileInput);
  } else if (!cardUrl && !isCardFrameRemoved) {
    cardUrl = currentEditingPlayer?.cardFrameUrl || "";
  }

  const stats = {
    atk: parseInt(document.getElementById("statAtk")?.value) || 70,
    srv: parseInt(document.getElementById("statSrv")?.value) || 70,
    rcv: parseInt(document.getElementById("statRcv")?.value) || 70,
    blk: parseInt(document.getElementById("statBlk")?.value) || 70,
    stm: parseInt(document.getElementById("statStm")?.value) || 70,
    tmw: parseInt(document.getElementById("statTmw")?.value) || 70
  };

  const manualOvrInput = document.getElementById("editOvr")?.value;
  const ovr = (manualOvrInput !== "" && !isNaN(manualOvrInput)) 
    ? parseInt(manualOvrInput) 
    : Math.round((stats.atk + stats.srv + stats.rcv + stats.blk + stats.stm + stats.tmw) / 6);

  const dummyP = {
    id: "preview",
    name, pos, jersey, stats, ovr,
    photoUrl: photo,
    cardFrameUrl: cardUrl,
    textColor,
    statColor,
    cardWidth,
    cardHeight,
    imgX, imgY, imgScale,
    badgeX, badgeY,
    nameX, nameY,
    statsX, statsY,
    jerseyX, jerseyY,
    statsFontSize,
    statsRowGap,
    isSpriteSheet,
    spriteTotalFrames,
    spriteActiveFrames,
    spriteFPS,
    hasShine,
    featureBadge
  };

  previewBox.innerHTML = createCardHTML(dummyP, "preview", false, false, true);
};

window.openPlayerModal = function(id = null) {
  if (!isAdmin) {
    alert("🔒 Permission Denied: Only logged-in Admins can edit or create player cards.");
    return;
  }

  isPhotoRemoved = false;
  isCardFrameRemoved = false;
  tempPhotoBase64 = "";
  tempPlayerCardFrameBase64 = "";

  const modal = document.getElementById("playerModal");
  if (!modal) return;

  if (id) {
    currentEditingPlayer = players.find(p => String(p.id) === String(id)) || null;
    if (currentEditingPlayer) {
      if (document.getElementById("editId")) document.getElementById("editId").value = currentEditingPlayer.id || "";
      if (document.getElementById("editName")) document.getElementById("editName").value = currentEditingPlayer.name || "";
      if (document.getElementById("editPos")) document.getElementById("editPos").value = currentEditingPlayer.pos || "OH";
      if (document.getElementById("editJersey")) document.getElementById("editJersey").value = currentEditingPlayer.jersey || "0";
      if (document.getElementById("editOvr")) document.getElementById("editOvr").value = currentEditingPlayer.manualOvr || "";
      if (document.getElementById("editTextColor")) document.getElementById("editTextColor").value = currentEditingPlayer.textColor || "#220e02";
      if (document.getElementById("editStatColor")) document.getElementById("editStatColor").value = currentEditingPlayer.statColor || currentEditingPlayer.textColor || "#220e02";
      if (document.getElementById("editCardWidth")) document.getElementById("editCardWidth").value = currentEditingPlayer.cardWidth || 200;
      if (document.getElementById("editCardHeight")) document.getElementById("editCardHeight").value = currentEditingPlayer.cardHeight || 300;
      
      if (document.getElementById("editImgX")) document.getElementById("editImgX").value = currentEditingPlayer.imgX || 0;
      if (document.getElementById("editImgY")) document.getElementById("editImgY").value = currentEditingPlayer.imgY || 0;
      if (document.getElementById("editImgScale")) document.getElementById("editImgScale").value = currentEditingPlayer.imgScale || 1;

      if (document.getElementById("editBadgeX")) document.getElementById("editBadgeX").value = currentEditingPlayer.badgeX || 0;
      if (document.getElementById("editBadgeY")) document.getElementById("editBadgeY").value = currentEditingPlayer.badgeY || 0;
      if (document.getElementById("editNameX")) document.getElementById("editNameX").value = currentEditingPlayer.nameX || 0;
      if (document.getElementById("editNameY")) document.getElementById("editNameY").value = currentEditingPlayer.nameY || 0;
      if (document.getElementById("editStatsX")) document.getElementById("editStatsX").value = currentEditingPlayer.statsX || 0;
      if (document.getElementById("editStatsY")) document.getElementById("editStatsY").value = currentEditingPlayer.statsY || 0;
      if (document.getElementById("editJerseyX")) document.getElementById("editJerseyX").value = currentEditingPlayer.jerseyX || 0;
      if (document.getElementById("editJerseyY")) document.getElementById("editJerseyY").value = currentEditingPlayer.jerseyY || 0;

      if (document.getElementById("editStatsFontSize")) document.getElementById("editStatsFontSize").value = currentEditingPlayer.statsFontSize || 11;
      if (document.getElementById("editStatsRowGap")) document.getElementById("editStatsRowGap").value = currentEditingPlayer.statsRowGap || 2;

      if (document.getElementById("editCardImageUrl")) document.getElementById("editCardImageUrl").value = currentEditingPlayer.cardFrameUrl || "";
      
      if (document.getElementById("editIsSpriteSheet")) document.getElementById("editIsSpriteSheet").checked = !!currentEditingPlayer.isSpriteSheet;
      if (document.getElementById("editSpriteTotalFrames")) document.getElementById("editSpriteTotalFrames").value = currentEditingPlayer.spriteTotalFrames || 30;
      if (document.getElementById("editSpriteActiveFrames")) document.getElementById("editSpriteActiveFrames").value = currentEditingPlayer.spriteActiveFrames || 28;
      if (document.getElementById("editSpriteFPS")) document.getElementById("editSpriteFPS").value = currentEditingPlayer.spriteFPS || 30;

      if (document.getElementById("editShineToggle")) document.getElementById("editShineToggle").checked = !!currentEditingPlayer.hasShine;
      if (document.getElementById("editFeatureBadge")) document.getElementById("editFeatureBadge").value = currentEditingPlayer.featureBadge || "";

      if (currentEditingPlayer.stats) {
        if (document.getElementById("statAtk")) document.getElementById("statAtk").value = currentEditingPlayer.stats.atk || 70;
        if (document.getElementById("statSrv")) document.getElementById("statSrv").value = currentEditingPlayer.stats.srv || 70;
        if (document.getElementById("statRcv")) document.getElementById("statRcv").value = currentEditingPlayer.stats.rcv || 70;
        if (document.getElementById("statBlk")) document.getElementById("statBlk").value = currentEditingPlayer.stats.blk || 70;
        if (document.getElementById("statStm")) document.getElementById("statStm").value = currentEditingPlayer.stats.stm || 70;
        if (document.getElementById("statTmw")) document.getElementById("statTmw").value = currentEditingPlayer.stats.tmw || 70;
      }
    }
  } else {
    currentEditingPlayer = null;
    const form = document.getElementById("playerForm");
    if (form) form.reset();
    if (document.getElementById("editId")) document.getElementById("editId").value = "";
    if (document.getElementById("editOvr")) document.getElementById("editOvr").value = "";
    if (document.getElementById("editTextColor")) document.getElementById("editTextColor").value = "#220e02";
    if (document.getElementById("editStatColor")) document.getElementById("editStatColor").value = "#220e02";
    if (document.getElementById("editCardWidth")) document.getElementById("editCardWidth").value = 200;
    if (document.getElementById("editCardHeight")) document.getElementById("editCardHeight").value = 300;
    
    if (document.getElementById("editImgX")) document.getElementById("editImgX").value = 0;
    if (document.getElementById("editImgY")) document.getElementById("editImgY").value = 0;
    if (document.getElementById("editImgScale")) document.getElementById("editImgScale").value = 1;

    if (document.getElementById("editBadgeX")) document.getElementById("editBadgeX").value = 0;
    if (document.getElementById("editBadgeY")) document.getElementById("editBadgeY").value = 0;
    if (document.getElementById("editNameX")) document.getElementById("editNameX").value = 0;
    if (document.getElementById("editNameY")) document.getElementById("editNameY").value = 0;
    if (document.getElementById("editStatsX")) document.getElementById("editStatsX").value = 0;
    if (document.getElementById("editStatsY")) document.getElementById("editStatsY").value = 0;
    if (document.getElementById("editJerseyX")) document.getElementById("editJerseyX").value = 0;
    if (document.getElementById("editJerseyY")) document.getElementById("editJerseyY").value = 0;
    if (document.getElementById("editStatsFontSize")) document.getElementById("editStatsFontSize").value = 11;
    if (document.getElementById("editStatsRowGap")) document.getElementById("editStatsRowGap").value = 2;

    if (document.getElementById("editIsSpriteSheet")) document.getElementById("editIsSpriteSheet").checked = false;
  }

  toggleSpriteMenuDisplay();
  modal.style.display = "block";
  updateModalPreview();
};

// SAVE PLAYER WITH CLOUDINARY UPLOADS & SKILLS GRID SETTINGS
window.handleSavePlayer = async function(e) {
  if (e) e.preventDefault();

  if (!isAdmin) {
    alert("🔒 Permission Denied: Only logged-in Admins can save changes.");
    return;
  }

  const rawId = document.getElementById("editId")?.value;
  const editId = (rawId && rawId.trim() !== "") ? rawId.trim() : "p_" + Date.now();
  const name = document.getElementById("editName")?.value?.trim() || "Player";
  const pos = document.getElementById("editPos")?.value?.trim() || "OH";
  const jersey = document.getElementById("editJersey")?.value || "0";
  const manualOvrRaw = document.getElementById("editOvr")?.value;
  const textColor = document.getElementById("editTextColor")?.value || "#220e02";
  const statColor = document.getElementById("editStatColor")?.value || textColor;

  const cardWidth = Number(document.getElementById("editCardWidth")?.value) || 200;
  const cardHeight = Number(document.getElementById("editCardHeight")?.value) || 300;

  const imgX = Number(document.getElementById("editImgX")?.value) || 0;
  const imgY = Number(document.getElementById("editImgY")?.value) || 0;
  const imgScale = Number(document.getElementById("editImgScale")?.value) || 1;

  const badgeX = Number(document.getElementById("editBadgeX")?.value) || 0;
  const badgeY = Number(document.getElementById("editBadgeY")?.value) || 0;
  const nameX = Number(document.getElementById("editNameX")?.value) || 0;
  const nameY = Number(document.getElementById("editNameY")?.value) || 0;
  const statsX = Number(document.getElementById("editStatsX")?.value) || 0;
  const statsY = Number(document.getElementById("editStatsY")?.value) || 0;
  const jerseyX = Number(document.getElementById("editJerseyX")?.value) || 0;
  const jerseyY = Number(document.getElementById("editJerseyY")?.value) || 0;

  const statsFontSize = Number(document.getElementById("editStatsFontSize")?.value) || 11;
  const statsRowGap = Number(document.getElementById("editStatsRowGap")?.value) || 2;

  const hasShine = document.getElementById("editShineToggle")?.checked || false;
  const featureBadge = document.getElementById("editFeatureBadge")?.value || "";

  const isSpriteSheet = document.getElementById("editIsSpriteSheet")?.checked || false;
  const spriteTotalFrames = Number(document.getElementById("editSpriteTotalFrames")?.value) || 30;
  const spriteActiveFrames = Number(document.getElementById("editSpriteActiveFrames")?.value) || 28;
  const spriteFPS = Number(document.getElementById("editSpriteFPS")?.value) || 30;

  const photoFile = document.getElementById("editPhoto")?.files?.[0];
  const customFrameFile = document.getElementById("editCustomCardFrame")?.files?.[0];
  let directCardUrl = document.getElementById("editCardImageUrl")?.value?.trim() || "";

  let photoUrl = "";
  if (photoFile) {
    photoUrl = await uploadToCloudinary(photoFile);
  } else if (currentEditingPlayer && !isPhotoRemoved) {
    photoUrl = currentEditingPlayer.photoUrl || currentEditingPlayer.photo || "";
  }

  let cardFrameUrl = "";
  if (customFrameFile) {
    cardFrameUrl = await uploadToCloudinary(customFrameFile);
  } else if (directCardUrl) {
    cardFrameUrl = directCardUrl;
  } else if (currentEditingPlayer && !isCardFrameRemoved) {
    cardFrameUrl = currentEditingPlayer.cardFrameUrl || "";
  }

  const stats = {
    atk: parseInt(document.getElementById("statAtk")?.value) || 70,
    srv: parseInt(document.getElementById("statSrv")?.value) || 70,
    rcv: parseInt(document.getElementById("statRcv")?.value) || 70,
    blk: parseInt(document.getElementById("statBlk")?.value) || 70,
    stm: parseInt(document.getElementById("statStm")?.value) || 70,
    tmw: parseInt(document.getElementById("statTmw")?.value) || 70
  };

  const ovr = (manualOvrRaw !== "" && !isNaN(manualOvrRaw))
    ? Number(manualOvrRaw)
    : Math.round((stats.atk + stats.srv + stats.rcv + stats.blk + stats.stm + stats.tmw) / 6);

  const playerData = {
    id: String(editId),
    name: String(name),
    pos: String(pos),
    jersey: String(jersey),
    stats: stats,
    ovr: Number(ovr),
    manualOvr: manualOvrRaw !== "" ? Number(manualOvrRaw) : "",
    photoUrl: String(photoUrl),
    cardFrameUrl: String(cardFrameUrl),
    textColor: String(textColor),
    statColor: String(statColor),
    cardWidth: Number(cardWidth),
    cardHeight: Number(cardHeight),
    imgX: Number(imgX),
    imgY: Number(imgY),
    imgScale: Number(imgScale),
    badgeX: Number(badgeX),
    badgeY: Number(badgeY),
    nameX: Number(nameX),
    nameY: Number(nameY),
    statsX: Number(statsX),
    statsY: Number(statsY),
    jerseyX: Number(jerseyX),
    jerseyY: Number(jerseyY),
    statsFontSize: Number(statsFontSize),
    statsRowGap: Number(statsRowGap),
    isSpriteSheet: Boolean(isSpriteSheet),
    spriteTotalFrames: Number(spriteTotalFrames),
    spriteActiveFrames: Number(spriteActiveFrames),
    spriteFPS: Number(spriteFPS),
    hasShine: Boolean(hasShine),
    featureBadge: String(featureBadge),
    mvps: currentEditingPlayer ? Number(currentEditingPlayer.mvps || 0) : 0,
    updatedAt: new Date().toISOString()
  };

  const firestore = getDb();
  if (!firestore) {
    alert("❌ Error: Firebase Firestore could not be initialized.");
    return;
  }

  try {
    await firestore.collection("players").doc(String(editId)).set(playerData, { merge: true });
    closePlayerModal();
    alert("✅ Player card saved to cloud!");
  } catch (err) {
    console.error("❌ FIRESTORE WRITE FAILED:", err);
    alert("❌ Firestore write error: " + err.message);
  }
};

window.handleDeletePlayer = function() {
  if (!isAdmin) {
    alert("🔒 Permission Denied: Only logged-in Admins can delete player cards.");
    return;
  }

  const editId = document.getElementById("editId")?.value;
  if (!editId) return;

  const firestore = getDb();
  if (!firestore) return;

  if (confirm("Are you sure you want to delete this player?")) {
    firestore.collection("players").doc(String(editId)).delete()
      .then(() => {
        closePlayerModal();
        alert("Player deleted successfully!");
      })
      .catch(e => alert("Delete failed: " + e.message));
  }
};

window.handleBatchAdd = function() {
  if (!isAdmin) {
    alert("🔒 Permission Denied: Only logged-in Admins can batch add players.");
    return;
  }

  const txt = document.getElementById('batchNames')?.value?.trim();
  if (!txt) return;

  const firestore = getDb();

  txt.split('\n').map(n => n.trim()).filter(Boolean).forEach((name, i) => {
    const defaultStats = { atk:70, srv:70, rcv:70, blk:70, stm:70, tmw:70 };
    const newId = "p_" + Date.now() + "_" + i;
    const newP = {
      id: newId,
      name, pos: 'OH', jersey: Math.floor(Math.random()*99)+1,
      photoUrl: DEFAULT_AVATAR, stats: defaultStats, ovr: calcOVR(defaultStats), mvps: 0, cardFrameUrl: '',
      cardWidth: 200, cardHeight: 300, imgX: 0, imgY: 0, imgScale: 1,
      badgeX: 0, badgeY: 0, nameX: 0, nameY: 0, statsX: 0, statsY: 0, jerseyX: 0, jerseyY: 0,
      statsFontSize: 11, statsRowGap: 2
    };

    if (firestore) {
      firestore.collection("players").doc(newId).set(newP);
    }
  });

  document.getElementById('batchNames').value = '';
};

// REALTIME CLOUD LISTENERS
function listenToCloudData() {
  const firestore = getDb();
  if (!firestore) return;

  firestore.collection("players").onSnapshot(snapshot => {
    if (snapshot && !snapshot.empty) {
      players = snapshot.docs.map(doc => ({
        ...doc.data(),
        id: String(doc.id)
      }));
      players.forEach(p => selectedPlayerIds.add(String(p.id)));
    } else {
      players = [];
    }
    renderRoster();
    renderMatchTab();
    renderDashboard();
  }, err => console.error("Roster snapshot error:", err));

  firestore.collection("appData").doc("roster").onSnapshot(doc => {
    if (doc.exists) {
      const data = doc.data();
      if (data.matchHistory) {
        matchHistory = data.matchHistory;
        try { localStorage.setItem('vb_hub_history', JSON.stringify(matchHistory)); } catch(e){}
      }
      if (data.appSettings) {
        appSettings = data.appSettings;
        try { localStorage.setItem('vb_hub_settings', JSON.stringify(appSettings)); } catch(e){}
      }
      renderHistory();
      renderDashboard();
      applySettings();
    }
  }, err => console.error("AppData snapshot error:", err));
}

// CARD HTML GENERATOR WITH SEPARATE DRAGGABLE JERSEY LAYER & OVR-MATCHING STYLING
function createCardHTML(p, pId, isSel, showEditButton = true, isPreview = false) {
  if (!p) return '';

  const bgGif = p.cardFrameUrl || appSettings.globalCardDesignImg || DEFAULT_CARD_FRAME;
  const photo = p.photoUrl || p.photo || '';
  const textColor = p.textColor || '#220e02';
  const statColor = p.statColor || textColor;
  const name = String(p.name || 'PLAYER').toUpperCase();
  const pos = String(p.pos || 'OH').substring(0, 3).toUpperCase();
  const jersey = String(p.jersey || '0');
  const stats = p.stats || { atk: 70, rcv: 70, blk: 70, stm: 70, srv: 70, tmw: 70 };
  const ovr = p.ovr || 70;
  const badge = p.featureBadge || '';
  const shine = p.hasShine;

  const cardWidth = Number(p.cardWidth) || 200;
  const cardHeight = Number(p.cardHeight) || 300;

  // Position Offsets
  const imgX = Number(p.imgX) || 0;
  const imgY = Number(p.imgY) || 0;
  const imgScale = Number(p.imgScale) || 1;
  const imgTransform = `transform: translate(${imgX}px, ${imgY}px) scale(${imgScale}); transform-origin: center center;`;

  const badgeX = Number(p.badgeX) || 0;
  const badgeY = Number(p.badgeY) || 0;
  const badgeTransform = `transform: translate(${badgeX}px, ${badgeY}px);`;

  const nameX = Number(p.nameX) || 0;
  const nameY = Number(p.nameY) || 0;
  const nameTransform = `transform: translate(${nameX}px, ${nameY}px);`;

  const statsX = Number(p.statsX) || 0;
  const statsY = Number(p.statsY) || 0;
  const statsTransform = `transform: translate(${statsX}px, ${statsY}px);`;

  const jerseyX = Number(p.jerseyX) || 0;
  const jerseyY = Number(p.jerseyY) || 0;
  const jerseyTransform = `transform: translate(${jerseyX}px, ${jerseyY}px);`;

  const statsFontSize = Number(p.statsFontSize) || 11;
  const statsRowGap = Number(p.statsRowGap) !== undefined ? Number(p.statsRowGap) : 2;

  const borderStyle = isSel 
    ? 'outline: 3px solid #22c55e; border-radius: 12px; box-shadow: 0 0 15px rgba(34, 197, 94, 0.7); opacity: 1;' 
    : 'opacity: 0.95;';

  const isBgVideo = isMediaVideo(bgGif);
  const isCutoutVideo = isMediaVideo(photo);
  const isSprite = Boolean(p.isSpriteSheet);
  const totalFrames = Number(p.spriteTotalFrames) || 30;
  const activeFrames = Number(p.spriteActiveFrames) || totalFrames;

  const renderEditBtn = showEditButton && isAdmin;

  const scaleW = cardWidth / 200;
  const scaleH = cardHeight / 300;

  return `
    <div class="fifa-card ${isSel ? 'selected' : ''}" onclick="toggleSelect('${pId}')" 
         style="position: relative; width: ${cardWidth}px; height: ${cardHeight}px; display: inline-block; margin: 10px; cursor: pointer; user-select: none; transition: all 0.2s ease; filter: drop-shadow(0 6px 12px rgba(0,0,0,0.5)); ${borderStyle}">
      
      <!-- LAYER 1: CARD BACKGROUND FRAME -->
      ${isBgVideo ? `
        <video autoplay loop muted playsinline preload="auto" 
               style="position: absolute; top:0; left:0; width:100%; height:100%; object-fit: fill; z-index: 1; border-radius: 12px; pointer-events: none;">
          <source src="${bgGif}">
        </video>
      ` : isSprite ? `
        <div class="sprite-card-frame" 
             data-total-frames="${totalFrames}" 
             data-active-frames="${activeFrames}"
             data-card-width="${cardWidth}"
             style="position: absolute; top:0; left:0; width:100%; height:100%; background-image: url('${bgGif}'); background-size: calc(${cardWidth}px * ${totalFrames}) ${cardHeight}px; background-position: 0px 0px; border-radius: 12px; z-index: 1; pointer-events: none;">
        </div>
      ` : `
        <img src="${bgGif}" alt="Card Frame" 
             style="position: absolute; top:0; left:0; width:100%; height:100%; object-fit: fill; z-index: 1; border-radius: 12px;" 
             onerror="this.onerror=null; this.src='${DEFAULT_CARD_FRAME}';">
      `}

      <!-- LAYER 2: SHINE / GLOSS OVERLAY EFFECT -->
      ${shine ? `
        <div style="position: absolute; top:0; left:0; width:100%; height:100%; z-index: 2; pointer-events: none; border-radius: 12px; background: linear-gradient(135deg, rgba(255,255,255,0.4) 0%, rgba(255,255,255,0) 50%, rgba(255,255,255,0.15) 100%);"></div>
      ` : ''}

      <!-- LAYER 3: PLAYER CUTOUT / MEDIA WITH POSITION & ZOOM ADJUSTMENTS -->
      ${photo ? (
        isCutoutVideo ? `
          <video autoplay loop muted playsinline preload="auto" 
                 data-element="photo" class="${isPreview ? 'draggable-layer' : ''}"
                 style="position: absolute; top: ${38 * scaleH}px; left: ${40 * scaleW}px; width: ${120 * scaleW}px; height: ${120 * scaleH}px; object-fit: contain; z-index: 3; pointer-events: ${isPreview ? 'auto' : 'none'}; ${imgTransform}">
            <source src="${photo}">
          </video>
        ` : `
          <img src="${photo}" alt="${name}" 
               data-element="photo" class="${isPreview ? 'draggable-layer' : ''}"
               style="position: absolute; top: ${38 * scaleH}px; left: ${40 * scaleW}px; width: ${120 * scaleW}px; height: ${120 * scaleH}px; object-fit: contain; z-index: 3; pointer-events: ${isPreview ? 'auto' : 'none'}; ${imgTransform}"
               onerror="this.style.display='none';">
        `
      ) : ''}

      <!-- LAYER 4: OVR RATING, POSITION & BADGE -->
      <div data-element="badge" class="${isPreview ? 'draggable-layer' : ''}" 
           style="position: absolute; top: ${22 * scaleH}px; left: ${22 * scaleW}px; z-index: 4; color: ${textColor}; text-align: center; font-family: 'Arial Black', sans-serif; pointer-events: ${isPreview ? 'auto' : 'none'}; ${badgeTransform}">
        <div style="font-size: ${26 * scaleW}px; font-weight: 900; line-height: 1;">${ovr}</div>
        <div style="font-size: ${11 * scaleW}px; font-weight: 800; font-family: sans-serif; margin-top: 2px;">${pos}</div>
        ${badge ? `<div style="font-size: ${14 * scaleW}px; margin-top: 4px;">${badge}</div>` : ''}
      </div>

      <!-- LAYER 5: PLAYER NAME -->
      <div data-element="name" class="${isPreview ? 'draggable-layer' : ''}" 
           style="position: absolute; top: ${168 * scaleH}px; left: 10px; right: 10px; text-align: center; z-index: 4; color: ${textColor}; font-family: 'Arial Black', sans-serif; font-size: ${13 * scaleW}px; letter-spacing: 0.5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; pointer-events: ${isPreview ? 'auto' : 'none'}; ${nameTransform}">
        ${name}
      </div>

      <!-- LAYER 6: SKILLS GRID SECTION -->
      <div data-element="stats" class="${isPreview ? 'draggable-layer' : ''}" 
           style="position: absolute; top: ${205 * scaleH}px; left: ${28 * scaleW}px; right: ${28 * scaleW}px; z-index: 4; display: grid; grid-template-columns: 1fr 1fr; row-gap: ${statsRowGap}px; color: ${statColor}; font-family: sans-serif; font-size: ${statsFontSize * scaleW}px; font-weight: 900; pointer-events: ${isPreview ? 'auto' : 'none'}; ${statsTransform}">
        <div style="text-align: center;">${stats.atk || 70} <span style="font-size: ${Math.max(7, statsFontSize - 3) * scaleW}px; font-weight: 700; opacity: 0.85;">ATK</span></div>
        <div style="text-align: center;">${stats.rcv || 70} <span style="font-size: ${Math.max(7, statsFontSize - 3) * scaleW}px; font-weight: 700; opacity: 0.85;">RCV</span></div>
        <div style="text-align: center;">${stats.blk || 70} <span style="font-size: ${Math.max(7, statsFontSize - 3) * scaleW}px; font-weight: 700; opacity: 0.85;">BLK</span></div>
        <div style="text-align: center;">${stats.stm || 70} <span style="font-size: ${Math.max(7, statsFontSize - 3) * scaleW}px; font-weight: 700; opacity: 0.85;">STM</span></div>
        <div style="text-align: center;">${stats.srv || 70} <span style="font-size: ${Math.max(7, statsFontSize - 3) * scaleW}px; font-weight: 700; opacity: 0.85;">SRV</span></div>
        <div style="text-align: center;">${stats.tmw || 70} <span style="font-size: ${Math.max(7, statsFontSize - 3) * scaleW}px; font-weight: 700; opacity: 0.85;">TMW</span></div>
      </div>

      <!-- LAYER 7: SEPARATE DRAGGABLE JERSEY NUMBER ELEMENT -->
      <div data-element="jersey" class="${isPreview ? 'draggable-layer' : ''}" 
           style="position: absolute; top: ${230 * scaleH}px; left: ${85 * scaleW}px; z-index: 4; background: rgba(0, 0, 0, 0.75); border: 0px solid rgba(255, 255, 255, 0.25); border-radius: 8px; width: ${30 * scaleW}px; height: ${26 * scaleH}px; display: flex; align-items: center; justify-content: center; text-align: center; color: ${textColor}; font-family: 'Arial Black', sans-serif; pointer-events: ${isPreview ? 'auto' : 'none'}; ${jerseyTransform}">
        <span style="font-size: ${14 * scaleW}px; font-weight: 900; line-height: 1;">${jersey}</span>
      </div>

      <!-- LAYER 8: EDIT BUTTON (ADMIN ONLY) -->
      ${renderEditBtn ? `
        <button onclick="event.stopPropagation(); openPlayerModal('${pId}')" class="btn btn-sec btn-sm" 
                style="position: absolute; bottom: 6px; left: 50%; transform: translateX(-50%); width: 75%; padding: 2px 4px; font-size: 0.65rem; background: rgba(15, 23, 42, 0.9); border: 1px solid rgba(255,255,255,0.2); color: #fff; border-radius: 6px; z-index: 10;">Edit Card</button>
      ` : ''}

    </div>
  `;
}

// INTERACTIVE DRAG & DROP CONTROL ENGINE FOR MODAL PREVIEW
let activeDrag = null;

function initDragPreviewControls() {
  const container = document.getElementById("cardCreatorLivePreview");
  if (!container) return;

  container.addEventListener("pointerdown", (e) => {
    const dragTarget = e.target.closest("[data-element]");
    if (!dragTarget) return;

    const elemType = dragTarget.getAttribute("data-element");
    let inputX, inputY;

    if (elemType === "photo") {
      inputX = document.getElementById("editImgX");
      inputY = document.getElementById("editImgY");
    } else if (elemType === "badge") {
      inputX = document.getElementById("editBadgeX");
      inputY = document.getElementById("editBadgeY");
    } else if (elemType === "name") {
      inputX = document.getElementById("editNameX");
      inputY = document.getElementById("editNameY");
    } else if (elemType === "stats") {
      inputX = document.getElementById("editStatsX");
      inputY = document.getElementById("editStatsY");
    } else if (elemType === "jersey") {
      inputX = document.getElementById("editJerseyX");
      inputY = document.getElementById("editJerseyY");
    }

    if (!inputX || !inputY) return;

    activeDrag = {
      elemType,
      startX: e.clientX,
      startY: e.clientY,
      initialX: parseInt(inputX.value) || 0,
      initialY: parseInt(inputY.value) || 0,
      inputX,
      inputY,
      target: dragTarget
    };

    try { dragTarget.setPointerCapture(e.pointerId); } catch(err){}
    e.preventDefault();
  });

  container.addEventListener("pointermove", (e) => {
    if (!activeDrag) return;

    const deltaX = Math.round(e.clientX - activeDrag.startX);
    const deltaY = Math.round(e.clientY - activeDrag.startY);

    let newX = activeDrag.initialX + deltaX;
    let newY = activeDrag.initialY + deltaY;

    const minX = parseInt(activeDrag.inputX.min) || -120;
    const maxX = parseInt(activeDrag.inputX.max) || 120;
    const minY = parseInt(activeDrag.inputY.min) || -120;
    const maxY = parseInt(activeDrag.inputY.max) || 120;

    newX = Math.min(maxX, Math.max(minX, newX));
    newY = Math.min(maxY, Math.max(minY, newY));

    activeDrag.inputX.value = newX;
    activeDrag.inputY.value = newY;

    updateModalPreview();
  });

  const stopDrag = (e) => {
    if (activeDrag && activeDrag.target) {
      try { activeDrag.target.releasePointerCapture(e.pointerId); } catch(err){}
    }
    activeDrag = null;
  };

  container.addEventListener("pointerup", stopDrag);
  container.addEventListener("pointercancel", stopDrag);
}

function renderRoster() {
  const grid = document.getElementById('rosterGrid');
  if (!grid) return;
  if (!players || players.length === 0) {
    grid.innerHTML = '<p style="color: #94a3b8; text-align: center; width: 100%;">No players found.</p>';
    return;
  }
  grid.innerHTML = players.map(p => createCardHTML(p, String(p.id), selectedPlayerIds.has(String(p.id)), true)).join('');
}

function renderMatchTab() {
  const grid = document.getElementById('matchTabRosterGrid');
  const selectedCountEl = document.getElementById('selectedCount');
  if (selectedCountEl) selectedCountEl.innerText = `${selectedPlayerIds.size} Selected`;
  if (!grid) return;
  if (!players || players.length === 0) {
    grid.innerHTML = '<p style="color: #94a3b8; text-align: center; width: 100%;">No players available to select.</p>';
    return;
  }
  grid.innerHTML = players.map(p => createCardHTML(p, String(p.id), selectedPlayerIds.has(String(p.id)), false)).join('');
}

function renderDashboard() {
  if (document.getElementById('dashTotalPlayers')) document.getElementById('dashTotalPlayers').innerText = players.length;
  if (document.getElementById('dashTotalMatches')) document.getElementById('dashTotalMatches').innerText = matchHistory.length;

  const sortedByMVP = [...players].sort((a,b) => (b.mvps || 0) - (a.mvps || 0));
  const topMVP = sortedByMVP[0] && (sortedByMVP[0].mvps || 0) > 0 ? `${sortedByMVP[0].name} (${sortedByMVP[0].mvps})` : 'None';
  if (document.getElementById('dashTopMVP')) document.getElementById('dashTopMVP').innerText = topMVP;

  const topOvr = [...players].sort((a,b) => (b.ovr || 70) - (a.ovr || 70)).slice(0, 5);
  const topList = document.getElementById('topPlayersList');
  if (topList) {
    topList.innerHTML = topOvr.map(p => `
      <div class="list-row" style="display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid rgba(255,255,255,0.1);">
        <span>${p.name} (${p.pos || 'OH'})</span>
        <span style="font-weight:bold; color:var(--accent-color);">${p.ovr || 70} OVR</span>
      </div>
    `).join('');
  }

  const mvpList = document.getElementById('mvpLeaderboardList');
  if (mvpList) {
    mvpList.innerHTML = sortedByMVP.map(p => `
      <div class="list-row" style="display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid rgba(255,255,255,0.1);">
        <span>${p.name}</span>
        <span style="font-weight:bold; color:var(--accent-color);">${p.mvps || 0} MVPs</span>
      </div>
    `).join('');
  }
}

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

window.toggleSelect = function(id) {
  const strId = String(id);
  if (selectedPlayerIds.has(strId)) selectedPlayerIds.delete(strId);
  else selectedPlayerIds.add(strId);
  renderRoster();
  renderMatchTab();
};

window.selectAllPlayers = function(val) {
  if (val) selectedPlayerIds = new Set(players.map(p => String(p.id)));
  else selectedPlayerIds.clear();
  renderRoster();
  renderMatchTab();
};

// MATCHMAKER ENGINE
window.generateMatch = function(balanced) {
  const pool = players.filter(p => selectedPlayerIds.has(String(p.id)));
  if (pool.length < 2) return alert(`Select at least 2 players! Currently selected: ${pool.length}`);

  let teamA = [], teamB = [];

  if (balanced) {
    const sorted = [...pool].sort((a,b) => (b.ovr || 70) - (a.ovr || 70));
    let sumA = 0, sumB = 0;
    sorted.forEach(p => {
      const pOvr = p.ovr || 70;
      if (sumA <= sumB && teamA.length < Math.ceil(pool.length / 2)) {
        teamA.push(p); sumA += pOvr;
      } else {
        teamB.push(p); sumB += pOvr;
      }
    });
  } else {
    const shuffled = [...pool].sort(() => Math.random() - 0.5);
    const mid = Math.ceil(shuffled.length / 2);
    teamA = shuffled.slice(0, mid);
    teamB = shuffled.slice(mid);
  }

  const avgA = Math.round(teamA.reduce((s,p) => s + (p.ovr || 70), 0) / (teamA.length || 1));
  const avgB = Math.round(teamB.reduce((s,p) => s + (p.ovr || 70), 0) / (teamB.length || 1));

  currentMatchData = { teamA, teamB, avgA, avgB, mode: balanced ? 'Skill Balanced' : 'Pure Random' };

  const panel = document.getElementById('generatedMatchPanel');
  if (panel) panel.style.display = 'block';

  const diffEl = document.getElementById('diffIndicator');
  if (diffEl) diffEl.innerText = `Δ ${Math.abs(avgA - avgB)} OVR (${currentMatchData.mode})`;

  const boxA = document.getElementById('teamABox');
  if (boxA) {
    boxA.innerHTML = `<h4 style="color:#fbbf24; margin-bottom:8px;">Team A (Avg ${avgA})</h4>` +
      teamA.map(p => `<div style="font-size:0.85rem; padding: 2px 0;">${p.name} (${p.ovr || 70} OVR)</div>`).join('');
  }

  const boxB = document.getElementById('teamBBox');
  if (boxB) {
    boxB.innerHTML = `<h4 style="color:#60a5fa; margin-bottom:8px;">Team B (Avg ${avgB})</h4>` +
      teamB.map(p => `<div style="font-size:0.85rem; padding: 2px 0;">${p.name} (${p.ovr || 70} OVR)</div>`).join('');
  }

  const mvpSelect = document.getElementById('mvpSelect');
  if (mvpSelect) {
    mvpSelect.innerHTML = '<option value="">Select Match MVP (Optional)</option>' +
      pool.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
  }
};

window.saveMatchResult = function() {
  if (!currentMatchData) return;

  const scoreA = Number(document.getElementById('scoreA')?.value) || 0;
  const scoreB = Number(document.getElementById('scoreB')?.value) || 0;
  const mvpId = document.getElementById('mvpSelect')?.value;

  const firestore = getDb();

  if (mvpId) {
    const mvpPlayer = players.find(p => String(p.id) === String(mvpId));
    if (mvpPlayer) {
      mvpPlayer.mvps = (mvpPlayer.mvps || 0) + 1;
      if (firestore) {
        firestore.collection("players").doc(mvpPlayer.id).update({ mvps: mvpPlayer.mvps });
      }
    }
  }

  const record = {
    id: Date.now().toString(),
    date: new Date().toLocaleDateString(),
    teamA: currentMatchData.teamA.map(p => p.name),
    teamB: currentMatchData.teamB.map(p => p.name),
    scoreA, scoreB,
    mvpName: mvpId ? players.find(p => String(p.id) === String(mvpId))?.name : 'None'
  };

  matchHistory.unshift(record);
  saveAllAppData();
  alert('Match logged and saved to cloud!');
  
  const panel = document.getElementById('generatedMatchPanel');
  if (panel) panel.style.display = 'none';
};

document.addEventListener("DOMContentLoaded", () => {
  listenToCloudData();
  applySettings();
  renderDashboard();
  initDragPreviewControls();

  const form = document.getElementById("playerForm");
  if (form) {
    form.addEventListener("input", () => window.updateModalPreview());
    form.addEventListener("change", () => window.updateModalPreview());
  }

  // AUTO-DETECT SPRITE STRIP WHEN UPLOADING CARD SHELL FILE
  const frameInput = document.getElementById("editCustomCardFrame");
  if (frameInput) {
    frameInput.addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (!file || file.type.startsWith('video')) return;

      const img = new Image();
      img.onload = function() {
        const aspectRatio = img.naturalWidth / img.naturalHeight;
        if (aspectRatio > 2) {
          const singleWidth = img.naturalHeight * (2 / 3);
          const rawFrames = Math.round(img.naturalWidth / singleWidth);
          const total = rawFrames > 1 ? rawFrames : 30;
          const active = Math.max(1, total - 2);

          if (document.getElementById('editSpriteTotalFrames')) document.getElementById('editSpriteTotalFrames').value = total;
          if (document.getElementById('editSpriteActiveFrames')) document.getElementById('editSpriteActiveFrames').value = active;
          if (document.getElementById('editIsSpriteSheet')) document.getElementById('editIsSpriteSheet').checked = true;
          if (document.getElementById('spriteStatusBadge')) {
            const badge = document.getElementById('spriteStatusBadge');
            badge.innerText = `✓ Sprite Strip Detected (${active}/${total} Active Frames)`;
            badge.style.display = 'block';
          }
          toggleSpriteMenuDisplay();
        }
      };
      img.src = URL.createObjectURL(file);
    });
  }
});
