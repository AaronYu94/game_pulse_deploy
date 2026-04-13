const ESPN_BASE = 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba';

/* ==========================================================
   TEAM BADGE COLORS — All 30 NBA teams
   ========================================================== */
export const TEAM_COLORS = {
  ATL: { bg: '#C8102E', border: '#C8102E', text: '#fff' },
  BOS: { bg: '#007A33', border: '#007A33', text: '#fff' },
  BKN: { bg: '#000000', border: '#ffffff', text: '#fff' },
  CHA: { bg: '#1D1160', border: '#00788C', text: '#00788C' },
  CHI: { bg: '#CE1141', border: '#000000', text: '#fff' },
  CLE: { bg: '#860038', border: '#FDBB30', text: '#FDBB30' },
  DAL: { bg: '#00538C', border: '#002B5E', text: '#fff' },
  DEN: { bg: '#0E2240', border: '#FEC524', text: '#FEC524' },
  DET: { bg: '#C8102E', border: '#1D42BA', text: '#fff' },
  GSW: { bg: '#1D428A', border: '#FFC72C', text: '#FFC72C' },
  HOU: { bg: '#CE1141', border: '#C4CED3', text: '#fff' },
  IND: { bg: '#002D62', border: '#FDBB30', text: '#FDBB30' },
  LAC: { bg: '#C8102E', border: '#1D428A', text: '#fff' },
  LAL: { bg: '#552583', border: '#FDB927', text: '#FDB927' },
  MEM: { bg: '#12173F', border: '#5D76A9', text: '#fff' },
  MIA: { bg: '#98002E', border: '#F9A01B', text: '#fff' },
  MIL: { bg: '#00471B', border: '#EEE1C6', text: '#EEE1C6' },
  MIN: { bg: '#0C2340', border: '#236192', text: '#fff' },
  NOP: { bg: '#0C2340', border: '#C8A956', text: '#C8A956' },
  NYK: { bg: '#006BB6', border: '#F58426', text: '#fff' },
  OKC: { bg: '#007AC1', border: '#EF3B24', text: '#fff' },
  ORL: { bg: '#0077C0', border: '#000000', text: '#fff' },
  PHI: { bg: '#006BB6', border: '#ED174C', text: '#fff' },
  PHX: { bg: '#1D1160', border: '#E56020', text: '#E56020' },
  POR: { bg: '#E03A3E', border: '#000000', text: '#fff' },
  SAC: { bg: '#5A2D81', border: '#63727A', text: '#fff' },
  SAS: { bg: '#C4CED4', border: '#000000', text: '#000000' },
  TOR: { bg: '#CE1141', border: '#000000', text: '#fff' },
  UTA: { bg: '#002B5C', border: '#F9A01B', text: '#F9A01B' },
  WAS: { bg: '#002B5C', border: '#E31837', text: '#fff' },
};

const ESPN_ABBR_MAP = {
  GS: 'GSW', NO: 'NOP', SA: 'SAS', NY: 'NYK', WSH: 'WAS',
};

export function getTeamColors(abbr) {
  const key = ESPN_ABBR_MAP[abbr] || abbr;
  return TEAM_COLORS[key] || { bg: '#1a1a2e', border: '#444', text: '#aaa' };
}

/* Team Badge React Component helper — returns style object + text */
export function teamBadgeProps(abbr, size = '') {
  const c = getTeamColors(abbr);
  return { bg: c.bg, border: c.border, text: c.text, abbr: abbr || '?' };
}

/* ==========================================================
   CHAT FRAMES
   ========================================================== */
export const TEAM_NAMES = {
  ATL:'Atlanta Hawks', BOS:'Boston Celtics', BKN:'Brooklyn Nets',
  CHA:'Charlotte Hornets', CHI:'Chicago Bulls', CLE:'Cleveland Cavaliers',
  DAL:'Dallas Mavericks', DEN:'Denver Nuggets', DET:'Detroit Pistons',
  GSW:'Golden State Warriors', HOU:'Houston Rockets', IND:'Indiana Pacers',
  LAC:'LA Clippers', LAL:'Los Angeles Lakers', MEM:'Memphis Grizzlies',
  MIA:'Miami Heat', MIL:'Milwaukee Bucks', MIN:'Minnesota Timberwolves',
  NOP:'New Orleans Pelicans', NYK:'New York Knicks', OKC:'OKC Thunder',
  ORL:'Orlando Magic', PHI:'Philadelphia 76ers', PHX:'Phoenix Suns',
  POR:'Portland Trail Blazers', SAC:'Sacramento Kings', SAS:'San Antonio Spurs',
  TOR:'Toronto Raptors', UTA:'Utah Jazz', WAS:'Washington Wizards',
};

export const CHAT_FRAMES = Object.keys(TEAM_NAMES).map(abbr => ({
  id: 'cf_' + abbr.toLowerCase(),
  abbr,
  name: TEAM_NAMES[abbr],
  ...TEAM_COLORS[abbr],
}));

