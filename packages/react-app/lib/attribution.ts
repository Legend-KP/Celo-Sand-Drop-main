import { codeFromHostname, toDataSuffix } from "@celo/attribution-tags"
import { concat } from "viem"
import type { Hex } from "viem"

const ASSIGNED_TAG_CODE = process.env.NEXT_PUBLIC_CELO_ATTRIBUTION_CODE?.trim().toLowerCase()

let cachedSuffix: Hex | undefined
let warnedAboutInvalidCode = false

function isValidAttributionCode(code: string) {
  return /^[a-z0-9_]{1,32}$/.test(code)
}

export function getAttributionSuffix(): Hex | undefined {
  if (typeof window === "undefined") return undefined
  if (cachedSuffix) return cachedSuffix

  try {
    const codes = new Set<string>()
    codes.add(codeFromHostname(window.location.hostname))

    if (ASSIGNED_TAG_CODE) {
      if (isValidAttributionCode(ASSIGNED_TAG_CODE)) {
        codes.add(ASSIGNED_TAG_CODE)
      } else if (!warnedAboutInvalidCode) {
        warnedAboutInvalidCode = true
        console.warn("NEXT_PUBLIC_CELO_ATTRIBUTION_CODE is invalid and will be ignored.")
      }
    }

    cachedSuffix = toDataSuffix([...codes]) as Hex
    return cachedSuffix
  } catch {
    return undefined
  }
}

export function appendAttributionSuffix(data: Hex): Hex {
  const suffix = getAttributionSuffix()
  if (!suffix) return data
  return concat([data, suffix])
}
