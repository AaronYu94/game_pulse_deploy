require('dotenv').config();
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://localhost/score_nba',
  ssl: false,
});

const uid = () => crypto.randomUUID().replace(/-/g, '').slice(0, 20);
const rand = (arr) => arr[Math.floor(Math.random() * arr.length)];
const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const ago = (hours) => new Date(Date.now() - hours * 3600 * 1000);

// ── fake users ──────────────────────────────────────────────────────────────
const FAKE_USERS = [
  { username: 'HoopHead99',   email: 'hoop99@fake.com',    coins: 450 },
  { username: 'KingJamesXXI', email: 'kingjames@fake.com', coins: 880 },
  { username: 'BrickLayer',   email: 'brick@fake.com',     coins: 120 },
  { username: 'NBAOracle',    email: 'oracle@fake.com',    coins: 1200 },
  { username: 'CourtVision',  email: 'court@fake.com',     coins: 300 },
  { username: 'AllNightNBA',  email: 'allnight@fake.com',  coins: 640 },
  { username: 'DunkTracker',  email: 'dunk@fake.com',      coins: 200 },
  { username: 'StatNerd42',   email: 'stats42@fake.com',   coins: 950 },
];

// ── game IDs (real ESPN IDs from recent dates) ─────────────────────────────
const PAST_GAMES = [
  { id: '401810748', away: 'OKC', home: 'NY'  },
  { id: '401810749', away: 'CHA', home: 'BOS' },
  { id: '401810750', away: 'UTAH', home: 'PHI' },
  { id: '401810751', away: 'POR', home: 'MEM' },
  { id: '401810752', away: 'ATL', home: 'MIL' },
  { id: '401810738', away: 'DAL', home: 'CHA' },
  { id: '401810739', away: 'DET', home: 'CLE' },
  { id: '401810741', away: 'BKN', home: 'MIA' },
];

// ── comment content pools ──────────────────────────────────────────────────
const GAME_COMMENTS = [
  "That fourth quarter was absolutely insane, can't believe what just happened",
  "Refs completely lost control of this game in the second half",
  "The home crowd energy was electric tonight, you could feel it through the screen",
  "Classic trap game, saw this result coming from a mile away",
  "Defense wins championships and that performance proved it",
  "Back-to-back games always hurt and you could see it in their legs",
  "The bench unit was the difference tonight, starters were sluggish",
  "This team is built for the playoffs, just need to stay healthy",
  "Coaching decision in the final 2 minutes was questionable at best",
  "Historical performance tonight, numbers don't even capture how dominant that was",
  "Trade deadline acquisition really paying off now",
  "They need a real point guard if they want to compete in the playoffs",
  "Zone defense completely confused them, took until the 3rd quarter to adjust",
  "Free throw shooting was atrocious, cost them at least 8 points",
  "Road win in that building is no joke, huge for their confidence",
  "Star player clearly not 100%, you can see him favoring his left side",
  "Every time this team loses people panic, they're still top 4 in the conference",
  "The hustle plays were the difference, all those offensive rebounds added up",
  "Lineup change in the second half completely changed the momentum",
  "Young core is finally starting to gel, exciting times ahead",
];

const PREDICT_COMMENTS = [
  "Home court advantage is massive here, going with the home team all the way",
  "Away team is on a 6-game road trip, fatigue is real — home wins easy",
  "Both teams played last night, slight edge to the home side on rest",
  "The away team's offense has been unstoppable lately, they cover this",
  "Historically these two teams are close, but I like the home team's matchup",
  "Away team's point guard matchup is a massive advantage tonight",
  "Home team is due for a bounce-back game after that embarrassing loss",
  "Under the radar pick here but the away team's defense suffocates this offense",
  "Too much talent on the away side, they win this going away",
  "Home team has won 7 straight at home, ride the streak",
  "Away team just got a massive trade, new guys need time to mesh — home wins",
  "Neither team can stop transition baskets, whoever scores first sets the tone",
  "The stats don't lie, away team is +8.2 net rating this month",
  "Home crowd will be insane tonight, that's a 5-point swing minimum",
  "Away team's second unit is way better, expect them to take over in the 4th",
];

