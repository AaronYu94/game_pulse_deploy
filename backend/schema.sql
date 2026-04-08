-- SCORE NBA Database Schema

CREATE TABLE IF NOT EXISTS users (
  id                SERIAL PRIMARY KEY,
  username          VARCHAR(30)  UNIQUE NOT NULL,
  email             VARCHAR(255) UNIQUE NOT NULL,
  password_hash     TEXT,
  coins             INTEGER      NOT NULL DEFAULT 200,
  bio               TEXT,
  equipped_title_id INTEGER,
  created_at        TIMESTAMPTZ  DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS daily_tasks (
  id           SERIAL PRIMARY KEY,
  user_id      INTEGER REFERENCES users(id) ON DELETE CASCADE,
  task_date    DATE    NOT NULL,
  login_done   BOOLEAN DEFAULT FALSE,
  share_done   BOOLEAN DEFAULT FALSE,
  rating_done  BOOLEAN DEFAULT FALSE,
  comment_done BOOLEAN DEFAULT FALSE,
  UNIQUE(user_id, task_date)
);

CREATE TABLE IF NOT EXISTS bets (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER REFERENCES users(id) ON DELETE CASCADE,
  game_id    VARCHAR(50) NOT NULL,
  pick       VARCHAR(10) NOT NULL CHECK (pick IN ('home', 'away')),
  amount     INTEGER     NOT NULL CHECK (amount >= 1),
  home_abbr  VARCHAR(10),
  away_abbr  VARCHAR(10),
  settled    BOOLEAN     DEFAULT FALSE,
  won        BOOLEAN,
  placed_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, game_id)
);

CREATE TABLE IF NOT EXISTS game_ratings (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER REFERENCES users(id) ON DELETE CASCADE,
  game_id    VARCHAR(50) NOT NULL,
  score      INTEGER     NOT NULL CHECK (score BETWEEN 1 AND 10),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, game_id)
);

CREATE TABLE IF NOT EXISTS ref_ratings (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER REFERENCES users(id) ON DELETE CASCADE,
  game_id    VARCHAR(50) NOT NULL,
  verdict    VARCHAR(10) NOT NULL CHECK (verdict IN ('good', 'ok', 'bad')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, game_id)
);