export const CF_KEY = 'gp_cf_equipped';
export function getEquippedFrame() { return localStorage.getItem(CF_KEY) || null; }
export function setEquippedFrame(id) {
  if (id) localStorage.setItem(CF_KEY, id);
  else localStorage.removeItem(CF_KEY);
}
export function getFrameById(id) { return CHAT_FRAMES.find(f => f.id === id) || null; }

/* ---------- Date helpers ---------- */
export function toESPNDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}${m}${d}`;
}

export function toDisplayDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function toDisplayTime(dateStr) {
  return new Date(dateStr).toLocaleTimeString('en-US', {
    hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York', timeZoneName: 'short',
  });
}

/* ---------- ESPN API fetchers ---------- */
export async function fetchGames(espnDate) {
  const res = await fetch(`${ESPN_BASE}/scoreboard?dates=${espnDate}&limit=20`);
  if (!res.ok) throw new Error(`Scoreboard fetch failed: ${res.status}`);
  const json = await res.json();
  return (json.events || []).map(parseGame);
}

export async function fetchGameDetail(gameId) {
  const res = await fetch(`${ESPN_BASE}/summary?event=${gameId}`);
  if (!res.ok) throw new Error(`Game detail fetch failed: ${res.status}`);
  const json = await res.json();
  return parseGameDetail(json);
}

export async function fetchGameTracker(gameId) {
  const res = await fetch(`${ESPN_BASE}/summary?event=${gameId}`);
  if (!res.ok) throw new Error('Tracker fetch failed');
  const json = await res.json();

  const comps = json.header?.competitions?.[0]?.competitors || [];
  const homeTeamId = comps.find(c => c.homeAway === 'home')?.team?.id || null;

  const allPlays = (json.plays || []).filter(p => p.period?.number);
  return { allPlays, homeTeamId };
}

export async function fetchTeamStats(teamId) {
  const res = await fetch(`https://site.web.api.espn.com/apis/site/v2/sports/basketball/nba/teams/${teamId}/statistics`);
  if (!res.ok) throw new Error('Team stats fetch failed');
  const json = await res.json();
  const cats = json.results?.stats?.categories || [];
  const byName = {};
  cats.forEach(cat => (cat.stats || []).forEach(s => { if (!byName[s.name]) byName[s.name] = s; }));
  const v = name => ({ val: byName[name]?.value || 0, display: byName[name]?.displayValue || '—' });
  return {
    ppg: v('avgPoints'), rpg: v('avgRebounds'), apg: v('avgAssists'),
    bpg: v('avgBlocks'), spg: v('avgSteals'), fgPct: v('fieldGoalPct'),
    fg3Pct: v('threePointPct'), ftPct: v('freeThrowPct'), topg: v('avgTurnovers'),
  };
}

export async function fetchTeamRecentGames(teamId, limit = 5) {
  const res = await fetch(`https://site.web.api.espn.com/apis/site/v2/sports/basketball/nba/teams/${teamId}/schedule?season=2026`);
  if (!res.ok) throw new Error('Schedule fetch failed');
  const json = await res.json();
  const done = (json.events || []).filter(e => e.competitions?.[0]?.status?.type?.completed);
  return done.slice(-limit).reverse().map(e => {
    const comp = e.competitions?.[0] || {};
    const cs   = comp.competitors || [];
    const home = cs.find(c => c.homeAway === 'home') || {};
    const away = cs.find(c => c.homeAway === 'away') || {};
    const mine = cs.find(c => String(c.team?.id) === String(teamId)) || {};
    const opp  = cs.find(c => String(c.team?.id) !== String(teamId)) || {};
    const hs   = home.score?.value ?? (typeof home.score === 'number' ? home.score : Number(home.score)) ?? null;
    const as_  = away.score?.value ?? (typeof away.score === 'number' ? away.score : Number(away.score)) ?? null;
    return {
      date: e.date ? e.date.slice(0, 10) : '',
      homeAbb: home.team?.abbreviation || '', awayAbb: away.team?.abbreviation || '',
      homeScore: hs, awayScore: as_,
      isHome: mine.homeAway === 'home', won: mine.winner || false,
      oppAbb: opp.team?.abbreviation || '???',
    };
  });
}

/* ---------- Parsers ---------- */
function parseGame(event) {
  const comp  = event.competitions?.[0] || {};
  const comps = comp.competitors || [];
  const home  = comps.find(c => c.homeAway === 'home') || comps[0] || {};
  const away  = comps.find(c => c.homeAway === 'away') || comps[1] || {};
  const status = comp.status || {};
  return {
    id: event.id, name: event.name, shortName: event.shortName, date: event.date,
    displayDate: toDisplayDate(event.date), displayTime: toDisplayTime(event.date),
    completed: status.type?.completed || false,
    inProgress: status.type?.state === 'in',
    statusText: status.type?.shortDetail || status.type?.description || '',
    period: status.period || 0, clock: status.displayClock || '',
    home: {
      id: home.team?.id || home.id, name: home.team?.displayName || '',
      abbr: home.team?.abbreviation || '', color: home.team?.color ? `#${home.team.color}` : '#1a3a6a',
      score: home.score !== undefined ? +home.score : null,
      winner: home.winner || false, record: home.records?.[0]?.summary || '',
    },
    away: {
      id: away.team?.id || away.id, name: away.team?.displayName || '',
      abbr: away.team?.abbreviation || '', color: away.team?.color ? `#${away.team.color}` : '#1a3a6a',
      score: away.score !== undefined ? +away.score : null,
      winner: away.winner || false, record: away.records?.[0]?.summary || '',
    },
  };
}

