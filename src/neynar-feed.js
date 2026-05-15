/**
 * Fetch trending feed from Neynar (requires NEYNAR_API_KEY).
 * @returns {Promise<Array<{ fid: number, hash: string, text: string }>>}
 */
const https = require('https');

const NEYNAR_API = 'api.neynar.com';

function getTrendingFeed(limit = 20) {
  return new Promise((resolve, reject) => {
    const apiKey = process.env.NEYNAR_API_KEY;
    if (!apiKey) {
      reject(new Error('NEYNAR_API_KEY required for feed'));
      return;
    }

    const path = `/v2/farcaster/feed/trending?limit=${limit}`;
    const req = https.request(
      {
        hostname: NEYNAR_API,
        port: 443,
        path,
        method: 'GET',
        headers: { 'x-api-key': apiKey },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          if (res.statusCode !== 200) {
            reject(new Error(`Neynar feed ${res.statusCode}: ${data.slice(0, 200)}`));
            return;
          }
          try {
            const json = JSON.parse(data);
            const casts = (json.casts || []).map((c) => ({
              fid: c.author?.fid ?? c.cast_id?.fid,
              hash: c.hash || c.cast_id?.hash || '',
              text: c.text || '',
            })).filter((c) => c.fid && c.hash);
            resolve(casts);
          } catch (e) {
            reject(e);
          }
        });
      }
    );
    req.on('error', reject);
    req.end();
  });
}

/**
 * Fetch casts that mention a given FID (agent is tagged).
 * Uses Neynar v1 castsByMention (snapchain-api).
 * @param {number} fid - FID that is mentioned (our agent's FID)
 * @param {number} limit - max casts to return
 * @returns {Promise<Array<{ fid: number, hash: string, text: string }>>}
 */
function getMentionsForFid(fid, limit = 20) {
  return new Promise((resolve, reject) => {
    const apiKey = process.env.NEYNAR_API_KEY;
    if (!apiKey) {
      reject(new Error('NEYNAR_API_KEY required for mentions'));
      return;
    }
    const hostname = 'snapchain-api.neynar.com';
    const path = `/v1/castsByMention?fid=${Number(fid)}&pageSize=${limit}&reverse=true`;
    const req = https.request(
      {
        hostname,
        port: 443,
        path,
        method: 'GET',
        headers: { 'x-api-key': apiKey },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          if (res.statusCode !== 200) {
            reject(new Error(`Neynar mentions ${res.statusCode}: ${data.slice(0, 200)}`));
            return;
          }
          try {
            const json = JSON.parse(data);
            const messages = json.messages || [];
            const casts = messages.slice(0, limit).map((m) => {
              const d = m.data || m;
              const body = d.castAddBody || d.cast_add_body || {};
              const fidAuthor = d.fid;
              const hash = (m.hash || '').toString();
              const text = body.text || '';
              return { fid: fidAuthor, hash: hash.startsWith('0x') ? hash : '0x' + hash, text };
            }).filter((c) => c.fid && c.hash);
            resolve(casts);
          } catch (e) {
            reject(e);
          }
        });
      }
    );
    req.on('error', reject);
    req.end();
  });
}

module.exports = { getTrendingFeed, getMentionsForFid };