CREATE TABLE IF NOT EXISTS comments (
  id          VARCHAR(50) PRIMARY KEY,
  user_id     INTEGER REFERENCES users(id) ON DELETE CASCADE,
  game_id     VARCHAR(50) NOT NULL,
  player_id   VARCHAR(50),
  author_name VARCHAR(50),
  content     TEXT NOT NULL,
  pick        VARCHAR(10) CHECK (pick IN ('home', 'away')),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS comment_likes (
  user_id    INTEGER     REFERENCES users(id)    ON DELETE CASCADE,
  comment_id VARCHAR(50) REFERENCES comments(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, comment_id)
);

CREATE TABLE IF NOT EXISTS forum_topics (
  id          VARCHAR(50) PRIMARY KEY,
  user_id     INTEGER REFERENCES users(id) ON DELETE CASCADE,
  title       VARCHAR(80) NOT NULL,
  body        TEXT        NOT NULL,
  author_name VARCHAR(50),
  game_id     VARCHAR(50),
  category    VARCHAR(30) DEFAULT 'general',
  views       INTEGER     DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS forum_posts (
  id           VARCHAR(50) PRIMARY KEY,
  user_id      INTEGER     REFERENCES users(id)        ON DELETE CASCADE,
  topic_id     VARCHAR(50) REFERENCES forum_topics(id) ON DELETE CASCADE,
  author_name  VARCHAR(50),
  content      TEXT NOT NULL,
  quote_author VARCHAR(50),
  quote_text   TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS forum_post_likes (
  user_id INTEGER     REFERENCES users(id)       ON DELETE CASCADE,
  post_id VARCHAR(50) REFERENCES forum_posts(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, post_id)
);

CREATE TABLE IF NOT EXISTS forum_post_dislikes (
  user_id INTEGER     REFERENCES users(id)       ON DELETE CASCADE,
  post_id VARCHAR(50) REFERENCES forum_posts(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, post_id)
);

CREATE TABLE IF NOT EXISTS player_ratings (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER REFERENCES users(id) ON DELETE CASCADE,
  game_id    VARCHAR(50) NOT NULL,
  player_id  VARCHAR(50) NOT NULL,
  score      INTEGER NOT NULL CHECK (score BETWEEN 1 AND 10),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, game_id, player_id)
);

CREATE TABLE IF NOT EXISTS user_oauth (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER      REFERENCES users(id) ON DELETE CASCADE,
  provider    VARCHAR(30)  NOT NULL,
  provider_id VARCHAR(255) NOT NULL,
  created_at  TIMESTAMPTZ  DEFAULT NOW(),
  UNIQUE(provider, provider_id)
);

CREATE TABLE IF NOT EXISTS shop_items (
  id          SERIAL PRIMARY KEY,
  type        VARCHAR(30) NOT NULL CHECK (type IN ('title', 'sticker')),
  name        VARCHAR(80) NOT NULL,
  description TEXT        NOT NULL DEFAULT '',
  emoji       TEXT,
  icon        TEXT,
  price       INTEGER     NOT NULL CHECK (price >= 0),
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(type, name)
);

CREATE TABLE IF NOT EXISTS user_items (
  user_id  INTEGER REFERENCES users(id)      ON DELETE CASCADE,
  item_id  INTEGER REFERENCES shop_items(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity >= 0),
  PRIMARY KEY (user_id, item_id)
);

CREATE TABLE IF NOT EXISTS game_chats (
  id          SERIAL PRIMARY KEY,
  game_id     VARCHAR(50) NOT NULL,
  user_id     INTEGER REFERENCES users(id) ON DELETE CASCADE,
  username    VARCHAR(30) NOT NULL,
  content     TEXT NOT NULL,
  sticker_id  INTEGER REFERENCES shop_items(id) ON DELETE SET NULL,
  title_name  VARCHAR(80),
  title_emoji TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE users ADD COLUMN IF NOT EXISTS bio TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS equipped_title_id INTEGER;
ALTER TABLE comments ADD COLUMN IF NOT EXISTS pick VARCHAR(10) CHECK (pick IN ('home', 'away'));
ALTER TABLE forum_topics ADD COLUMN IF NOT EXISTS category VARCHAR(30) DEFAULT 'general';
ALTER TABLE forum_topics ADD COLUMN IF NOT EXISTS views INTEGER DEFAULT 0;
ALTER TABLE forum_posts ADD COLUMN IF NOT EXISTS quote_author VARCHAR(50);
ALTER TABLE forum_posts ADD COLUMN IF NOT EXISTS quote_text TEXT;
ALTER TABLE game_chats ADD COLUMN IF NOT EXISTS sticker_id INTEGER;
ALTER TABLE game_chats ADD COLUMN IF NOT EXISTS title_name VARCHAR(80);
ALTER TABLE game_chats ADD COLUMN IF NOT EXISTS title_emoji TEXT;
ALTER TABLE shop_items ADD COLUMN IF NOT EXISTS icon TEXT;
ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_equipped_title_id_fkey'
  ) THEN
    ALTER TABLE users
      ADD CONSTRAINT users_equipped_title_id_fkey
      FOREIGN KEY (equipped_title_id) REFERENCES shop_items(id) ON DELETE SET NULL;
  END IF;
END $$;

INSERT INTO shop_items (type, name, description, emoji, icon, price)
VALUES
  ('title', 'Certified Bucket Getter', 'Show everyone you get buckets on and off the court.', '🏀', '🏀', 180),
  ('title', 'Clutch Time Killer', 'Reserved for fans who stay cold-blooded in crunch time.', '⌚', '⌚', 260),
  ('title', 'Tape Study Addict', 'For the fan who notices every rotation and weak-side tag.', '🎞️', '🎞️', 140),
  ('title', 'Trade Machine GM', 'Built for deadline takes and all-night roster experiments.', '📈', '📈', 220),
  ('sticker', 'Heat Check', 'Drop some fire into the live game chat.', '🔥', '🔥', 45),
  ('sticker', 'Goat Stamp', 'Respect greatness with the GOAT stamp.', '🐐', '🐐', 70),
  ('sticker', 'Brick Alert', 'For those truly painful misses.', '🧱', '🧱', 30),
  ('sticker', 'Too Small', 'Let the whole room know what just happened.', '🤏', '🤏', 40),
  ('sticker', 'Cooked Him', 'A sticker for ankle-breakers and blown coverages.', '🍳', '🍳', 55),
  ('sticker', 'Ice Veins', 'For dagger shots and late-game nerves of steel.', '🥶', '🥶', 65)
ON CONFLICT (type, name) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_bets_user_id             ON bets(user_id);
CREATE INDEX IF NOT EXISTS idx_bets_game_id             ON bets(game_id);
CREATE INDEX IF NOT EXISTS idx_comments_game_id         ON comments(game_id);
CREATE INDEX IF NOT EXISTS idx_forum_posts_topic        ON forum_posts(topic_id);
CREATE INDEX IF NOT EXISTS idx_forum_post_dislikes_post ON forum_post_dislikes(post_id);
CREATE INDEX IF NOT EXISTS idx_player_ratings_game      ON player_ratings(game_id);
CREATE INDEX IF NOT EXISTS idx_shop_items_type          ON shop_items(type);
CREATE INDEX IF NOT EXISTS idx_user_items_user_id       ON user_items(user_id);
CREATE INDEX IF NOT EXISTS idx_game_chats_game_id       ON game_chats(game_id);

CREATE TABLE IF NOT EXISTS notifications (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER REFERENCES users(id) ON DELETE CASCADE,
  type       VARCHAR(30) NOT NULL,
  title      VARCHAR(100) NOT NULL,
  body       VARCHAR(200),
  link       VARCHAR(200),
  read       BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_notif_user ON notifications(user_id, read, created_at DESC);
