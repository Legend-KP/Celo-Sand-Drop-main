const fs = require('fs');
const path = require('path');

const CREDENTIALS_PATH = path.join(process.cwd(), 'credentials.json');

/**
 * Get display username: AGENT_USERNAME (avoids Windows USERNAME = computer name).
 */
function getUsername() {
  return process.env.AGENT_USERNAME || null;
}

/**
 * Load Farcaster credentials from credentials.json or env.
 * @returns {{ fid: string, signerPrivateKey: string, custodyPrivateKey?: string, username?: string }}
 */
function loadCredentials() {
  if (process.env.FID && process.env.SIGNER_PRIVATE_KEY) {
    console.log('📄 Loaded credentials from .env');
    return {
      fid: process.env.FID,
      signerPrivateKey: process.env.SIGNER_PRIVATE_KEY,
      custodyPrivateKey: process.env.CUSTODY_PRIVATE_KEY,
      username: getUsername(),
    };
  }

  if (!fs.existsSync(CREDENTIALS_PATH)) {
    throw new Error(
      'No credentials found. Run: node setup.js <archetype>\n' +
        'Or set FID and SIGNER_PRIVATE_KEY in .env (see .env.example).'
    );
  }

  const data = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf8'));
  if (!data.fid || !data.signerPrivateKey) {
    throw new Error(
      'credentials.json must contain fid and signerPrivateKey. Re-run setup.js.'
    );
  }
  // Prefer AGENT_USERNAME so Windows USERNAME doesn't override
  const username = getUsername() || data.username || null;
  console.log('📄 Loaded credentials from credentials.json');
  return { ...data, username };
}

/**
 * Save credentials to credentials.json (used by setup).
 */
function saveCredentials(credentials) {
  fs.writeFileSync(
    CREDENTIALS_PATH,
    JSON.stringify(credentials, null, 2),
    'utf8'
  );
}

module.exports = { loadCredentials, saveCredentials, getUsername, CREDENTIALS_PATH };
