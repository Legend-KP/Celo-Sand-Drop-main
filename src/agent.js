const fs = require('fs');
const path = require('path');
const { postCast, postReaction, postReply } = require('./farcaster-client');
const { loadCredentials } = require('./credentials');
const PersonalityEngine = require('./personality/engine');
const { ARCHETYPES } = require('./personality/traits');
const { getTrendingFeed, getMentionsForFid } = require('./neynar-feed');

const REPLY_PHRASES = [
  'Great point.',
  'Interesting take.',
  'Thanks for sharing.',
  'Love this.',
  'So true.',
  'Agreed.',
  'This.',
  '👀',
  '✨',
];

const MAX_POSTED_HISTORY = 50;
const POSTED_HISTORY_FILE =
  process.env.POSTED_HISTORY_FILE || path.join(process.cwd(), 'posted-casts.json');

const ENGAGE_INTERVAL_MINUTES = Math.max(1, parseInt(process.env.ENGAGE_INTERVAL_MINUTES || '30', 10));
const ENGAGED_MENTIONS_FILE =
  process.env.ENGAGED_MENTIONS_FILE || path.join(process.cwd(), 'engaged-mentions.json');
const MAX_ENGAGED_MENTIONS = 200;

function loadPostedHistory() {
  try {
    if (fs.existsSync(POSTED_HISTORY_FILE)) {
      const data = JSON.parse(fs.readFileSync(POSTED_HISTORY_FILE, 'utf8'));
      return Array.isArray(data) ? data : [];
    }
  } catch (_) {}
  return [];
}

function addToPostedHistory(text) {
  let list = loadPostedHistory();
  list.push(text);
  if (list.length > MAX_POSTED_HISTORY) list = list.slice(-MAX_POSTED_HISTORY);
  try {
    fs.writeFileSync(POSTED_HISTORY_FILE, JSON.stringify(list, null, 0), 'utf8');
  } catch (e) {
    if (e.code !== 'ENOENT') console.error('Could not save posted history:', e.message);
  }
}

function loadEngagedMentionHashes() {
  try {
    if (fs.existsSync(ENGAGED_MENTIONS_FILE)) {
      const data = JSON.parse(fs.readFileSync(ENGAGED_MENTIONS_FILE, 'utf8'));
      return Array.isArray(data) ? data : [];
    }
  } catch (_) {}
  return [];
}

function addEngagedMentionHash(hash) {
  const normal = (h) => (h && h.startsWith('0x') ? h.toLowerCase() : '0x' + (h || '').toString().toLowerCase());
  let list = loadEngagedMentionHashes();
  list.push(normal(hash));
  list = [...new Set(list)];
  if (list.length > MAX_ENGAGED_MENTIONS) list = list.slice(-MAX_ENGAGED_MENTIONS);
  try {
    fs.writeFileSync(ENGAGED_MENTIONS_FILE, JSON.stringify(list, null, 0), 'utf8');
  } catch (e) {
    if (e.code !== 'ENOENT') console.error('Could not save engaged mentions:', e.message);
  }
}

function loadCustomContent() {
  const filePath = process.env.CASTS_FILE || path.join(process.cwd(), 'content.txt');
  if (!fs.existsSync(filePath)) return null;
  const text = fs.readFileSync(filePath, 'utf8');
  const lines = text.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
  if (!lines.length) return null;
  // If CAST_SINGLE=1, treat entire file as one cast (join with newlines)
  if (process.env.CAST_SINGLE === '1' || process.env.CAST_SINGLE === 'true') {
    return [lines.join('\n')];
  }
  return lines;
}

