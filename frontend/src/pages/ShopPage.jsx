import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../components/Header.jsx';
import { apiGetShop, apiBuyItem, apiEquipTitle, apiUnequipTitle } from '../lib/api.js';

export default function ShopPage() {
  const navigate = useNavigate();
  const [items, setItems]           = useState([]);
  const [coins, setCoins]           = useState(null);
  const [equippedId, setEquippedId] = useState(null);
  const [loading, setLoading]       = useState(true);
  const [busy, setBusy]             = useState(null); // itemId in progress
  const [toast, setToast]           = useState(null);
  const [tab, setTab]               = useState('stickers');

  useEffect(() => {
    apiGetShop()
      .then(d => {
        setItems(d.items);
        setCoins(d.coins);
        setEquippedId(d.equippedTitleId);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  function showToast(msg, type = 'ok') {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2500);
  }

  async function buy(item) {
    if (busy) return;
    setBusy(item.id);
    try {
      const res = await apiBuyItem(item.id);
      setCoins(res.coins);
      setItems(prev => prev.map(i => i.id === item.id ? { ...i, owned: (i.owned || 0) + 1 } : i));
      showToast(`Got ${item.emoji} ${item.name}!  SC −${item.price}`);
    } catch (err) {
      showToast(err.message, 'err');
    }
    setBusy(null);
  }

  async function equip(item) {
    if (busy) return;
    setBusy(item.id);
    try {
      if (equippedId === item.id) {
        await apiUnequipTitle();
        setEquippedId(null);
        showToast('Title removed');
      } else {
        await apiEquipTitle(item.id);
        setEquippedId(item.id);
        showToast(`${item.emoji} ${item.name} equipped!`);
      }
    } catch (err) {
      showToast(err.message, 'err');
    }
    setBusy(null);
  }

  const stickers = items.filter(i => i.type === 'sticker');
  const titles   = items.filter(i => i.type === 'title');
  const equippedTitle = titles.find(t => t.id === equippedId);

  return (
    <div className="page">
      <Header />

      <div style={{ marginBottom: '1rem' }}>
        <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.85rem', padding: '0.5rem 0', fontFamily: 'inherit' }}>
          ← Back
        </button>
      </div>

      {/* Page header */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', marginBottom: '2rem' }}>
        <div>
          <div style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--accent)', marginBottom: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ display: 'inline-block', width: 18, height: 2, background: 'var(--accent)', borderRadius: 1 }} />
            Score Coin Store
          </div>
          <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 'clamp(2.2rem, 5vw, 3.5rem)', letterSpacing: '0.06em', lineHeight: 1, marginBottom: '0.3rem' }}>
            Coin <span style={{ background: 'linear-gradient(135deg, var(--accent), var(--accent-2))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>Shop</span>
          </h1>
          <p style={{ color: 'var(--text-sub)', fontSize: '0.88rem' }}>
            Stickers for Live Chat · Titles to show off your loyalty
          </p>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontFamily: "'Bebas Neue',sans-serif", fontSize: '1.8rem', color: 'var(--accent-2)' }}>
            SC {coins ?? '…'}
          </div>
          {equippedTitle && (
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
              Wearing: <span style={{ color: 'var(--accent)', fontWeight: 700 }}>{equippedTitle.emoji} {equippedTitle.name}</span>
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', marginBottom: '1.75rem' }}>
        {[['stickers', '🎯 Stickers', stickers.length], ['titles', '🏅 Titles', titles.length]].map(([key, label, count]) => (
          <button key={key} onClick={() => setTab(key)} style={{ padding: '0.7rem 1.2rem', background: 'none', border: 'none', borderBottom: `2px solid ${tab === key ? 'var(--accent)' : 'transparent'}`, fontFamily: 'inherit', fontSize: '0.85rem', fontWeight: 700, color: tab === key ? 'var(--accent)' : 'var(--text-muted)', cursor: 'pointer', marginBottom: -1, transition: 'color .15s' }}>
            {label} <span style={{ fontSize: '0.7rem', opacity: 0.6 }}>({count})</span>
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
          <div style={{ display: 'inline-block', width: 28, height: 28, border: '2px solid var(--border)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin .7s linear infinite' }} />
        </div>
      ) : tab === 'stickers' ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '0.85rem' }}>
          {stickers.map(item => (
            <div key={item.id} className="card" style={{ padding: '1.25rem 1rem', textAlign: 'center', position: 'relative', overflow: 'hidden', borderColor: item.owned > 0 ? 'rgba(255,107,43,.25)' : undefined }}>
              {item.owned > 0 && <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: 'linear-gradient(90deg, var(--accent), var(--accent-2))' }} />}
              <div style={{ fontSize: '2.8rem', lineHeight: 1, marginBottom: '0.6rem' }}>{item.emoji}</div>
              <div style={{ fontWeight: 700, fontSize: '0.85rem', marginBottom: '0.65rem' }}>{item.name}</div>
              {item.owned > 0 && (
                <div style={{ fontSize: '0.62rem', color: 'var(--accent)', fontWeight: 700, textTransform: 'uppercase', marginBottom: '0.4rem' }}>Own {item.owned}</div>
              )}
              <button
                onClick={() => buy(item)}
                disabled={!!busy || coins < item.price}
                style={{ width: '100%', padding: '0.38rem', borderRadius: 'var(--radius-pill)', border: 'none', background: coins >= item.price ? 'linear-gradient(90deg, var(--accent), var(--accent-2))' : 'var(--bg-surface)', color: coins >= item.price ? '#fff' : 'var(--text-muted)', border: coins >= item.price ? 'none' : '1px solid var(--border)', fontFamily: "'Bebas Neue',sans-serif", fontSize: '0.95rem', letterSpacing: '0.06em', cursor: coins >= item.price && !busy ? 'pointer' : 'not-allowed', opacity: busy === item.id ? 0.5 : 1 }}
              >
                {busy === item.id ? '…' : `SC ${item.price}`}
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {titles.map(item => {
            const owned = item.owned > 0;
            const isEquipped = item.id === equippedId;
            return (
              <div key={item.id} className="card" style={{ padding: '1.1rem 1.4rem', display: 'flex', alignItems: 'center', gap: '1.1rem', flexWrap: 'wrap', position: 'relative', overflow: 'hidden', borderColor: isEquipped ? 'rgba(255,107,43,.4)' : owned ? 'rgba(255,107,43,.15)' : undefined }}>
                {isEquipped && <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: 'linear-gradient(90deg, var(--accent), var(--accent-2))' }} />}

                {/* Emoji badge */}
                <div style={{ width: 48, height: 48, borderRadius: 'var(--radius-md)', background: isEquipped ? 'var(--accent-glow)' : 'var(--bg-surface)', border: `1px solid ${isEquipped ? 'rgba(255,107,43,.3)' : 'var(--border)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.6rem', flexShrink: 0 }}>
                  {item.emoji}
                </div>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.15rem' }}>
                    <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>{item.name}</span>
                    {isEquipped && <span style={{ fontSize: '0.62rem', fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.07em', background: 'var(--accent-glow)', padding: '0.1rem 0.45rem', borderRadius: 'var(--radius-pill)' }}>Equipped</span>}
                    {owned && !isEquipped && <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Owned</span>}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{item.description}</div>
                </div>

                {/* Price / action */}
                <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.35rem' }}>
                  {owned ? (
                    <button
                      onClick={() => equip(item)}
                      disabled={!!busy}
                      style={{ padding: '0.35rem 0.9rem', borderRadius: 'var(--radius-pill)', border: `1px solid ${isEquipped ? 'var(--heat)' : 'var(--accent)'}`, background: isEquipped ? 'rgba(239,68,68,.08)' : 'var(--accent-glow)', color: isEquipped ? 'var(--heat)' : 'var(--accent)', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', opacity: busy === item.id ? 0.5 : 1 }}
                    >
                      {busy === item.id ? '…' : isEquipped ? 'Unequip' : 'Equip'}
                    </button>
                  ) : (
                    <button
                      onClick={() => buy(item)}
                      disabled={!!busy || coins < item.price}
                      style={{ padding: '0.35rem 0.9rem', borderRadius: 'var(--radius-pill)', border: 'none', background: coins >= item.price ? 'linear-gradient(90deg, var(--accent), var(--accent-2))' : 'var(--bg-surface)', color: coins >= item.price ? '#fff' : 'var(--text-muted)', border: coins >= item.price ? 'none' : '1px solid var(--border)', fontFamily: "'Bebas Neue',sans-serif", fontSize: '1rem', letterSpacing: '0.05em', cursor: coins >= item.price && !busy ? 'pointer' : 'not-allowed', opacity: busy === item.id ? 0.5 : 1 }}
                    >
                      {busy === item.id ? '…' : `SC ${item.price}`}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <footer className="site-footer" style={{ marginTop: '3rem' }}>
        SCORE · NBA · Score Coin is virtual currency with no real-world value
      </footer>

      {toast && (
        <div style={{ position: 'fixed', bottom: '2rem', right: '1.5rem', zIndex: 300, background: toast.type === 'err' ? 'var(--heat)' : 'linear-gradient(135deg, var(--accent), var(--accent-2))', color: '#fff', fontWeight: 700, fontSize: '0.88rem', padding: '0.5rem 1.1rem', borderRadius: 'var(--radius-pill)', boxShadow: '0 4px 16px rgba(0,0,0,.25)', pointerEvents: 'none' }}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}
