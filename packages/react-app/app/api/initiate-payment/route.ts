import { NextResponse } from "next/server"
import { db } from "@/lib/firebase-admin"

export async function POST() {
    try {
        const id = crypto.randomUUID().replace(/-/g, "")
        await db.ref(`worldPayments/${id}`).set({
            id,
            status: "pending",
            createdAt: Date.now()
        })
        return NextResponse.json({ id })
    } catch (err) {
        console.error("initiate-payment failed:", err)
        return NextResponse.json({ error: "Server error" }, { status: 500 })
    }
}
