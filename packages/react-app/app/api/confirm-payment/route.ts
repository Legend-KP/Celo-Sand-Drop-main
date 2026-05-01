import { NextResponse } from "next/server"
import type { MiniAppPaymentSuccessPayload } from "@worldcoin/minikit-js/commands"
import { db } from "@/lib/firebase-admin"

type WorldTxResponse = {
    transaction_status?: string
}

export async function POST(req: Request) {
    try {
        const { payload } = await req.json() as { payload?: MiniAppPaymentSuccessPayload }
        if (!payload?.transaction_id || !payload.reference) {
            return NextResponse.json({ success: false, error: "Invalid payload" }, { status: 400 })
        }

        const appId = process.env.NEXT_PUBLIC_APP_ID
        const apiKey = process.env.WORLD_DEV_PORTAL_API_KEY
        if (!appId || !apiKey) {
            return NextResponse.json({ success: false, error: "Missing World env vars" }, { status: 500 })
        }

        const paymentRef = db.ref(`worldPayments/${payload.reference}`)
        const saved = await paymentRef.get()
        if (!saved.exists()) {
            return NextResponse.json({ success: false, error: "Unknown reference" }, { status: 400 })
        }

        const response = await fetch(
            `https://developer.worldcoin.org/api/v2/minikit/transaction/${payload.transaction_id}?app_id=${appId}&type=payment`,
            {
                headers: {
                    Authorization: `Bearer ${apiKey}`
                },
                cache: "no-store"
            }
        )

        if (!response.ok) {
            const body = await response.text()
            console.error("confirm-payment World API error:", response.status, body)
            await paymentRef.update({
                status: "failed",
                checkedAt: Date.now()
            })
            return NextResponse.json({ success: false })
        }

        const transaction = await response.json() as WorldTxResponse
        const success = transaction.transaction_status !== "failed"

        await paymentRef.update({
            status: success ? "confirmed" : "failed",
            checkedAt: Date.now(),
            transactionId: payload.transaction_id
        })

        return NextResponse.json({ success })
    } catch (err) {
        console.error("confirm-payment failed:", err)
        return NextResponse.json({ success: false, error: "Server error" }, { status: 500 })
    }
}
