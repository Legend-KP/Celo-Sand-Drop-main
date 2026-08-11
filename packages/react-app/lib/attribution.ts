import { toDataSuffix } from "@celo/attribution-tags"
import { concat } from "viem"
import type { Hex } from "viem"

let cachedSuffix: Hex | undefined
let loadPromise: Promise<Hex | undefined> | null = null

function isValidAttributionCode(code: string) {
    return /^[a-z0-9_]{1,32}$/.test(code)
}

async function loadAttributionSuffix(): Promise<Hex | undefined> {
    if (cachedSuffix) return cachedSuffix
    if (loadPromise) return loadPromise

    loadPromise = (async () => {
        try {
            const res = await fetch("/api/attribution-code")
            if (!res.ok) return undefined

            const { code } = await res.json()
            const normalized = code?.trim().toLowerCase()
            if (!normalized || !isValidAttributionCode(normalized)) return undefined

            cachedSuffix = toDataSuffix(normalized) as Hex
            return cachedSuffix
        } catch {
            return undefined
        }
    })()

    return loadPromise
}

export async function getAttributionSuffix(): Promise<Hex | undefined> {
    if (typeof window === "undefined") return undefined
    return loadAttributionSuffix()
}

export async function appendAttributionSuffix(data: Hex): Promise<Hex> {
    const suffix = await getAttributionSuffix()
    if (!suffix) return data
    return concat([data, suffix])
}

export function preloadAttributionSuffix(): void {
    if (typeof window !== "undefined") {
        void loadAttributionSuffix()
    }
}