const FORUM_TOPICS = [
  { title: 'Who is the real MVP this season?', body: "We're well past the halfway point and the race is legitimately wide open. Multiple guys have legitimate cases — the traditional stat leaders, the advanced metrics darlings, and the guys carrying bad teams. Who do you think deserves it and why? Let's debate." },
  { title: 'Most underrated player in the league right now', body: "We always talk about the stars but there are guys quietly putting up elite numbers that nobody discusses. Who is flying under the radar this season? I have my candidate but curious what the community thinks." },
  { title: 'Coaching changes that need to happen before playoffs', body: "Some teams are clearly underperforming relative to their talent. The coaching is the problem. Which teams need to make a change NOW and who should replace them? Be specific with your reasoning." },
  { title: 'Best rookie class in 10 years?', body: "The crop of rookies this season has been genuinely impressive across the board. Multiple guys already making real contributions and some of them are going to be superstars. Is this the best class we've seen in a decade?" },
  { title: 'Trade deadline winners and losers', body: "The dust has settled, rosters are set. Looking back at all the moves made at the deadline, who came out ahead? Which front office should be embarrassed by what they did (or didn't do)?" },
  { title: 'Will any team go 70+ wins?', body: "We have a team on a historic pace right now. Is 70 wins actually achievable? And if they do get there, how does that change the conversation around the greatest teams of all time?" },
  { title: 'Playoff bracket predictions — lock in your picks', body: "With the standings taking shape let's lock in our playoff bracket predictions now so we can come back and see who got it right. Post your full first round matchups and who you have going to the Finals." },
  { title: 'Most improved player race is the best award battle this year', body: "The MIP race is legitimately stacked this season. We have at least 4 guys who could win it and each of them has a compelling case. This award is so much more interesting than usual." },
  { title: 'Defense is officially back in the NBA', body: "For years everyone complained that the game was too easy offensively. This season the numbers show defenses have improved significantly. Is the league adjusting? Are referees calling it differently? What changed?" },
  { title: 'The load management debate — where do you stand?', body: "Another week, another star sitting out a nationally televised game. Fans are paying hundreds of dollars for seats and the star player is in street clothes. The teams defend it as injury prevention. Who is right here?" },
];

const FORUM_REPLIES = [
  "Completely agree with this take, been saying this for weeks",
  "Hard disagree. You're ignoring the context completely.",
  "The advanced metrics tell a different story though, have you looked at the on/off splits?",
  "I've watched every game this season and this is exactly right",
  "This is recency bias talking, let's revisit this in March",
  "Nobody wants to hear it but you're absolutely correct",
  "The eye test says one thing but the numbers say another — I trust the numbers",
  "Strong take. I was on the opposite side but you changed my mind a little",
  "Eastern conference bias in this thread is unreal lol",
  "If this was a western conference team people would be way more hyped",
  "Can we talk about how the refs factor into all of this?",
  "Three years from now we're going to look back at this season as a turning point",
  "The national media is completely sleeping on this",
  "Finals preview if we're lucky. Both teams are built to go deep",
  "People forget how important roster construction is beyond just the stars",
  "Injury luck plays a bigger role than anyone wants to admit",
  "The coaching is what separates good teams from great teams at this level",
  "Championship or bust mentality is honestly what's wrong with modern NBA discourse",
  "Said this exact thing two months ago and got clowned. Now everyone agrees.",
  "The talent gap in this league is actually getting bigger not smaller",
];

