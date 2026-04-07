# SCORE · NBA

NBA 实时比分、球员评分、Score Coin 竞猜、球迷论坛。数据来自 ESPN 公开 API，用户系统、竞猜记录、评分和论坛内容存在自己的数据库里。

---

## 技术栈

- 前端：React 19 + Vite + React Router v7
- 后端：Node.js + Express
- 数据库：PostgreSQL（本地开发）/ Neon（线上）
- 部署：Vercel（前端）+ Render（后端）

---

## 快速部署

### 1. 部署后端到 Render

仓库根目录已经带了 `render.yaml`，Render 会从 `backend/` 目录构建并启动服务。

在 Render 新建 **Blueprint** 或 **Web Service** 后，至少配置这些环境变量：

```bash
DATABASE_URL=postgresql://...
JWT_SECRET=your-long-random-secret
FRONTEND_URL=https://your-frontend-domain.vercel.app
```

说明：

- 后端启动时会自动执行 `backend/schema.sql`
- 新库第一次启动会自动建表并插入默认商城数据
- 健康检查地址是 `/health`

可选 OAuth 环境变量，只有需要第三方登录时再加：

```bash
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
DISCORD_CLIENT_ID=
DISCORD_CLIENT_SECRET=
FACEBOOK_CLIENT_ID=
FACEBOOK_CLIENT_SECRET=
TWITTER_CLIENT_ID=
TWITTER_CLIENT_SECRET=
```

### 2. 部署前端到 Vercel

把 Vercel 项目的 **Root Directory** 设为 `frontend/`，并添加环境变量：

```bash
VITE_API_URL=https://your-backend.onrender.com
```

仓库里已经带了 `frontend/vercel.json`，用于 React Router 的 SPA 路由回退，刷新 `/profile`、`/forum` 这类页面不会再 404。

### 3. 上线后互相回填域名

- Render 的 `FRONTEND_URL` 要填你的 Vercel 域名
- Vercel 的 `VITE_API_URL` 要填你的 Render 域名
- 如果启用 OAuth，各平台回调地址也要改成线上域名；`BACKEND_URL` 不填也可以，后端会自动用当前请求域名生成回调地址

---

## 本地跑起来

### 你需要先装好的东西

- Node.js `20.19+` 或 `22.12+`
- PostgreSQL（本地安装，确保 `psql` 命令能用）
- Git

### 第一步：克隆项目并切换分支

```bash
git clone https://github.com/AaronYu94/game_pulse_deploy.git
cd game_pulse_deploy
```

### 第二步：建数据库

```bash
psql -U postgres -c "CREATE DATABASE score_nba;"
```

### 第三步：配置后端环境变量

在 `backend/` 目录下创建 `.env` 文件：

```
DATABASE_URL=postgresql://postgres:你的密码@localhost/score_nba
JWT_SECRET=score_nba_secret_key_abc123xyz
PORT=3000
FRONTEND_URL=http://localhost:5173
BACKEND_URL=http://localhost:3000
```

### 第四步：启动后端

```bash
cd backend
npm install
npm start
```

看到 `Server running on port 3000` 说明后端起来了。第一次启动会自动建表。

### 第五步：启动前端

新开一个终端，回到项目根目录：

```bash
cd frontend
npm install
npm run dev
```

### 第六步：打开浏览器

```
http://localhost:5173
```

第一次进去会跳到登录页，注册一个账号即可。默认前端开发地址是 `http://localhost:5173`。

---

## 项目结构

```
game_pulse_deploy/
├── backend/
│   ├── src/
│   │   ├── index.js          # Express 入口，CORS 配置
│   │   ├── db.js             # PostgreSQL 连接池
│   │   ├── middleware/
│   │   │   └── auth.js       # JWT 验证中间件
│   │   └── routes/
│   │       ├── auth.js       # 注册、登录、/me
│   │       ├── coins.js      # Score Coin 余额、每日任务
│   │       ├── bets.js       # 竞猜下注、结算
│   │       ├── ratings.js    # 比赛评分、裁判评分、球员评分
│   │       ├── comments.js   # 评论、预测、点赞
│   │       └── forum.js      # 论坛话题、回复、点赞
│   ├── schema.sql            # 建表 SQL
│   ├── seed.js               # 测试数据（虚拟用户、评论、论坛）
│   ├── .env.example
│   └── package.json
│
└── frontend/
    ├── src/
    │   ├── main.jsx
    │   ├── App.jsx           # 路由配置
    │   ├── index.css         # 全局样式
    │   ├── contexts/
    │   │   └── AuthContext.jsx   # 登录状态管理
    │   ├── lib/
    │   │   ├── api.js        # 后端 API 调用封装
    │   │   └── espn.js       # ESPN 公开 API 封装
    │   ├── components/
    │   │   ├── Header.jsx
    │   │   └── TasksPanel.jsx    # 每日任务浮窗
    │   └── pages/
    │       ├── LoginPage.jsx
    │       ├── HomePage.jsx  # 比赛列表 + 日历 + 竞猜入口
    │       ├── GamePage.jsx  # 比赛详情 + Boxscore + 评分 + 评论
    │       └── ForumPage.jsx
    ├── vite.config.js        # 开发环境代理到 localhost:3000
    └── package.json
```

---

