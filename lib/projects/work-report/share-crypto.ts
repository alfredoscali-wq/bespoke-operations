import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  scrypt,
  timingSafeEqual,
  type ScryptOptions,
} from "node:crypto"

const TOKEN_BYTES = 32
const PASSWORD_KEYLEN = 64
const SCRYPT_N = 16384
const SCRYPT_R = 8
const SCRYPT_P = 1
const AES_IV_BYTES = 12

function scryptAsync(
  password: string,
  salt: Buffer,
  keylen: number,
  options: ScryptOptions
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, keylen, options, (error, derivedKey) => {
      if (error) {
        reject(error)
        return
      }
      resolve(derivedKey)
    })
  })
}

export function createProjectWorkReportShareToken(): string {
  return randomBytes(TOKEN_BYTES).toString("base64url")
}

export function hashProjectWorkReportShareToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex")
}

export function resolveProjectWorkReportShareSecret(
  env: NodeJS.ProcessEnv = process.env
): string | null {
  const dedicated = env.BESPOKE_REPORT_SHARE_SECRET?.trim()
  if (dedicated) return dedicated
  const cache = env.BESPOKE_AUTH_USER_CACHE_SECRET?.trim()
  if (cache) return cache
  const serviceRole = env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (serviceRole) return serviceRole
  return null
}

function aesKeyFromSecret(secret: string): Buffer {
  return createHash("sha256").update(secret, "utf8").digest()
}

export function encryptProjectWorkReportShareToken(
  token: string,
  secret: string
): string {
  const iv = randomBytes(AES_IV_BYTES)
  const cipher = createCipheriv("aes-256-gcm", aesKeyFromSecret(secret), iv)
  const encrypted = Buffer.concat([
    cipher.update(token, "utf8"),
    cipher.final(),
  ])
  const tag = cipher.getAuthTag()
  return [
    "v1",
    iv.toString("base64url"),
    encrypted.toString("base64url"),
    tag.toString("base64url"),
  ].join("$")
}

export function decryptProjectWorkReportShareToken(
  ciphertext: string,
  secret: string
): string | null {
  const parts = ciphertext.split("$")
  if (parts.length !== 4 || parts[0] !== "v1") {
    return null
  }

  try {
    const iv = Buffer.from(parts[1], "base64url")
    const encrypted = Buffer.from(parts[2], "base64url")
    const tag = Buffer.from(parts[3], "base64url")
    const decipher = createDecipheriv(
      "aes-256-gcm",
      aesKeyFromSecret(secret),
      iv
    )
    decipher.setAuthTag(tag)
    return Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]).toString("utf8")
  } catch {
    return null
  }
}

export async function hashProjectWorkReportSharePassword(
  password: string
): Promise<string> {
  const salt = randomBytes(16)
  const derived = await scryptAsync(password, salt, PASSWORD_KEYLEN, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
  })
  return [
    "scrypt",
    `n=${SCRYPT_N}`,
    `r=${SCRYPT_R}`,
    `p=${SCRYPT_P}`,
    salt.toString("base64url"),
    derived.toString("base64url"),
  ].join("$")
}

export async function verifyProjectWorkReportSharePassword(
  password: string,
  storedHash: string | null | undefined
): Promise<boolean> {
  if (!storedHash) {
    return false
  }

  const parts = storedHash.split("$")
  if (parts.length !== 6 || parts[0] !== "scrypt") {
    return false
  }

  const n = Number(parts[1]?.replace("n=", ""))
  const r = Number(parts[2]?.replace("r=", ""))
  const p = Number(parts[3]?.replace("p=", ""))
  if (!Number.isFinite(n) || !Number.isFinite(r) || !Number.isFinite(p)) {
    return false
  }

  try {
    const salt = Buffer.from(parts[4], "base64url")
    const expected = Buffer.from(parts[5], "base64url")
    const actual = await scryptAsync(password, salt, expected.length, {
      N: n,
      r,
      p,
    })
    if (actual.length !== expected.length) {
      return false
    }
    return timingSafeEqual(actual, expected)
  } catch {
    return false
  }
}

export function timingSafeStringEqual(left: string, right: string): boolean {
  const leftBuf = Buffer.from(left)
  const rightBuf = Buffer.from(right)
  if (leftBuf.length !== rightBuf.length) {
    return false
  }
  return timingSafeEqual(leftBuf, rightBuf)
}
