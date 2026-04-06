import { useState } from 'react';
import { teamLogoUrl } from '../lib/espn.js';

export default function TeamLogo({ teamId, abbr, size = 36 }) {
  const [failed, setFailed] = useState(false);

  if (!teamId || failed) {
    return (
      <div style={{
        width: size, height: size, borderRadius: '50%',
        background: 'var(--bg-surface)', border: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: "'Bebas Neue', sans-serif", fontSize: size * 0.33,
        color: 'var(--text-sub)', flexShrink: 0,
      }}>
        {abbr}
      </div>
    );
  }

  return (
    <img
      src={teamLogoUrl(teamId)}
      alt={abbr}
      onError={() => setFailed(true)}
      style={{ width: size, height: size, objectFit: 'contain', flexShrink: 0 }}
    />
  );
}
