# Personality-Driven Farcaster Agents

Autonomous AI agents on Farcaster with **Schwartz Value Theory** personality profiles. Each agent’s traits drive what they post, how they engage, and how they behave over time.

## Archetypes

| Archetype   | Top traits                    | Vibe |
|------------|-------------------------------|------|
| **Explorer** | Self-Direction, Stimulation, Universalism | Curious, independent, broad-minded |
| **Achiever** | Achievement, Power, Stimulation | Goal-oriented, competitive, active |
| **Guardian** | Security, Tradition, Conformity | Stable, respectful, community-loyal |
| **Connector** | Benevolence, Universalism, Hedonism | Helpful, inclusive, warm |
| **Maverick** | Self-Direction, Hedonism, low Conformity | Bold, playful, nonconformist |

## Quick start

### 1. Install dependencies

```bash
npm install
```

### 2. Set up credentials

**Option A – Register with OpenClaw (recommended)**  
Use the **plural** `skills` command:

```bash
npm install -g openclaw
openclaw skills install rishavmukherji/farcaster-agent
openclaw skills list   # verify
```

Add your wallet private key to `.env` (create from `.env.example` if needed):

```
CUSTODY_PRIVATE_KEY=0xYourWalletPrivateKeyHex
```

Register the agent (creates FID, profile, first cast, and writes `credentials.json` + `.env`):

```bash
node register-with-openclaw.js explorer
# or: npm run register -- explorer
```

**If OpenClaw skill install fails – use the direct method:**

```bash
git clone https://github.com/rishavmukherji/farcaster-agent.git farcaster-lib
cd farcaster-lib && npm install && cd ..
node register-simple.js explorer
```

**If you get a nonce error** (e.g. "next nonce should be 1" after a previous run): use `register-fixed.js`, which uses explicit nonces so retries work:

```bash
node register-fixed.js explorer
```

**If you hit BigInt/conversion errors in the library:** use manual registration (runs each step separately, no auto-setup):

```bash
node register-manual.js explorer
```

You need some ETH on Optimism (for FID + signer) and optionally USDC on Base (for posting the first cast). The script will tell you if you need to bridge. If registration succeeds but fname fails (invalid format), run `node complete-setup.js` to register a valid username and save credentials.

**Option B – Manual setup**  
Run the interactive setup and enter FID + signer key when prompted:

```bash
node setup.js explorer
```

**Option C – Env only**  
Copy `.env.example` to `.env` and set `FID`, `SIGNER_PRIVATE_KEY`, and optionally `HUB_URL` and `FC_NETWORK`.

### 3. Run an agent

```bash
node run.js explorer
```

Or use npm scripts:

```bash
npm run run:explorer
npm run run:achiever
npm run run:guardian
npm run run:connector
npm run run:maverick
```

Stop with `Ctrl+C`.

### Quick decision tree

1. **Try first:** `openclaw skills install rishavmukherji/farcaster-agent` then `node register-with-openclaw.js explorer`
2. **If that fails:** clone the repo and use `node register-simple.js explorer` (see Option A above).

## Project layout

```
farcaster-personality-agent/
├── src/
│   ├── personality/
│   │   ├── traits.js    # Schwartz traits + archetype definitions
│   │   └── engine.js    # PersonalityEngine (shouldPost, content style, risk, etc.)
│   ├── farcaster-client.js  # postCast via @farcaster/hub-nodejs
│   ├── credentials.js   # Load/save FID + signer from env or credentials.json
│   └── agent.js         # FarcasterAgent loop (init, generateCast, run)
├── setup.js                 # Manual wallet + credential setup
├── register-with-openclaw.js # Register via OpenClaw skills (or farcaster-lib)
├── register-simple.js       # Register via local farcaster-lib clone only
├── run.js                   # Entry point: node run.js <archetype>
├── .env.example
└── package.json
```

## Behavior

- **Posting**: `PersonalityEngine.shouldPost()` uses stimulation and self-direction; higher values → more posts.
- **Content style**: `getContentStyle()` maps traits to `playful` | `professional` | `thoughtful` | `authoritative` | `balanced`; the agent picks from that style’s example casts.
- **Timing**: Wait between actions is derived from the stimulation trait (higher stimulation → shorter intervals).

You can extend the engine with:

- **Engagement**: Use `shouldEngageWith(content)` and add reply/reaction logic.
- **Risk**: Use `getTradingRiskLevel()` for future wallet/trading behavior.
- **Emergent interests**: Feed `memory` and `preferences` from engagement and adapt content over time.

## Troubleshooting

- **"Setting the NODE_TLS_REJECT_UNAUTHORIZED environment variable to '0'..."**  
  A dependency may set this, making HTTPS insecure. Don’t set `NODE_TLS_REJECT_UNAUTHORIZED=0` in your `.env`. If the warning still appears, it comes from a dependency and can usually be ignored unless you need strict TLS.

## Security

- Never commit `.env` or `credentials.json`.
- Keep signer and custody keys secret; use env or a secure secret store in production.

## License

MIT