async function run() {
  const client = await pool.connect();
  try {
    console.log('Creating fake users…');
    const userIds = [];
    const pw = await bcrypt.hash('Password123!', 10);
    for (const u of FAKE_USERS) {
      const res = await client.query(
        `INSERT INTO users (username, email, password_hash, coins)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (email) DO UPDATE SET username = EXCLUDED.username
         RETURNING id`,
        [u.username, u.email, pw, u.coins]
      );
      userIds.push(res.rows[0].id);
    }
    console.log(`  ${userIds.length} users ready`);

    // ── comments on past games ────────────────────────────────────────────
    console.log('Seeding game comments…');
    let commentCount = 0;
    for (const game of PAST_GAMES) {
      const count = randInt(6, 12);
      for (let i = 0; i < count; i++) {
        const userId = rand(userIds);
        const content = rand(GAME_COMMENTS);
        const hoursAgo = randInt(1, 48);
        await client.query(
          `INSERT INTO comments (id, user_id, game_id, content, created_at)
           VALUES ($1, $2, $3, $4, $5) ON CONFLICT DO NOTHING`,
          [uid(), userId, game.id, content, ago(hoursAgo)]
        );
        commentCount++;
      }

      // predictions (pick = home/away)
      const predCount = randInt(4, 8);
      for (let i = 0; i < predCount; i++) {
        const userId = rand(userIds);
        const pick = rand(['home', 'away']);
        const content = rand(PREDICT_COMMENTS);
        const hoursAgo = randInt(24, 120);
        await client.query(
          `INSERT INTO comments (id, user_id, game_id, content, pick, created_at)
           VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT DO NOTHING`,
          [uid(), userId, game.id, content, pick, ago(hoursAgo)]
        );
        commentCount++;
      }
    }
    console.log(`  ${commentCount} comments/predictions inserted`);

    // ── comment likes ─────────────────────────────────────────────────────
    console.log('Seeding comment likes…');
    const { rows: allComments } = await client.query('SELECT id FROM comments');
    let likeCount = 0;
    for (const comment of allComments) {
      const likers = [...userIds].sort(() => Math.random() - 0.5).slice(0, randInt(0, 4));
      for (const uid2 of likers) {
        await client.query(
          `INSERT INTO comment_likes (user_id, comment_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
          [uid2, comment.id]
        );
        likeCount++;
      }
    }
    console.log(`  ${likeCount} comment likes inserted`);

    // ── forum topics + replies ────────────────────────────────────────────
    console.log('Seeding forum topics…');
    let topicCount = 0, replyCount = 0;
    for (const t of FORUM_TOPICS) {
      const topicId = uid();
      const userId = rand(userIds);
      const hoursAgo = randInt(2, 200);
      await client.query(
        `INSERT INTO forum_topics (id, user_id, title, body, created_at)
         VALUES ($1, $2, $3, $4, $5) ON CONFLICT DO NOTHING`,
        [topicId, userId, t.title, t.body, ago(hoursAgo)]
      );
      topicCount++;

      // replies per topic
      const numReplies = randInt(4, 14);
      for (let i = 0; i < numReplies; i++) {
        const postId = uid();
        const replyUserId = rand(userIds);
        const content = rand(FORUM_REPLIES);
        const replyHoursAgo = randInt(0, hoursAgo - 1);
        await client.query(
          `INSERT INTO forum_posts (id, user_id, topic_id, content, created_at)
           VALUES ($1, $2, $3, $4, $5) ON CONFLICT DO NOTHING`,
          [postId, replyUserId, topicId, content, ago(replyHoursAgo)]
        );
        replyCount++;

        // reply likes
        const likers2 = [...userIds].sort(() => Math.random() - 0.5).slice(0, randInt(0, 5));
        for (const luid of likers2) {
          await client.query(
            `INSERT INTO forum_post_likes (user_id, post_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
            [luid, postId]
          );
        }
      }
    }
    console.log(`  ${topicCount} topics, ${replyCount} replies inserted`);

    // ── summary ───────────────────────────────────────────────────────────
    const { rows: [summary] } = await client.query(`
      SELECT
        (SELECT count(*) FROM users)          AS users,
        (SELECT count(*) FROM comments)       AS comments,
        (SELECT count(*) FROM comment_likes)  AS comment_likes,
        (SELECT count(*) FROM forum_topics)   AS topics,
        (SELECT count(*) FROM forum_posts)    AS replies,
        (SELECT count(*) FROM forum_post_likes) AS reply_likes
    `);
    console.log('\nDatabase totals:');
    console.table(summary);

  } finally {
    client.release();
    await pool.end();
  }
}

run().catch(err => { console.error(err); process.exit(1); });
