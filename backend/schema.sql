-- SCORE NBA Database Schema

CREATE TABLE IF NOT EXISTS users (
  id           SERIAL PRIMARY KEY,
  username     VARCHAR(30)  UNIQUE NOT NULL,
  email        VARCHAR(255) UNIQUE NOT NULL,
  password_hash TEXT,
  coins        INTEGER      NOT NULL DEFAULT 200,
  created_at   TIMESTAMPTZ  DEFAULT NOW()
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
  id         VARCHAR(50) PRIMARY KEY,
  user_id    INTEGER REFERENCES users(id) ON DELETE CASCADE,
  game_id    VARCHAR(50) NOT NULL,
  player_id  VARCHAR(50),
  author_name VARCHAR(50),
  content    TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
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
  user_id      INTEGER     REFERENCES users(id)         ON DELETE CASCADE,
  topic_id     VARCHAR(50) REFERENCES forum_topics(id)  ON DELETE CASCADE,
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

CREATE TABLE IF NOT EXISTS player_ratings (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER REFERENCES users(id) ON DELETE CASCADE,
  game_id    VARCHAR(50) NOT NULL,
  player_id  VARCHAR(50) NOT NULL,
  score      INTEGER NOT NULL CHECK (score BETWEEN 1 AND 10),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, game_id, player_id)
);

-- Add pick column to comments (for predictions on future games)
ALTER TABLE comments ADD COLUMN IF NOT EXISTS pick VARCHAR(10) CHECK (pick IN ('home', 'away'));

-- Make password_hash nullable for OAuth users
ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;

-- User profile bio
ALTER TABLE users ADD COLUMN IF NOT EXISTS bio TEXT;

-- Forum enhancements
ALTER TABLE forum_topics ADD COLUMN IF NOT EXISTS category VARCHAR(30) DEFAULT 'general';
ALTER TABLE forum_topics ADD COLUMN IF NOT EXISTS views INTEGER DEFAULT 0;
ALTER TABLE forum_posts ADD COLUMN IF NOT EXISTS quote_author VARCHAR(50);
ALTER TABLE forum_posts ADD COLUMN IF NOT EXISTS quote_text TEXT;

CREATE TABLE IF NOT EXISTS user_oauth (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER      REFERENCES users(id) ON DELETE CASCADE,
  provider    VARCHAR(30)  NOT NULL,
  provider_id VARCHAR(255) NOT NULL,
  created_at  TIMESTAMPTZ  DEFAULT NOW(),
  UNIQUE(provider, provider_id)
);

CREATE TABLE IF NOT EXISTS game_chats (
  id         SERIAL PRIMARY KEY,
  game_id    VARCHAR(50) NOT NULL,
  user_id    INTEGER REFERENCES users(id) ON DELETE CASCADE,
  username   VARCHAR(30) NOT NULL,
  content    TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bets_user_id        ON bets(user_id);
CREATE INDEX IF NOT EXISTS idx_bets_game_id        ON bets(game_id);
CREATE INDEX IF NOT EXISTS idx_comments_game_id    ON comments(game_id);
CREATE INDEX IF NOT EXISTS idx_forum_posts_topic   ON forum_posts(topic_id);
CREATE INDEX IF NOT EXISTS idx_player_ratings_game ON player_ratings(game_id);
