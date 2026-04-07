import { useState, useEffect, useCallback } from 'react';
import Header, { SideNav } from '../components/Header.jsx';
import {
  apiGetShop, apiBuyItem, apiEquipTitle, apiUnequipTitle,
  apiGetInventory, apiGetCoins, DAILY_TASK_DEFS,
} from '../lib/api.js';
import {
  CHAT_FRAMES, getEquippedFrame, setEquippedFrame, getFrameById,
} from '../lib/espn.js';

const SHOP_TABS = [
  { key: 'all', label: 'All Items' },
  { key: 'title', label: 'Titles' },
  { key: 'sticker', label: 'Stickers' },
  { key: 'chatframe', label: 'Chat Frames' },
];

export default function ShopPage() {
  const [shopTab, setShopTab] = useState('all');
  const [shopItems, setShopItems] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [coins, setCoins] = useState(null);
  const [tasks, setTasks] = useState({});
  const [loading, setLoading] = useState(true);
  const [equippedTitleId, setEquippedTitleId] = useState(null);
  const [equippedFrameId, setEquippedFrameId] = useState(getEquippedFrame());
  const [toast, setToast] = useState('');

  const showToast = useCallback((msg) => {
    setToast(msg); setTimeout(() => setToast(''), 2200);
  }, []);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [shopData, invData, coinData] = await Promise.all([
          apiGetShop(),
          apiGetInventory(),
          apiGetCoins(),
        ]);
        setShopItems(shopData.items || []);
        setInventory(invData.items || []);
        setCoins(coinData.coins ?? 0);
        setTasks(coinData.tasks || {});
        // Find equipped title from inventory
        const equippedTitle = (invData.items || []).find(i => i.equipped && i.type === 'title');
        if (equippedTitle) setEquippedTitleId(equippedTitle.id);
      } catch (err) { console.error(err); }
      finally { setLoading(false); }
    }
    load();
  }, []);

  async function handleBuy(itemId) {
    try {
      const res = await apiBuyItem(itemId);
      showToast('Item purchased!');
      setCoins(res.coins ?? coins);
      // Refresh inventory
      const invData = await apiGetInventory();
      setInventory(invData.items || []);
    } catch (err) { showToast(err.message); }
  }

  async function handleEquipTitle(itemId) {
    try {
      await apiEquipTitle(itemId);
      setEquippedTitleId(itemId);
      showToast('Title equipped!');
    } catch (err) { showToast(err.message); }
  }

  async function handleUnequipTitle() {
    try {
      await apiUnequipTitle();
      setEquippedTitleId(null);
      showToast('Title unequipped.');
    } catch (err) { showToast(err.message); }
  }

  function handleEquipFrame(frameId) {
    const newId = equippedFrameId === frameId ? null : frameId;
    setEquippedFrame(newId);
    setEquippedFrameId(newId);
    showToast(newId ? 'Chat frame equipped!' : 'Chat frame removed.');
  }

  const ownedIds = new Set(inventory.map(i => i.item_id || i.id));
  const equippedFrame = equippedFrameId ? getFrameById(equippedFrameId) : null;
  const equippedTitleItem = inventory.find(i => i.id === equippedTitleId || i.item_id === equippedTitleId);

  // Filter shop items
  const displayItems = shopTab === 'all' ? shopItems
    : shopTab === 'chatframe' ? [] // chat frames are in CHAT_FRAMES
    : shopItems.filter(i => i.type === shopTab);

  return (
    <div className="app-container">
      <Header searchPlaceholder="Search items..." />
      <SideNav />

      {/* Panel Matches: Coin + Tasks */}
      <aside className="panel-matches">
        <div className="panel-header"><h3>SCORE COIN</h3></div>
        <div className="coin-widget">
          <div className="coin-widget__dots"></div>
          <div className="coin-widget__amount">
            <span className="coin-widget__symbol">SC</span>
            <span className="coin-widget__num">{coins !== null ? coins.toLocaleString() : '—'}</span>
          </div>
          <div className="coin-widget__sub">Spend coins in the shop</div>
        </div>

        <div className="panel-header" style={{ marginTop: 8 }}><h3>DAILY TASKS</h3></div>
        <div>
          {DAILY_TASK_DEFS.map(t => (
            <div key={t.key} className={`rp-task-row${tasks[t.key + '_done'] ? ' done' : ''}`} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', borderBottom: '1px dashed var(--border)', fontSize: 12 }}>
              <span className="rp-task-icon">{t.icon}</span>
              <span className="rp-task-label" style={{ flex: 1, color: 'var(--text-sub)' }}>{t.label}</span>
              <span className={`rp-task-reward${tasks[t.key + '_done'] ? ' done' : ''}`} style={{ fontWeight: 700, color: tasks[t.key + '_done'] ? 'var(--success)' : 'var(--accent-2)', fontFamily: 'var(--f-display)', fontSize: 14 }}>
                {tasks[t.key + '_done'] ? '✓' : `+${t.reward}`}
              </span>
            </div>
          ))}
        </div>

        <div className="panel-header" style={{ marginTop: 8 }}><h3>HOW TO EARN</h3></div>
        <div style={{ padding: '8px 16px', display: 'flex', flexDirection: 'column', gap: 4 }}>
          {[['Daily Login', 20], ['Rate a Player', 10], ['Post Comment', 15], ['Share a Game', 50]].map(([l, v]) => (
            <div key={l} style={{ fontSize: 12, color: 'var(--text-sub)', display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid var(--border)' }}>
              <span>{l}</span>
              <span style={{ color: 'var(--accent-2)', fontWeight: 700 }}>+{v} SC</span>
            </div>
          ))}
        </div>
      </aside>

      {/* Main Stage */}
      <main className="main-stage">
        <div className="shop-hero">
          <div style={{ fontSize: 13, color: 'var(--accent)', fontStyle: 'italic', marginBottom: 6, letterSpacing: '.04em' }}>SCORE COIN STORE</div>
          <div className="shop-hero__title">FAN SHOP</div>
          <div className="shop-hero__sub">Spend your Score Coins on exclusive titles, stickers, and chat frames.</div>
          <div className="shop-hero__balance">
            <span className="shop-hero__balance-label">Your Balance</span>
            <span className="shop-hero__balance-sym">SC</span>
            <span className="shop-hero__balance-num">{coins !== null ? coins.toLocaleString() : '—'}</span>
          </div>
        </div>

        {/* Tabs */}
        <div className="shop-tabs">
          {SHOP_TABS.map(t => (
            <div
              key={t.key}
              className={`shop-tab${shopTab === t.key ? ' active' : ''}`}
              onClick={() => setShopTab(t.key)}
            >
              {t.label.toUpperCase()}
            </div>
          ))}
        </div>

        {loading ? (
          <div className="loading"><div className="loading__spinner" /><br />Loading shop…</div>
        ) : (
          <>
            {/* Shop items (titles, stickers) */}
            {(shopTab !== 'chatframe') && (
              <div className="item-grid">
                {displayItems.length === 0 ? (
                  <div className="empty" style={{ gridColumn: '1/-1' }}>No items in this category.</div>
                ) : displayItems.map(item => {
                  const owned = ownedIds.has(item.id);
                  const isEquipped = item.type === 'title' && equippedTitleId === item.id;
                  return (
                    <div key={item.id} className="item-card">
                      {owned && !isEquipped && <span className="item-card__owned-badge">Owned</span>}
                      {isEquipped && <span className="item-card__equipped-badge">Equipped</span>}
                      <div className="item-card__icon">{item.icon || '🎖️'}</div>
                      <div className="item-card__name">{item.name}</div>
                      <div className="item-card__desc">{item.description}</div>
                      <div style={{ marginBottom: 4 }}>
                        <span className={`item-type-badge${item.type === 'title' ? ' item-type-badge--title' : item.type === 'sticker' ? ' item-type-badge--sticker' : ''}`}>{item.type}</span>
                      </div>
                      <div className="item-card__footer">
                        <span>
                          <span className="item-card__price-sym">SC</span>
                          {' '}
                          <span className="item-card__price">{item.price}</span>
                        </span>
                        {!owned ? (
                          <button className="buy-btn" onClick={() => handleBuy(item.id)} disabled={coins < item.price}>
                            Buy
                          </button>
                        ) : item.type === 'title' ? (
                          isEquipped ? (
                            <button className="unequip-btn" onClick={handleUnequipTitle}>Unequip</button>
                          ) : (
                            <button className="equip-btn" onClick={() => handleEquipTitle(item.id)}>Equip</button>
                          )
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Chat Frames */}
            {(shopTab === 'chatframe' || shopTab === 'all') && (
              <>
                <div className="sub-label" style={{ marginTop: shopTab === 'all' ? 24 : 0 }}>Chat Frames — Free</div>
                <div className="frame-grid">
                  {CHAT_FRAMES.map(frame => {
                    const isEquipped = equippedFrameId === frame.id;
                    return (
                      <div key={frame.id} className={`frame-card${isEquipped ? ' frame-card--equipped' : ''}`}>
                        {isEquipped && <div className="frame-card__equipped-badge">Equipped</div>}
                        <div className="frame-preview">
                          <div
                            className="frame-preview__bubble"
                            style={{ borderLeft: `3px solid ${frame.bg}`, background: `${frame.bg}22` }}
                          >
                            <div
                              className="frame-preview__badge"
                              style={{ background: frame.bg, color: frame.text }}
                            >{frame.abbr}</div>
                            <div className="frame-preview__line" />
                            <div className="frame-preview__line frame-preview__line--short" />
                          </div>
                        </div>
                        <div className="frame-card__name">{frame.name}</div>
                        <button
                          className={`frame-equip-btn${isEquipped ? ' frame-equip-btn--active' : ''}`}
                          onClick={() => handleEquipFrame(frame.id)}
                        >
                          {isEquipped ? 'Unequip' : 'Equip'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </>
        )}
      </main>

      {/* Panel Social: Inventory */}
      <aside className="panel-social">
        <div className="rp-section">
          <div className="rp-head">Your Inventory</div>
          {inventory.length === 0 ? (
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>No items yet. Visit the shop!</div>
          ) : (
            inventory.map(item => (
              <div key={item.id} className="inv-item">
                <div className="inv-item__icon">{item.icon || '🎖️'}</div>
                <div className="inv-item__info">
                  <div className="inv-item__name">{item.name}</div>
                  <div className="inv-item__qty">{item.type}</div>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="rp-section">
          <div className="rp-head">Equipped Title</div>
          {equippedTitleItem ? (
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent)' }}>{equippedTitleItem.name}</div>
          ) : (
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>None equipped</div>
          )}
        </div>

        <div className="rp-section">
          <div className="rp-head">Chat Frame</div>
          {equippedFrame ? (
            <div className="rp-frame-preview">
              <div
                className="rp-frame-badge"
                style={{ background: equippedFrame.bg, color: equippedFrame.text }}
              >{equippedFrame.abbr}</div>
              <span style={{ fontSize: 13, color: 'var(--text-sub)' }}>{equippedFrame.name}</span>
            </div>
          ) : (
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>None equipped</div>
          )}
        </div>
      </aside>

      {toast && <div className="coin-toast">{toast}</div>}
    </div>
  );
}
