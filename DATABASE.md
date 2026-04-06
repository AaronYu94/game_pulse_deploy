# Game Pulse — Database Schema

Database: `score_nba` (PostgreSQL)
Connection: `postgresql://postgres:<password>@localhost/score_nba`

---

## Design Principles

- **String IDs for user-generated content** (`forum_topics`, `forum_posts`, `comments`): generated client-side as `t_` + timestamp36 + random, avoiding serial collisions and allowing offline creation.
- **Integer serial IDs** for system tables (`users`, `bets`, `game_ratings`, etc.).
- **Junction tables for reactions** (`forum_post_likes`, `forum_post_dislikes`, `comment_likes`): composite primary key `(user_id, post_id)` enforces one vote per user, `ON CONFLICT DO NOTHING` handles idempotent toggles.
- **Like/dislike mutual exclusion** enforced at the application layer (route deletes the opposing row on insert).
- **`last_reply_at` not stored** — topic list sorting uses `created_at`; can be added later as a denormalized column if performance demands it.

---

## Tables

### `users`
Core user account.

| Column | Type | Default | Notes |
|--------|------|---------|-------|
| `id` | serial PK | auto | |
| `username` | varchar | — | UNIQUE |
| `email` | varchar | — | UNIQUE |
| `password_hash` | text | null | null for OAuth-only accounts |
| `coins` | integer | 200 | Score Coins balance |
| `bio` | text | null | profile bio |
| `equipped_title_id` | integer | null | FK → `shop_items.id` |
| `created_at` | timestamptz | now() | |

---

### `user_oauth`
OAuth provider links (Google, Discord, etc.).

| Column | Type | Notes |
|--------|------|-------|
| `id` | serial PK | |
| `user_id` | integer | FK → `users.id` |
| `provider` | varchar | e.g. `'google'`, `'discord'` |
| `provider_id` | varchar | provider's user ID |
| `created_at` | timestamptz | |

UNIQUE: `(provider, provider_id)`

---

### `bets`
Score Coin prediction bets on games.

| Column | Type | Notes |
|--------|------|-------|
| `id` | serial PK | |
| `user_id` | integer | FK → `users.id` |
| `game_id` | varchar | ESPN game ID |
| `pick` | varchar | team abbreviation picked to win |
| `amount` | integer | coins wagered |
| `home_abbr` | varchar | home team abbr at bet time |
| `away_abbr` | varchar | away team abbr at bet time |
| `settled` | boolean | false = pending |
| `won` | boolean | null until settled |
| `placed_at` | timestamptz | |

---

### `comments`
Game-page comments (not forum posts).

| Column | Type | Notes |
|--------|------|-------|
| `id` | varchar PK | client-generated |
| `user_id` | integer | FK → `users.id` |
| `game_id` | varchar | ESPN game ID |
| `player_id` | varchar | null unless player-specific comment |
| `author_name` | varchar | denormalized username |
| `content` | text | |
| `pick` | varchar | optional pick badge |
| `created_at` | timestamptz | |

### `comment_likes`
Junction table for comment reactions.

| Column | Type |
|--------|------|
| `user_id` | integer |
| `comment_id` | varchar |

PK: `(user_id, comment_id)`

---

### `daily_tasks`
Tracks daily task completion per user.

| Column | Type | Default |
|--------|------|---------|
| `id` | serial PK | |
| `user_id` | integer | FK → `users.id` |
| `task_date` | date | — |
| `login_done` | boolean | false |
| `share_done` | boolean | false |
| `rating_done` | boolean | false |
| `comment_done` | boolean | false |

UNIQUE: `(user_id, task_date)`

---

### `forum_topics`
Forum thread headers.

| Column | Type | Default | Notes |
|--------|------|---------|-------|
| `id` | varchar PK | — | `t_` + timestamp36 + random |
| `user_id` | integer | — | FK → `users.id` |
| `title` | varchar | — | max 80 chars |
| `body` | text | — | |
| `author_name` | varchar | — | denormalized |
| `game_id` | varchar | null | optional game link |
| `category` | varchar | `'general'` | `game` / `player` / `trade` / `chat` / `totd` |
| `views` | integer | 0 | incremented on GET |
| `created_at` | timestamptz | now() | |

**Valid categories:** `game`, `player`, `trade`, `chat`, `totd`
**Topic of the Day** topics use prefix `[Topic of the Day]` in title and category `totd`. Their ID is cached in localStorage as `totd_YYYY-MM-DD`.

