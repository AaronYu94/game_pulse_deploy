// Backend base URL — in dev Vite proxies /api to localhost:3000
// In prod set VITE_API_URL=https://your-backend.onrender.com in Vercel env vars
const API_BASE = import.meta.env.VITE_API_URL || '';

function getToken() { return localStorage.getItem('score_token'); }

export async function apiFetch(path, options = {}) {
  const token = getToken();
  const hasBody = options.body !== undefined;
  const res = await fetch(API_BASE + path, {
    ...options,
    headers: {
      ...(hasBody ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
    body: hasBody ? JSON.stringify(options.body) : undefined,
  });

  const contentType = res.headers.get('content-type') || '';
  const data = contentType.includes('application/json')
    ? await res.json()
    : await res.text();

  if (!res.ok) {
    const message = typeof data === 'string'
      ? (data || `Request failed (${res.status})`)
      : (data.error || data.message || `Request failed (${res.status})`);
    const err = new Error(message);
    err.status = res.status;
    throw err;
  }
  return data;
}

// Auth
export async function apiRegister(username, email, password) {
  return apiFetch('/api/auth/register', { method: 'POST', body: { username, email, password } });
}
export async function apiLogin(email, password) {
  return apiFetch('/api/auth/login', { method: 'POST', body: { email, password } });
}
export async function apiGetAuthProviders() {
  return apiFetch('/api/auth/providers');
}

// Coins & Tasks
export async function apiGetCoins() {
  return apiFetch('/api/coins');
}
export async function apiClaimTask(key) {
  return apiFetch(`/api/coins/claim/${key}`, { method: 'POST', body: {} });
}

// Bets
export async function apiGetAllBets() {
  const data = await apiFetch('/api/bets');
  return data.bets || [];
}
export async function apiGetBet(gameId) {
  const data = await apiFetch(`/api/bets/${gameId}`);
  return data.bet || null;
}
export async function apiPlaceBet(gameId, pick, amount, homeAbbr, awayAbbr) {
  return apiFetch('/api/bets', { method: 'POST', body: { gameId, pick, amount, homeAbbr, awayAbbr } });
}
export async function apiSettleBets(games) {
  return apiFetch('/api/bets/settle', { method: 'POST', body: { games } });
}

// Ratings
export async function apiGetGameRating(gameId) {
  return apiFetch(`/api/ratings/${gameId}`);
}
export async function apiRateGame(gameId, score) {
  return apiFetch(`/api/ratings/${gameId}`, { method: 'POST', body: { score } });
}
export async function apiGetRefRating(gameId) {
  return apiFetch(`/api/ratings/ref/${gameId}`);
}
export async function apiRateRef(gameId, verdict) {
  return apiFetch(`/api/ratings/ref/${gameId}`, { method: 'POST', body: { verdict } });
}
export async function apiGetAllPlayerRatings(gameId) {
  const data = await apiFetch(`/api/ratings/player/${gameId}`);
  return data.ratings || {};
}
export async function apiRatePlayer(gameId, playerId, score) {
  return apiFetch(`/api/ratings/player/${gameId}/${playerId}`, { method: 'POST', body: { score } });
}

// Comments
export async function apiGetComments(gameId) {
  const data = await apiFetch(`/api/comments/${gameId}`);
  return data.comments || [];
}
export async function apiPostComment(gameId, content, playerId = null, pick = null) {
  return apiFetch(`/api/comments/${gameId}`, { method: 'POST', body: { content, playerId, pick } });
}
export async function apiLikeComment(commentId) {
  return apiFetch(`/api/comments/${commentId}/like`, { method: 'POST', body: {} });
}

// Forum
export async function apiGetTopics({ cat = 'all', sort = 'latest', q = '' } = {}) {
  const params = new URLSearchParams();
  if (cat && cat !== 'all') params.set('cat', cat);
  if (sort && sort !== 'latest') params.set('sort', sort);
  if (q) params.set('q', q);
  const qs = params.toString() ? `?${params}` : '';
  const data = await apiFetch(`/api/forum/topics${qs}`);
  return data.topics || [];
}
export async function apiCreateTopic(title, body, category = 'general', gameId = null) {
  return apiFetch('/api/forum/topics', { method: 'POST', body: { title, body, category, gameId } });
}
export async function apiGetTopic(id) {
  return apiFetch(`/api/forum/topics/${id}`);
}
export async function apiPostReply(topicId, content, quoteAuthor = null, quoteText = null) {
  return apiFetch(`/api/forum/topics/${topicId}/replies`, {
    method: 'POST',
    body: { content, quoteAuthor, quoteText },
  });
}
export async function apiLikeReply(postId) {
  return apiFetch(`/api/forum/replies/${postId}/like`, { method: 'POST', body: {} });
}
export async function apiDislikeReply(postId) {
  return apiFetch(`/api/forum/replies/${postId}/dislike`, { method: 'POST', body: {} });
}

// Chat
export async function apiGetChat(gameId) {
  const data = await apiFetch(`/api/chat/${gameId}`);
  return data.messages || [];
}

// Shop
export async function apiGetShop() {
  return apiFetch('/api/shop');
}
export async function apiBuyItem(itemId) {
  return apiFetch(`/api/shop/buy/${itemId}`, { method: 'POST', body: {} });
}
export async function apiGetInventory() {
  return apiFetch('/api/shop/inventory');
}
export async function apiEquipTitle(itemId) {
  return apiFetch(`/api/shop/equip/${itemId}`, { method: 'POST', body: {} });
}
export async function apiUnequipTitle() {
  return apiFetch('/api/shop/unequip', { method: 'POST', body: {} });
}

// Profile
export async function apiGetProfile() {
  return apiFetch('/api/profile/me');
}
export async function apiUpdateProfile(data) {
  return apiFetch('/api/profile/me', { method: 'PATCH', body: data });
}

export const DAILY_TASK_DEFS = [
  { key: 'login',   label: 'Daily Login',    icon: '★', reward: 20 },
  { key: 'share',   label: 'Share a Game',   icon: '↗', reward: 50 },
  { key: 'rating',  label: 'Rate a Player',  icon: '◆', reward: 10 },
  { key: 'comment', label: 'Post a Comment', icon: '✦', reward: 15 },
];
