import { ref, get } from "firebase/database"
import { initFirebase, getFirebase } from "./firebase"

function getNextMidnight() {
    const d = new Date()
    d.setHours(24, 0, 0, 0)
    return d.getTime()
}

export async function getUser(wallet: string) {
    if (!wallet) return null

    const res = await fetch("/api/getUser", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ wallet })
    })

    if (!res.ok) {
        console.error("getUser API failed")
        return null
    }

    return await res.json()
}

// ✅ INIT USER (API)
export async function initUser(wallet: string, username: string) {
    await fetch("/api/initUser", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet, username })
    })
}

// ✅ USE CHANCE (API)
export async function consumeChance(wallet: string) {
    const res = await fetch("/api/useChance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet })
    })

    const data = await res.json()

    if (!data.success) return null

    // 🔥 ALWAYS REFETCH AFTER UPDATE
    return await getUser(wallet)
}

// ✅ UPDATE USERNAME (API)
export async function updateUsername(wallet: string, username: string) {
    await fetch("/api/updateUsername", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet, username })
    })
}

// ✅ ADD CHANCES (API)
export async function addChances(wallet: string, amount: number) {
    const res = await fetch("/api/addChance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet, amount })
    })

    return await res.json()
}

