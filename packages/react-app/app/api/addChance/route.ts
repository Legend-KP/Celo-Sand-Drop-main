import { NextResponse } from "next/server"
import { db } from "@/lib/firebase-admin"

export async function POST(req: Request) {
    try {
        const body = await req.json()
        const { wallet, amount } = body
        const walletKey = wallet?.trim()
// CHECK IF THE WALLET IS VALID
        if (!walletKey || typeof amount !== "number" || amount <= 0) {
            return NextResponse.json({ error: "Invalid data" }, { status: 400 })
        }

        // GET THE USER DATA
        const ref = db.ref(`users/${walletKey}`)
        const snap = await ref.get()

        if (!snap.exists()) {   // IF THE USER DOES NOT EXIST, CREATE A NEW USER
            await ref.set({
                username: "Guest",
                chances: amount,
                lastReset: Date.now()
            })

            return NextResponse.json({ success: true, chances: amount })
        }

        const data = snap.val()

        // ?? HARD LIMIT (IMPORTANT)
        let newChances = (data.chances || 0) + amount

        if (newChances > 12) {
            newChances = 12
        }

        await ref.update({
            chances: newChances
        })

        return NextResponse.json({ success: true, chances: newChances })

    } catch (err) {
        console.error(err) // LOG THE ERROR
        return NextResponse.json({ error: "Server error" }, { status: 500 })
    }
}
