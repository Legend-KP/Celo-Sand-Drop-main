import { NextResponse } from "next/server"
import { db } from "@/lib/firebase-admin"

export async function POST(req: Request) {
    try {
        const { gameName } = await req.json()

        if (!gameName || typeof gameName !== "string") { // CHECK IF THE GAME NAME IS VALID
            return NextResponse.json({ error: "Invalid game name" }, { status: 400 })
        }

        const snap = await db.ref(`leaderboards/${gameName}`).get() // GET THE LEADERBOARD DATA

        if (!snap.exists()) {
            return NextResponse.json([]) // IF THE LEADERBOARD DOES NOT EXIST, RETURN AN EMPTY ARRAY
        }

        const data = snap.val() // GET THE LEADERBOARD DATA
        const leaderboard = Object.values(data)
            .sort((a: any, b: any) => b.score - a.score)
            .slice(0, 50)

        return NextResponse.json(leaderboard)
    } catch (err) {
        console.error(err)
        return NextResponse.json({ error: "Server error" }, { status: 500 })
    }
}
