/* =====================================================
   SCORE NBA — API Client
   ===================================================== */

// !! UPDATE THIS to your Render backend URL after deployment !!
const API_BASE = (() => {
  const h = window.location.hostname;
  return (h === 'localhost' || h === '127.0.0.1')
    ? 'http://localhost:3000'
    : 'https://score-nba-backend.onrender.com';
})();

/* ---------- Auth helpers ---------- */
function getToken()  { return localStorage.getItem('score_token'); }
function getUser()   { try { return JSON.parse(localStorage.getItem('score_user')); } catch { return null; } }
function isLoggedIn(){ return !!getToken(); }

function setSession(token, user) {
  localStorage.setItem('score_token', token);
  localStorage.setItem('score_user', JSON.stringify(user));
}

function clearSession() {
  localStorage.removeItem('score_token');
  localStorage.removeItem('score_user');
}

function requireAuth() {
  if (!isLoggedIn()) {
    window.location.href = 'login.html?redirect=' + encodeURIComponent(window.location.href);
    return false;
  }
  return true;
}

/* ---------- Core fetch ---------- */
async function apiFetch(path, options = {}) {
  const token = getToken();
  const res = await fetch(API_BASE + path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (res.status === 401) {
    clearSession();
    window.location.href = 'login.html?redirect=' + encodeURIComponent(window.location.href);
    return null;
  }

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

/* ---------- Auth ---------- */
async function apiRegister(username, email, password) {
  const data = await apiFetch('/api/auth/register', {
    method: 'POST',
    body: { username, email, password },
  });
  if (data) setSession(data.token, data.user);
  return data;
}

async function apiLogin(email, password) {
  const data = await apiFetch('/api/auth/login', {
    method: 'POST',
    body: { email, password },
  });
  if (data) setSession(data.token, data.user);
  return data;
}

function apiLogout() {
  clearSession();
  window.location.href = 'login.html';
}

/* ---------- Coins & Daily Tasks ---------- */
async function apiGetCoins() {
  return apiFetch('/api/coins');
}

async function apiClaimTask(key) {
  return apiFetch(`/api/coins/claim/${key}`, { method: 'POST', body: {} });
}

/* ---------- Bets ---------- */
async function apiGetAllBets() {
  const data = await apiFetch('/api/bets');
  return data?.bets || [];
}

async function apiGetBet(gameId) {
  const data = await apiFetch(`/api/bets/${gameId}`);
  return data?.bet || null;
}

async function apiPlaceBet(gameId, pick, amount, homeAbbr, awayAbbr) {
  return apiFetch('/api/bets', {
    method: 'POST',
    body: { gameId, pick, amount, homeAbbr, awayAbbr },
  });
}

async function apiSettleBets(games) {
  return apiFetch('/api/bets/settle', {
    method: 'POST',
    body: { games },
  });
}

/* ---------- Game Ratings ---------- */
async function apiGetGameRating(gameId) {
  return apiFetch(`/api/ratings/${gameId}`);
}

async function apiRateGame(gameId, score) {
  return apiFetch(`/api/ratings/${gameId}`, { method: 'POST', body: { score } });
}

/* ---------- Ref Ratings ---------- */
async function apiGetRefRating(gameId) {
  return apiFetch(`/api/ratings/ref/${gameId}`);
}

async function apiRateRef(gameId, verdict) {
  return apiFetch(`/api/ratings/ref/${gameId}`, { method: 'POST', body: { verdict } });
}

/* ---------- Player Ratings ---------- */
async function apiGetAllPlayerRatings(gameId) {
  const data = await apiFetch(`/api/ratings/player/${gameId}`);
  return data?.ratings || {};
}

async function apiRatePlayer(gameId, playerId, score) {
  return apiFetch(`/api/ratings/player/${gameId}/${playerId}`, {
    method: 'POST',
    body: { score },
  });
}

/* ---------- Comments ---------- */
async function apiGetComments(gameId) {
  const data = await apiFetch(`/api/comments/${gameId}`);
  return data?.comments || [];
}

async function apiPostComment(gameId, content, playerId = null, pick = null) {
  return apiFetch(`/api/comments/${gameId}`, {
    method: 'POST',
    body: { content, playerId, pick },
  });
}

async function apiLikeComment(commentId) {
  return apiFetch(`/api/comments/${commentId}/like`, { method: 'POST', body: {} });
}

/* ---------- Forum ---------- */
async function apiGetTopics() {
  const data = await apiFetch('/api/forum/topics');
  return data?.topics || [];
}

async function apiCreateTopic(title, body, gameId = null, category = 'chat') {
  return apiFetch('/api/forum/topics', {
    method: 'POST',
    body: { title, body, gameId, category },
  });
}

async function apiGetTopic(id) {
  return apiFetch(`/api/forum/topics/${id}`);
}

async function apiPostReply(topicId, content) {
  return apiFetch(`/api/forum/topics/${topicId}/replies`, {
    method: 'POST',
    body: { content },
  });
}

async function apiLikeReply(postId) {
  return apiFetch(`/api/forum/replies/${postId}/like`, { method: 'POST', body: {} });
}

async function apiDislikeReply(postId) {
  return apiFetch(`/api/forum/replies/${postId}/dislike`, { method: 'POST', body: {} });
}

/* ---------- UI helpers ---------- */

// Render user info in header (call after DOM ready)
function renderHeaderUser() {
  const user = getUser();
  const nav  = document.querySelector('.site-nav');
  if (!nav) return;

  const existing = nav.querySelector('.header-user');
  if (existing) existing.remove();

  const div = document.createElement('div');
  div.className = 'header-user';
  div.style.cssText = 'display:flex;align-items:center;gap:.5rem;margin-left:.5rem;';

  if (user) {
    div.innerHTML = `
      <span style="font-size:.78rem;color:var(--text-sub);font-weight:600">${escapeHtml(user.username)}</span>
      <button onclick="apiLogout()" style="background:none;border:1px solid var(--border);border-radius:var(--radius-pill);padding:.2rem .65rem;font-size:.72rem;color:var(--text-muted);cursor:pointer;font-family:inherit;">Logout</button>
    `;
  } else {
    div.innerHTML = `<a href="login.html" style="font-size:.78rem;color:var(--accent);font-weight:700;text-decoration:none;">Login</a>`;
  }
  nav.appendChild(div);
}

// Helper to get top comment for a player from a pre-fetched list
function getTopPlayerCommentFromList(comments, playerId) {
  if (!playerId || !comments?.length) return null;
  const list = comments.filter(c => String(c.player_id) === String(playerId));
  if (!list.length) return null;
  return list.reduce((best, c) => (c.likes || 0) >= (best.likes || 0) ? c : best, list[0]);
}

/* ---------- Chat ---------- */
async function apiGetChat(gameId) {
  const data = await apiFetch(`/api/chat/${gameId}`);
  return data?.messages || [];
}

/* ---------- Shop ---------- */
async function apiGetShop() {
  return apiFetch('/api/shop');
}

async function apiBuyItem(itemId) {
  return apiFetch(`/api/shop/buy/${itemId}`, { method: 'POST', body: {} });
}

async function apiEquipTitle(itemId) {
  return apiFetch(`/api/shop/equip/${itemId}`, { method: 'POST', body: {} });
}

async function apiUnequipTitle() {
  return apiFetch('/api/shop/unequip', { method: 'POST', body: {} });
}

async function apiGetInventory() {
  const data = await apiFetch('/api/shop/inventory');
  return data?.items || [];
}

/* ---------- Profile ---------- */
async function apiGetProfile() {
  return apiFetch('/api/profile/me');
}

async function apiUpdateBio(bio) {
  return apiFetch('/api/profile/me', { method: 'PATCH', body: { bio } });
}

// Task definitions (for UI rendering only)
const DAILY_TASK_DEFS = [
  { key: 'login',   label: 'Daily Login',   icon: '★', reward: 20 },
  { key: 'share',   label: 'Share a Game',  icon: '↗', reward: 50 },
  { key: 'rating',  label: 'Rate a Player', icon: '◆', reward: 10 },
  { key: 'comment', label: 'Post a Comment',icon: '✦', reward: 15 },
];
