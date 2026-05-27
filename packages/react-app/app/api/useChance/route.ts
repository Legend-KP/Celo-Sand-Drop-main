import { NextResponse } from "next/server"
import { db } from "@/lib/firebase-admin"

function getMidnight() {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d.getTime()
}

export async function POST(req: Request) {
    try {
        const { wallet } = await req.json()
        const walletKey = wallet?.trim()

        if (!walletKey) { // CHECK IF THE WALLET IS VALID
            return NextResponse.json({ error: "Invalid wallet" }, { status: 400 })
        }

        const today = getMidnight() // GET THE CURRENT DATE
        const ref = db.ref(`users/${walletKey}`)

        // Read current data
        const snap = await ref.get()
        const data = snap.exists() ? snap.val() : {
            username: "Guest",
            chances: 1,
            lastReset: today
        }

        // Reset chances if it's a new day
        if ((data.lastReset ?? 0) < today) {
            data.chances = 1
            data.lastReset = today
        }

        // Check if chances available
        if ((data.chances ?? 0) <= 0) {
            return NextResponse.json({ success: false })
        }

        // Deduct one chance
        const updated = {
            ...data,
            chances: data.chances - 1,
            lastReset: data.lastReset ?? today
        }

        await ref.set(updated)

        return NextResponse.json({ success: true })

    } catch (err) {
        console.error(err)
        return NextResponse.json({ error: "Server error" }, { status: 500 })
    }
}