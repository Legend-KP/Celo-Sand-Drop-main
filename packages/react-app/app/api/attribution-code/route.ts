import { NextResponse } from "next/server"

export async function GET() {
    const code = process.env.CELO_ATTRIBUTION_CODE?.trim().toLowerCase()

    if (!code || !/^[a-z0-9_]{1,32}$/.test(code)) {
        return NextResponse.json(
            { error: "Attribution code not configured" },
            { status: 503 }
        )
    }

    return NextResponse.json({ code })
}
