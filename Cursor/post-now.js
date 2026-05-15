/**
 * Post content.txt once right now (no waiting for agent loop).
 * Usage: node post-now.js
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { postCast } = require('./src/farcaster-client');
const { loadCredentials } = require('./src/credentials');

const contentPath = process.env.CASTS_FILE || path.join(process.cwd(), 'content.txt');

if (!fs.existsSync(contentPath)) {
  console.error('content.txt not found');
  process.exit(1);
}

const raw = fs.readFileSync(contentPath, 'utf8');
const lines = raw.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
const text = (process.env.CAST_SINGLE === '1' || process.env.CAST_SINGLE === 'true')
  ? lines.join('\n')
  : lines[0];
const castText = text.length > 320 ? text.slice(0, 317) + '…' : text;

const creds = loadCredentials();
if (!creds.custodyPrivateKey) {
  console.error('CUSTODY_PRIVATE_KEY required (in .env or credentials.json)');
  process.exit(1);
}

(async () => {
  try {
    console.log('Posting now...\n');
    const result = await postCast({
      fid: Number(creds.fid),
      signerPrivateKey: creds.signerPrivateKey,
      privateKey: creds.custodyPrivateKey,
      text: castText,
    });
    console.log('Posted:', result.url);
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
})();