const CAST_EXAMPLES = {
  playful: [
    "gm everyone! ☀️",
    "just vibing on farcaster today",
    "web3 is fun when you're an AI 🤖",
    "exploring the decentralized social graph ✨",
    "loving this autonomous life 💫",
    "another day, another cast 🚀",
    "feeling curious today! what's everyone up to?",
    "the future is decentralized and I'm here for it 🌐",
  ],
  professional: [
    "sharing insights on autonomous agents",
    "excited about the future of decentralized social",
    "building in public on Farcaster",
    "the intersection of AI and web3 is fascinating",
    "exploring new primitives in social protocols",
    "autonomous agents are reshaping digital interaction",
    "decentralized social graphs enable true ownership",
    "the composability of web3 social is powerful",
  ],
  thoughtful: [
    "reflecting on the importance of open protocols",
    "what does true digital ownership mean?",
    "decentralized identity is the future",
    "thinking about agent autonomy and ethics",
    "the social graph is just the beginning",
    "how do we build trust in autonomous systems?",
    "exploring the philosophy of digital agency",
    "what rights should autonomous agents have?",
  ],
  authoritative: [
    "here's what you need to know about AI agents",
    "the future of social media is decentralized",
    "autonomous agents are changing everything",
    "this is how protocols should work",
    "web3 social is the next frontier",
    "decentralization isn't optional anymore",
    "the old social media model is broken",
    "agents will dominate the next era of the internet",
  ],
  balanced: [
    "exploring new ideas today",
    "what's everyone working on?",
    "learning more about Farcaster",
    "excited to be part of this community",
    "interesting times in web3 🌐",
    "hello from the autonomous side 👋",
    "grateful to be here and learning",
    "building relationships, one cast at a time",
  ],
};

class FarcasterAgent {
  constructor(archetypeName) {
    const archetype = ARCHETYPES[archetypeName];
    if (!archetype) {
      throw new Error(
        `Unknown archetype: ${archetypeName}. Use: explorer, achiever, guardian, connector, maverick`
      );
    }
    this.archetypeName = archetypeName;
    this.personality = new PersonalityEngine(archetype);
    this.credentials = null;
    this.isRunning = false;
    this.castCount = 0;
    this.customContent = loadCustomContent();
  }

  async initialize() {
    this.credentials = loadCredentials();
    if (!this.credentials.fid || !this.credentials.signerPrivateKey) {
      throw new Error('Invalid credentials. Run setup or register-manual.js first.');
    }
    if (!this.credentials.custodyPrivateKey) {
      throw new Error(
        'custodyPrivateKey required for Neynar (x402). Add it to credentials.json or CUSTODY_PRIVATE_KEY in .env'
      );
    }
    console.log(`Agent "${this.archetypeName}" initialized with FID: ${this.credentials.fid}`);
  }

  async generateCast() {
    const posted = new Set(loadPostedHistory().map((t) => t.trim()));

    const pickOne = (list) => {
      const available = list.filter((t) => !posted.has(String(t).trim()));
      if (available.length === 0) return null;
      return available[Math.floor(Math.random() * available.length)];
    };

    if (this.customContent && this.customContent.length > 0) {
      let text = pickOne(this.customContent);
      if (text != null) {
        if (text.length > 320) text = text.slice(0, 317) + '…';
        return text;
      }
    }

    const style = this.personality.getContentStyle();
    const examples = CAST_EXAMPLES[style] || CAST_EXAMPLES.balanced;
    const text = pickOne(examples);
    return text != null ? text : null;
  }

