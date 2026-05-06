import { ref, get, query, orderByChild, limitToLast, runTransaction } from "firebase/database"
import { initFirebase, getFirebase } from "./firebase"

export async function saveScore(
  gameName: string,
  wallet: string,
  username: string,
  score: number
) {
  await initFirebase()

  const { db, authReady } = getFirebase()
  await authReady

  const userRef = ref(db, `leaderboards/${gameName}/${wallet}`)

  await runTransaction(userRef, (current) => {
    if (!current || score > current.score) {
      return {
        username,
        score,
        timestamp: Date.now(),
      }
    }

    return current
  })
}

export async function getLeaderboard(gameName: string) {
  await initFirebase()

  const { db, authReady } = getFirebase()
  await authReady

  const leaderboardQuery = query(
    ref(db, `leaderboards/${gameName}`),
    orderByChild("score"),
    limitToLast(200)
  )
  const snapshot = await get(leaderboardQuery)

  if (!snapshot.exists()) return []

  const data = snapshot.val()

  return Object.values(data)
    .filter((entry: any) => typeof entry?.score === "number")
    .sort((a: any, b: any) => b.score - a.score)
    .slice(0, 50)
}