## Score Coin 规则

每个新用户注册后自动获得 200 枚 Score Coin，这是虚拟积分，没有真实价值。

每日任务（每天重置）：

| 任务 | 奖励 |
|------|------|
| 每日登录 | +20 |
| 分享比赛 | +50 |
| 给球员评分 | +10 |
| 发一条评论 | +15 |

竞猜规则：在未来比赛上押注，选主队或客队获胜，比赛结束后自动结算，赢了拿回 2 倍押注金额（1:1 赔率）。

---

## 第三方登录（OAuth）

登录页支持 Google、GitHub、Discord 三种登录方式。不想配的话留空就好，对应的按钮点了会报错，邮箱登录不受影响。

### 工作原理

用户点击按钮 → 跳到对应平台授权 → 平台回调后端 → 后端创建或找到用户、签发 JWT → 跳回前端自动登录。第一次用某个平台登录会自动注册账号。

### Google

1. 打开 [Google Cloud Console](https://console.cloud.google.com/)，新建或选择一个项目
2. 搜索并启用 **Google+ API** 或 **Google Identity**，导航到 **APIs & Services → Credentials**
3. 点击 **Create Credentials → OAuth client ID**，类型选 **Web application**
4. 在 **Authorized redirect URIs** 里填：
   - 本地开发：`http://localhost:3000/api/auth/google/callback`
5. 创建完成后复制 Client ID 和 Client Secret，填入 `.env`：
   ```
   GOOGLE_CLIENT_ID=你的client_id
   GOOGLE_CLIENT_SECRET=你的client_secret
   ```

### GitHub

1. 打开 [GitHub Developer Settings](https://github.com/settings/developers)，点击 **New OAuth App**
2. **Homepage URL** 填 `http://localhost:5173`
3. **Authorization callback URL** 填 `http://localhost:3000/api/auth/github/callback`
4. 注册完成后生成 Client Secret，填入 `.env`：
   ```
   GITHUB_CLIENT_ID=你的client_id
   GITHUB_CLIENT_SECRET=你的client_secret
   ```

### Discord

1. 打开 [Discord Developer Portal](https://discord.com/developers/applications)，点击 **New Application**
2. 左侧进入 **OAuth2**，在 **Redirects** 里添加：
   - `http://localhost:3000/api/auth/discord/callback`
3. 复制 Client ID 和 Client Secret，填入 `.env`：
   ```
   DISCORD_CLIENT_ID=你的client_id
   DISCORD_CLIENT_SECRET=你的client_secret
   ```

### Facebook

1. 打开 [Meta for Developers](https://developers.facebook.com/)，创建一个 App（类型选 **Consumer**）
2. 进入 **Facebook Login → Settings**，在 **Valid OAuth Redirect URIs** 填：
   - `http://localhost:3000/api/auth/facebook/callback`
3. 进入 **Settings → Basic**，复制 App ID 和 App Secret，填入 `.env`：
   ```
   FACEBOOK_CLIENT_ID=你的app_id
   FACEBOOK_CLIENT_SECRET=你的app_secret
   ```

### X (Twitter)

1. 打开 [X Developer Portal](https://developer.twitter.com/en/portal/dashboard)，创建一个 App
2. 进入 App 的 **Settings**，在 **User authentication settings** 里：
   - Type of App 选 **Web App**
   - Callback URI 填：`http://localhost:3000/api/auth/twitter/callback`
   - Website URL 填：`http://localhost:5173`
3. 进入 **Keys and tokens**，复制 OAuth 2.0 Client ID 和 Client Secret，填入 `.env`：
   ```
   TWITTER_CLIENT_ID=你的client_id
   TWITTER_CLIENT_SECRET=你的client_secret
   ```
   > X 的 OAuth 2.0 用 PKCE 流程，不需要额外配置，后端已处理。

配好任意一个后重启后端（`npm run dev`），刷新登录页按钮就可以用了。

---

## 填充测试数据

如果你想让本地数据库有一些看起来真实的内容，可以运行：

```bash
cd backend
node seed.js
```

这会创建 8 个虚拟用户、100 多条评论和预测、10 个论坛话题和 65 条回复。虚拟用户的密码统一是 `Password123!`。

---

## 常见问题

**Q: 启动后端时报 `password authentication failed`**

说明本地 PostgreSQL 需要密码，把 `.env` 里的 `DATABASE_URL` 改成带用户名密码的格式：
```
DATABASE_URL=postgresql://你的用户名:你的密码@localhost/score_nba
```

**Q: 前端请求报 CORS 错误**

确认后端 `src/index.js` 的 `allowedOrigins` 里包含了前端的地址（本地开发是 `http://localhost:5173`）。

**Q: Render 上后端冷启动很慢**

Render 免费套餐的服务在无流量时会休眠，第一个请求可能要等 30 秒左右。这是正常现象，付费套餐或者换其他平台可以解决。

**Q: 想重置数据库**

```bash
psql score_nba -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
psql score_nba < backend/schema.sql
```

**Q: 用了旧版 schema，现在想加 OAuth 支持**

```bash
psql score_nba < backend/schema.sql
```

schema.sql 里的建表语句都用了 `IF NOT EXISTS`，ALTER 语句也是幂等的，直接重跑不会破坏现有数据。