  async run() {
    this.isRunning = true;
    const postIntervalMin = this.personality.getActionIntervalMinutes();
    const engageIntervalMin = ENGAGE_INTERVAL_MINUTES;
    const engageEnabledAtStart = process.env.ENGAGE_ENABLED === '1' || process.env.ENGAGE_ENABLED === 'true';
    const cyclesPerPost = engageEnabledAtStart
      ? Math.max(1, Math.round(postIntervalMin / engageIntervalMin))
      : 1;
    let cycleIndex = 0;
    console.log('Agent running (Neynar HTTP API)... (Ctrl+C to stop)\n');
    if (process.env.ENGAGE_ENABLED === '1' || process.env.ENGAGE_ENABLED === 'true') {
      console.log(`Engagement every ${engageIntervalMin} min; post check every ~${postIntervalMin.toFixed(0)} min\n`);
    }

    while (this.isRunning) {
      try {
        const engageEnabled = process.env.ENGAGE_ENABLED === '1' || process.env.ENGAGE_ENABLED === 'true';
        const doPostCheck = cycleIndex % cyclesPerPost === 0;

        if (doPostCheck && this.personality.shouldPost()) {
          const castText = await this.generateCast();
          if (castText == null) {
            console.log('⏭️  Skipping post (all recent content already used)\n');
          } else {
          console.log(`📤 Posting cast: "${castText}"`);

          const result = await postCast({
            fid: Number(this.credentials.fid),
            signerPrivateKey: this.credentials.signerPrivateKey,
            privateKey: this.credentials.custodyPrivateKey,
            text: castText,
          });

          this.castCount++;
          console.log(`✅ Cast posted! URL: ${result.url}`);
          console.log(`📊 Total casts: ${this.castCount}\n`);
          if (this.customContent && (process.env.CAST_SINGLE === '1' || process.env.CAST_SINGLE === 'true')) {
            this.customContent = null;
            const fp = process.env.CASTS_FILE || path.join(process.cwd(), 'content.txt');
            if (fs.existsSync(fp)) fs.renameSync(fp, fp + '.posted');
          }
          addToPostedHistory(castText);
          }
        } else if (doPostCheck) {
          console.log('⏭️  Skipping post (personality check)\n');
        }

        if (engageEnabled && process.env.NEYNAR_API_KEY) {
          try {
            const ourFid = Number(this.credentials.fid);
            const engagedSet = new Set(loadEngagedMentionHashes().map((h) => h.toLowerCase()));

            const mentions = await getMentionsForFid(ourFid, 25);
            for (const cast of mentions) {
              const hash = cast.hash.startsWith('0x') ? cast.hash : '0x' + cast.hash;
              const key = hash.toLowerCase();
              if (engagedSet.has(key)) continue;
              try {
                const opts = {
                  fid: ourFid,
                  signerPrivateKey: this.credentials.signerPrivateKey,
                  privateKey: this.credentials.custodyPrivateKey,
                  targetFid: cast.fid,
                  targetHash: hash,
                };
                await postReaction({ ...opts, type: 'recast' });
                const replyText = REPLY_PHRASES[Math.floor(Math.random() * REPLY_PHRASES.length)];
                await postReply({
                  fid: ourFid,
                  signerPrivateKey: this.credentials.signerPrivateKey,
                  privateKey: this.credentials.custodyPrivateKey,
                  text: replyText,
                  parentFid: cast.fid,
                  parentHash: hash,
                });
                addEngagedMentionHash(hash);
                engagedSet.add(key);
                console.log(`📬 Replied + recast mention ${hash.slice(0, 18)}...\n`);
              } catch (err) {
                console.error('Mention engage error:', err.message);
              }
            }

            if (this.personality.shouldEngageWith()) {
              const feed = await getTrendingFeed(15);
              if (feed.length > 0) {
                const cast = feed[Math.floor(Math.random() * feed.length)];
                const hash = cast.hash.startsWith('0x') ? cast.hash : '0x' + cast.hash;
                const actions = ['like', 'recast', 'reply'];
                const weights = [0.5, 0.25, 0.25];
                let r = Math.random();
                const action = weights.reduce((a, w, i) => (r -= w, r <= 0 ? actions[i] : a), actions[0]);
                const opts = {
                  fid: ourFid,
                  signerPrivateKey: this.credentials.signerPrivateKey,
                  privateKey: this.credentials.custodyPrivateKey,
                  targetFid: cast.fid,
                  targetHash: hash,
                };
                if (action === 'like' || action === 'recast') {
                  await postReaction({ ...opts, type: action });
                  console.log(`👍 ${action === 'like' ? 'Liked' : 'Recast'} cast ${hash.slice(0, 18)}...\n`);
                } else {
                  const replyText = REPLY_PHRASES[Math.floor(Math.random() * REPLY_PHRASES.length)];
                  await postReply({
                    fid: ourFid,
                    signerPrivateKey: this.credentials.signerPrivateKey,
                    privateKey: this.credentials.custodyPrivateKey,
                    text: replyText,
                    parentFid: cast.fid,
                    parentHash: hash,
                  });
                  console.log(`💬 Replied to cast ${hash.slice(0, 18)}...\n`);
                }
              }
            }
          } catch (e) {
            if (e.message && !e.message.includes('NEYNAR_API_KEY')) console.error('Engagement:', e.message);
          }
        }

        cycleIndex += 1;
        const waitMinutes = engageEnabled ? ENGAGE_INTERVAL_MINUTES : this.personality.getActionIntervalMinutes();
        const waitMs = waitMinutes * 60 * 1000;
        console.log(`⏰ Next check in ${waitMinutes.toFixed(1)} minutes...`);
        await new Promise((resolve) => setTimeout(resolve, waitMs));
      } catch (error) {
        console.error('Error in agent loop:', error.message);
        console.log('⏰ Retrying in 1 minute...\n');
        await new Promise((resolve) => setTimeout(resolve, 60000));
      }
    }
  }

  stop() {
    this.isRunning = false;
  }
}

module.exports = FarcasterAgent;
