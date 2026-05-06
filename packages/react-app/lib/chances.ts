import { ref, get, runTransaction, update } from "firebase/database"
import { initFirebase, getFirebase } from "./firebase"

function getMidnight() {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d.getTime()
}

function getNextMidnight() {
    const d = new Date()
    d.setHours(24, 0, 0, 0)
    return d.getTime()
}

function normalizeDailyState(data: any) {
    const today = getMidnight()

    if (!data) {
        return { data: null, today, wasReset: false }
    }

    if ((data.lastReset ?? 0) < today) {
        return {
            today,
            wasReset: true,
            data: {
                ...data,
                chances: 1,
                lastReset: today
            }
        }
    }

    return { data, today, wasReset: false }
}

function withNextReset(data: any) {
    return {
        ...data,
        nextReset: getNextMidnight()
    }
}

export async function initUser(wallet: string, username: string) {
    await initFirebase()

    const { db, authReady } = getFirebase()
    await authReady

    console.log("🔥 INIT USER CALLED:", wallet)

    const userRef = ref(db, `users/${wallet}`)

    await runTransaction(userRef, (current) => {
        if (current) return current

        return {
            username,
            chances: 1,
            lastReset: getMidnight()
        }
    })
}

// ✅ GET USER + DAILY RESET
export async function getUser(wallet: string) {
    await initFirebase()

    const { db, authReady } = getFirebase()
    await authReady

    const userRef = ref(db, `users/${wallet}`)
    const snap = await get(userRef)

    if (!snap.exists()) return null

    const normalized = normalizeDailyState(snap.val())
    const data = normalized.data

    if (normalized.wasReset) {
        await update(userRef, {
            chances: data.chances,
            lastReset: data.lastReset
        })
    }

    return withNextReset(data)
}

// ✅ USE CHANCE
export async function consumeChance(wallet: string) {
    await initFirebase()

    const { db, authReady } = getFirebase()
    await authReady

    const userRef = ref(db, `users/${wallet}`)
    const result = await runTransaction(userRef, (current) => {
        const normalized = normalizeDailyState(current)
        const data = normalized.data

        if (!data || data.chances <= 0) return data

        return {
            ...data,
            chances: data.chances - 1,
            lastReset: normalized.today
        }
    })

    if (!result.snapshot.exists()) return false

    const updated = result.snapshot.val()

    if ((updated.chances ?? 0) < 0) return false

    return withNextReset(updated)
}

export async function updateUsername(wallet: string, username: string) {
    await initFirebase()

    const { db, authReady } = getFirebase()
    await authReady

    const userRef = ref(db, `users/${wallet}`)
    const result = await runTransaction(userRef, (current) => {
        const normalized = normalizeDailyState(current)
        const data = normalized.data ?? {
            chances: 1,
            lastReset: normalized.today
        }

        return {
            ...data,
            username,
            lastReset: normalized.today
        }
    })

    return result.snapshot.exists() ? withNextReset(result.snapshot.val()) : null
}

// ✅ ADD CHANCES
export async function addChances(wallet: string, amount: number) {
    await initFirebase()

    const { db, authReady } = getFirebase()
    await authReady

    const userRef = ref(db, `users/${wallet}`)
    const result = await runTransaction(userRef, (current) => {
        const normalized = normalizeDailyState(current)
        const data = normalized.data ?? {
            chances: 1,
            lastReset: normalized.today
        }

        return {
            ...data,
            chances: (data.chances || 0) + amount,
            lastReset: normalized.today
        }
    })

    return result.snapshot.exists() ? withNextReset(result.snapshot.val()) : null
}
