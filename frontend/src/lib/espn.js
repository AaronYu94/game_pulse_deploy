const ESPN_BASE = 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba';

export function teamLogoUrl(teamId) {
  return `https://a.espncdn.com/i/teamlogos/nba/500/${teamId}.png`;
}

export function toESPNDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}${m}${d}`;
}

function toDisplayDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function toDisplayTime(dateStr) {
  return new Date(dateStr).toLocaleTimeString('en-US', {
    hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York', timeZoneName: 'short',
  });
}

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

export async function fetchTeamSeasonStats(teamId) {
  const res = await fetch(`${ESPN_BASE}/teams/${teamId}/roster`);
  if (!res.ok) throw new Error(`Roster fetch failed: ${res.status}`);
  const json = await res.json();
  return (json.athletes || []).map(a => ({
    id:       a.id,
    name:     a.displayName || a.fullName || '',
    position: a.position?.abbreviation || '',
    stats:    a.statistics?.splits?.categories?.flatMap(c => c.stats || []) || [],
  }));
}

export function getStatVal(statsArr, name) {
  const s = statsArr.find(s => s.name === name || s.abbreviation === name);
  return s ? parseFloat(s.value || 0) : null;
}

function parseGame(event) {
  const comp  = event.competitions?.[0] || {};
  const comps = comp.competitors || [];
  const home  = comps.find(c => c.homeAway === 'home') || comps[0] || {};
  const away  = comps.find(c => c.homeAway === 'away') || comps[1] || {};
  const status = comp.status || {};
  return {
    id:          event.id,
    name:        event.name,
    shortName:   event.shortName,
    date:        event.date,
    displayDate: toDisplayDate(event.date),
    displayTime: toDisplayTime(event.date),
    completed:   status.type?.completed || false,
    inProgress:  status.type?.state === 'in',
    statusText:  status.type?.shortDetail || '',
    period:      status.period || 0,
    clock:       status.displayClock || '',
    home: {
      id: home.id, name: home.team?.displayName || '', abbr: home.team?.abbreviation || '',
      color: home.team?.color ? `#${home.team.color}` : '#1a3a6a',
      score: home.score !== undefined ? +home.score : null,
      winner: home.winner || false, record: home.records?.[0]?.summary || '',
    },
    away: {
      id: away.id, name: away.team?.displayName || '', abbr: away.team?.abbreviation || '',
      color: away.team?.color ? `#${away.team.color}` : '#1a3a6a',
      score: away.score !== undefined ? +away.score : null,
      winner: away.winner || false, record: away.records?.[0]?.summary || '',
    },
  };
}

function parseGameDetail(json) {
  const boxscore = json.boxscore || {};
  const header   = json.header  || {};
  const comps    = header.competitions?.[0]?.competitors || [];

  const teams = (boxscore.players || []).map(teamData => {
    const teamInfo = teamData.team || {};
    const stats    = teamData.statistics || [];
    const labels   = stats[0]?.labels || [];
    const players  = (stats[0]?.athletes || []).map(a => {
      const vals = a.stats || [];
      const get  = key => { const i = labels.indexOf(key); return i >= 0 ? vals[i] : '--'; };
      return {
        id: a.athlete?.id, name: a.athlete?.displayName || '', jersey: a.athlete?.jersey || '',
        position: a.athlete?.position?.abbreviation || '', starter: a.starter || false,
        active: a.active !== false, dnp: a.didNotPlay || false,
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

  const leaders = (json.leaders || []).map(l => ({
    name: l.name, displayName: l.displayName,
    leaders: (l.leaders || []).map(x => ({
      displayValue: x.displayValue, athlete: x.athlete?.displayName || '', team: x.team?.abbreviation || '',
    })),
  }));

  return { teams, leaders };
}

export function monthCalendarDays() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const past = [];
  for (let i = 14; i >= 1; i--) {
    const d = new Date(today); d.setDate(today.getDate() - i); past.push(d);
  }
  const future = [];
  const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  for (let day = today.getDate(); day <= lastDay; day++) {
    future.push(new Date(today.getFullYear(), today.getMonth(), day));
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
