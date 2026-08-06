/** Salted SHA-256 password hashing via WebCrypto (browser + node ≥ 18). */

function toHex(buf: ArrayBuffer): string {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export function randomSalt(): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return toHex(bytes.buffer)
}

export async function hashPassword(salt: string, password: string): Promise<string> {
  const data = new TextEncoder().encode(`${salt}:${password.normalize('NFKC')}`)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return toHex(digest)
}

export function randomId(): string {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 20)
}
