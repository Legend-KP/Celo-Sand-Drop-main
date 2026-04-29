import { NextResponse } from "next/server"
import { db } from "@/lib/firebase-admin"

export async function POST(req: Request) {
    try {
        const body = await req.json()

        const { wallet, username, score, gameName } = body

        // ?? BASIC VALIDATION
        if (!wallet || !username || typeof score !== "number") {
            return NextResponse.json({ error: "Invalid data" }, { status: 400 })
        }

        // ?? ANTI-CHEAT
        if (score < 0 || score > 1000000) {
            return NextResponse.json({ error: "Invalid score" }, { status: 400 })
        }

        const refPath = `leaderboards/${gameName}/${wallet}`
        const snap = await db.ref(refPath).get()

        if (snap.exists()) {
            const existing = snap.val()

            if (score <= existing.score) {
                return NextResponse.json({ success: true }) // ignore lower score
            }
        }

        // ? SAVE
        await db.ref(refPath).set({
            username,
            score,
            timestamp: Date.now()
        })

        return NextResponse.json({ success: true })

    } catch (err) {
        console.error(err)
        return NextResponse.json({ error: "Server error" }, { status: 500 })
    }
}