export function parseGameDetail(json) {
  const boxscore = json.boxscore || {};
  const header   = json.header  || {};
  const comps    = header.competitions?.[0]?.competitors || [];
  const homeComp = comps.find(c => c.homeAway === 'home') || {};
  const awayComp = comps.find(c => c.homeAway === 'away') || {};

  const teams = (boxscore.players || []).map(teamData => {
    const teamInfo = teamData.team || {};
    const stats    = teamData.statistics || [];
    const labels   = stats[0]?.labels || [];
    const players  = (stats[0]?.athletes || []).map(a => {
      const vals = a.stats || [];
      const get  = key => { const i = labels.indexOf(key); return i >= 0 ? vals[i] : '--'; };
      const athleteId = a.athlete?.id;
      return {
        id: athleteId, name: a.athlete?.displayName || a.athlete?.shortName || '',
        jersey: a.athlete?.jersey || '', position: a.athlete?.position?.abbreviation || '',
        starter: a.starter || false, active: a.active !== false, dnp: a.didNotPlay || false,
        headshot: athleteId ? `https://a.espncdn.com/i/headshots/nba/players/full/${athleteId}.png` : null,
        min: get('MIN'), pts: get('PTS'), reb: get('REB'), ast: get('AST'),
        stl: get('STL'), blk: get('BLK'), to: get('TO'), fg: get('FG'),
        fg3: get('3PT'), ft: get('FT'), pm: get('+/-'),
      };
    });
    return {
      id: teamInfo.id, name: teamInfo.displayName, abbr: teamInfo.abbreviation,
      color: teamInfo.color ? `#${teamInfo.color}` : '#1a3a6a',
      homeAway: teamData.homeAway, players,
    };
  });

  const leadersByCategory = {};
  (json.leaders || []).forEach(teamBlock => {
    const teamAbb = teamBlock.team?.abbreviation || '';
    (teamBlock.leaders || []).forEach(cat => {
      const key = cat.name || cat.displayName || '';
      if (!leadersByCategory[key]) {
        leadersByCategory[key] = { name: cat.name, displayName: cat.displayName, entries: [] };
      }
      const top = cat.leaders?.[0];
      if (top) {
        leadersByCategory[key].entries.push({
          team: teamAbb, athlete: top.athlete?.displayName || top.athlete?.shortName || '',
          athleteId: top.athlete?.id || null,
          headshot: top.athlete?.headshot?.href || (top.athlete?.id ? `https://a.espncdn.com/i/headshots/nba/players/full/${top.athlete.id}.png` : ''),
          displayValue: top.displayValue || '—',
        });
      }
    });
  });
  const leaders = Object.values(leadersByCategory);

  const comp       = header.competitions?.[0] || {};
  const statusType = comp.status?.type || {};
  const completed  = statusType.completed || false;
  const inProgress = statusType.id === '2' || statusType.name === 'STATUS_IN_PROGRESS';
  const gameInfo = {
    id: comp.id, completed, inProgress,
    statusText: statusType.shortDetail || statusType.description || '',
    displayTime: comp.date,
    home: {
      id: homeComp.team?.id, name: homeComp.team?.displayName || '',
      abbr: homeComp.team?.abbreviation || '',
      score: homeComp.score != null ? Number(homeComp.score) : null,
      record: homeComp.records?.[0]?.summary || '',
    },
    away: {
      id: awayComp.team?.id, name: awayComp.team?.displayName || '',
      abbr: awayComp.team?.abbreviation || '',
      score: awayComp.score != null ? Number(awayComp.score) : null,
      record: awayComp.records?.[0]?.summary || '',
    },
  };
  return { teams, leaders, gameInfo };
}

/* ---------- Calendar util ---------- */
export function monthCalendarDays() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const past = [];
  for (let i = 14; i >= 1; i--) {
    const d = new Date(today); d.setDate(today.getDate() - i); past.push(d);
  }
  const future = [];
  const year  = today.getFullYear();
  const month = today.getMonth();
  const lastDay = new Date(year, month + 1, 0).getDate();
  for (let day = today.getDate(); day <= lastDay; day++) {
    future.push(new Date(year, month, day));
  }
  return [...past, ...future];
}

export function scoreColor(score) {
  const s = parseFloat(score);
  if (isNaN(s)) return '';
  if (s >= 9) return 'score--elite';
  if (s >= 8) return 'score--great';
  if (s >= 7) return 'score--good';
  if (s >= 6) return 'score--avg';
  return 'score--low';
}
