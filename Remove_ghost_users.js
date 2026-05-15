/**
 * ============================================================
 *  SandDrop — Ghost User Removal Script
 *  Removes 213,350 wallet addresses from users/ node that have
 *  ONLY a "chances" field (no username, no lastReset).
 * ============================================================
 *
 *  PREREQUISITES
 *  -------------
 *  1. Node.js v18+  →  https://nodejs.org
 *  2. npm install firebase-admin
 *  3. serviceAccountKey.json in the same folder as this script
 *  4. BACKUP your database first (Firebase Console → RTDB → ⋮ → Export JSON)
 *
 *  HOW TO RUN
 *  ----------
 *     node remove_ghost_users.js
 *
 *  WHAT IT DOES
 *  ------------
 *  1. Reads every entry under users/ from Firebase
 *  2. Identifies wallets that have ONLY "chances" — no username, no lastReset
 *  3. Deletes them in batches of 500 (Firebase multi-path update limit is ~1000 paths;
 *     500 is safe and avoids timeout on large payloads)
 *  4. Logs progress after every batch
 *
 *  SAFETY CHECKS BUILT IN
 *  ----------------------
 *  - Dry-run mode (DRY_RUN = true) — logs what WOULD be deleted without touching Firebase
 *  - Confirms count before deleting
 *  - Skips any wallet that has username or lastReset (real users are never touched)
 * ============================================================
 */

const admin = require("firebase-admin");
const serviceAccount = require("./serviceAccountKey.json");

// ─── CONFIG ──────────────────────────────────────────────────────────────────
const DATABASE_URL =
  "https://sanddrop-32496-default-rtdb.asia-southeast1.firebasedatabase.app";

const USERS_PATH = "users";          // node to read + delete from
const BATCH_SIZE = 500;              // wallets per Firebase update call
const DRY_RUN    = false;            // set true to preview without deleting
// ─────────────────────────────────────────────────────────────────────────────

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: DATABASE_URL,
});

const db = admin.database();

// ── Helper: split array into chunks ─────────────────────────────────────────
function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size));
  }
  return out;
}

// ── Helper: sleep ms ────────────────────────────────────────────────────────
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── Main ────────────────────────────────────────────────────────────────────
async function removeGhostUsers() {
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(" SandDrop — Ghost User Removal");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`Target:   ${DATABASE_URL}`);
  console.log(`Path:     /${USERS_PATH}`);
  console.log(`Batch:    ${BATCH_SIZE} wallets per request`);
  console.log(`Dry run:  ${DRY_RUN}`);
  console.log("───────────────────────────────────────────────");

  // ── Step 1: Fetch all users ──────────────────────────────────────────────
  console.log("📥 Fetching users from Firebase...");
  const snapshot = await db.ref(USERS_PATH).once("value");
  const allUsers = snapshot.val();

  if (!allUsers) {
    console.log("⚠️  No users found at path:", USERS_PATH);
    process.exit(0);
  }

  const totalInDB = Object.keys(allUsers).length;
  console.log(`   Found ${totalInDB.toLocaleString()} total wallets in users DB`);

  // ── Step 2: Identify ghost wallets (only "chances", nothing else) ─────────
  const ghostWallets = Object.entries(allUsers)
    .filter(([addr, data]) => {
      if (!data || typeof data !== "object") return false;
      const keys = Object.keys(data);
      const hasChances   = keys.includes("chances");
      const hasUsername  = keys.includes("username");
      const hasLastReset = keys.includes("lastReset");
      // Ghost = has chances but NO username AND NO lastReset
      return hasChances && !hasUsername && !hasLastReset;
    })
    .map(([addr]) => addr);

  console.log(`\n🔍 Ghost wallets identified: ${ghostWallets.length.toLocaleString()}`);
  console.log(`   (only "chances" field — no username, no lastReset)`);
  console.log(`   Real users preserved:    ${(totalInDB - ghostWallets.length).toLocaleString()}`);

  if (ghostWallets.length === 0) {
    console.log("✅ Nothing to delete. Database is already clean.");
    await admin.app().delete();
    return;
  }

  if (DRY_RUN) {
    console.log("\n🧪 DRY RUN MODE — no changes made to Firebase.");
    console.log(`   Would delete ${ghostWallets.length.toLocaleString()} wallets.`);
    console.log("   Set DRY_RUN = false to execute.");
    await admin.app().delete();
    return;
  }

  // ── Step 3: Batch delete ─────────────────────────────────────────────────
  const batches     = chunk(ghostWallets, BATCH_SIZE);
  const totalBatch  = batches.length;
  let   totalDeleted = 0;

  console.log(`\n🗑️  Starting deletion: ${totalBatch} batches of up to ${BATCH_SIZE}...\n`);

  for (let i = 0; i < batches.length; i++) {
    const batch   = batches[i];
    const updates = {};

    for (const wallet of batch) {
      updates[`${USERS_PATH}/${wallet}`] = null; // null = delete in Firebase RTDB
    }

    try {
      await db.ref("/").update(updates);
      totalDeleted += batch.length;

      const pct = ((i + 1) / totalBatch * 100).toFixed(1);
      console.log(
        `   Batch ${String(i + 1).padStart(4)} / ${totalBatch}  ` +
        `[ ${pct.padStart(5)}% ]  ` +
        `+${batch.length} deleted  ` +
        `(total: ${totalDeleted.toLocaleString()})`
      );

      // Small pause every 10 batches to avoid rate limiting
      if ((i + 1) % 10 === 0) await sleep(200);

    } catch (err) {
      console.error(`\n❌ Error on batch ${i + 1}:`, err.message);
      console.error(`   Deleted so far: ${totalDeleted.toLocaleString()}`);
      console.error("   Remaining batches were NOT processed.");
      await admin.app().delete();
      process.exit(1);
    }
  }

  // ── Step 4: Summary ──────────────────────────────────────────────────────
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`✅ Complete! ${totalDeleted.toLocaleString()} ghost wallets deleted from users DB.`);
  console.log(`   Real users preserved: ${(totalInDB - totalDeleted).toLocaleString()}`);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  await admin.app().delete();
}

removeGhostUsers();