import { NextResponse } from "next/server"
import { db } from "@/lib/firebase-admin"

export async function POST(req: Request) {
    try {
        const { wallet, username } = await req.json()

        if (!wallet || !username) {
            return NextResponse.json({ error: "Invalid data" }, { status: 400 })
        }

        await db.ref(`users/${wallet}`).update({
            username
        })

        return NextResponse.json({ success: true })

    } catch (err) {
        console.error(err)
        return NextResponse.json({ error: "Server error" }, { status: 500 })
    }
}