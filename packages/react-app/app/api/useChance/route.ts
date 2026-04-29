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

        if (!walletKey) {
            return NextResponse.json({ error: "Invalid wallet" }, { status: 400 })
        }

        const today = getMidnight()
        const ref = db.ref(`users/${walletKey}`)

        const result = await ref.transaction((current) => {
            const data = current ?? {
                username: "Guest",
                chances: 1,
                lastReset: today
            }

            if ((data.lastReset ?? 0) < today) {
                data.chances = 1
                data.lastReset = today
            }

            if ((data.chances ?? 0) <= 0) {
                return
            }

            return {
                ...data,
                chances: (data.chances ?? 0) - 1,
                lastReset: data.lastReset ?? today
            }
        })

        if (!result.committed || !result.snapshot.exists()) {
            return NextResponse.json({ success: false })
        }

        return NextResponse.json({ success: true })

    } catch (err) {
        console.error(err)
        return NextResponse.json({ error: "Server error" }, { status: 500 })
    }
}
