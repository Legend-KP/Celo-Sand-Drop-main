import { NextResponse } from "next/server"
import { db } from "@/lib/firebase-admin"

export async function POST(req: Request) {
    try {
        const { wallet } = await req.json()

        if (!wallet) {
            return NextResponse.json({ error: "Invalid wallet" }, { status: 400 })
        }

        const snap = await db.ref(`users/${wallet}`).get()

        if (!snap.exists()) {
            return NextResponse.json({
                exists: false
            })
        }

        const data = snap.val()

        return NextResponse.json({
            ...data,
            nextReset: Date.now() + 86400000
        })

    } catch (err) {
        console.error(err)
        return NextResponse.json({ error: "Server error" }, { status: 500 })
    }
}