---

### `forum_posts`
Individual replies inside a topic.

| Column | Type | Notes |
|--------|------|-------|
| `id` | varchar PK | `p_` + timestamp36 + random |
| `user_id` | integer | FK → `users.id` |
| `topic_id` | varchar | FK → `forum_topics.id` |
| `author_name` | varchar | denormalized |
| `content` | text | |
| `quote_author` | varchar | null — for future quote-reply feature |
| `quote_text` | text | null |
| `created_at` | timestamptz | |

### `forum_post_likes`
Upvotes on forum replies.

| Column | Type |
|--------|------|
| `user_id` | integer |
| `post_id` | varchar |

PK: `(user_id, post_id)`
Toggled via `POST /api/forum/replies/:id/like`. On insert, the corresponding dislike row is deleted (mutual exclusion).

### `forum_post_dislikes`
Downvotes on forum replies.

| Column | Type |
|--------|------|
| `user_id` | integer |
| `post_id` | text |

PK: `(user_id, post_id)`
Created manually via:
```sql
CREATE TABLE IF NOT EXISTS forum_post_dislikes (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  post_id TEXT    NOT NULL REFERENCES forum_posts(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, post_id)
);
```
Toggled via `POST /api/forum/replies/:id/dislike`. On insert, the corresponding like row is deleted (mutual exclusion).

---

### `game_chats`
Live in-game chat messages.

| Column | Type | Notes |
|--------|------|-------|
| `id` | serial PK | |
| `game_id` | varchar | ESPN game ID |
| `user_id` | integer | FK → `users.id` |
| `username` | varchar | denormalized |
| `content` | text | |
| `created_at` | timestamptz | |

---

### `game_ratings`
Fan star ratings for games (1–5).

| Column | Type |
|--------|------|
| `id` | serial PK |
| `user_id` | integer |
| `game_id` | varchar |
| `score` | integer |
| `created_at` | timestamptz |

UNIQUE: `(user_id, game_id)` — one rating per user per game.

### `player_ratings`
Fan star ratings for individual player performances.

| Column | Type |
|--------|------|
| `id` | serial PK |
| `user_id` | integer |
| `game_id` | varchar |
| `player_id` | varchar |
| `score` | integer |
| `created_at` | timestamptz |

### `ref_ratings`
Fan verdict on referee performance per game.

| Column | Type | Notes |
|--------|------|-------|
| `id` | serial PK | |
| `user_id` | integer | |
| `game_id` | varchar | |
| `verdict` | varchar | e.g. `'good'` / `'bad'` |
| `created_at` | timestamptz | |

---

### `shop_items`
Purchasable items (titles, frames, etc.).

| Column | Type | Default |
|--------|------|---------|
| `id` | serial PK | |
| `type` | text | e.g. `'title'`, `'frame'` |
| `name` | text | |
| `description` | text | |
| `emoji` | text | |
| `price` | integer | 100 |

### `user_items`
Items owned by a user (purchased from shop).

| Column | Type | Default |
|--------|------|---------|
| `user_id` | integer | FK → `users.id` |
| `item_id` | integer | FK → `shop_items.id` |
| `quantity` | integer | 1 |

PK: `(user_id, item_id)`

---

## Key Query Patterns

**Get topic with like/dislike counts per post:**
```sql
SELECT p.*,
  COUNT(DISTINCT pl.user_id)::int  AS likes,
  BOOL_OR(pl.user_id = $2)        AS liked_by_me,
  COUNT(DISTINCT pd.user_id)::int  AS dislikes,
  BOOL_OR(pd.user_id = $2)        AS disliked_by_me
FROM forum_posts p
LEFT JOIN forum_post_likes    pl ON pl.post_id = p.id
LEFT JOIN forum_post_dislikes pd ON pd.post_id = p.id
WHERE p.topic_id = $1
GROUP BY p.id
ORDER BY p.created_at ASC
```

**Toggle like (mutual exclusion pattern):**
```sql
-- Try insert
INSERT INTO forum_post_likes (user_id, post_id) VALUES ($1, $2) ON CONFLICT DO NOTHING RETURNING 1;
-- If inserted → delete dislike
DELETE FROM forum_post_dislikes WHERE user_id = $1 AND post_id = $2;
-- If not inserted (already liked) → delete like (toggle off)
DELETE FROM forum_post_likes WHERE user_id = $1 AND post_id = $2;
```
