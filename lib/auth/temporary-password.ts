import { randomBytes } from "node:crypto"

/**
 * Temporary login password generator (Sprint 7.5.2A).
 *
 * Isolated from Auth, employees, and provisioning. Callers in 7.5.2B/C
 * must not persist, log, or store the return value beyond one-shot delivery.
 *
 * Alphabet omits visually ambiguous glyphs: 0/O/o and 1/l/I/i.
 * Length 16 over 54 symbols ≈ 16 × log2(54) ≈ 92 bits.
 * Bytes are mapped with rejection sampling so modulo bias is not introduced.
 */
export const TEMPORARY_PASSWORD_ALPHABET =
  "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789"

export const TEMPORARY_PASSWORD_LENGTH = 16

const ALPHABET_SIZE = TEMPORARY_PASSWORD_ALPHABET.length
const MAX_UNBIASED_BYTE = 256 - (256 % ALPHABET_SIZE)

export function generateTemporaryPassword(): string {
  let output = ""

  while (output.length < TEMPORARY_PASSWORD_LENGTH) {
    const bytes = randomBytes(TEMPORARY_PASSWORD_LENGTH - output.length + 8)
    for (const byte of bytes) {
      if (byte >= MAX_UNBIASED_BYTE) continue
      output += TEMPORARY_PASSWORD_ALPHABET[byte % ALPHABET_SIZE]
      if (output.length === TEMPORARY_PASSWORD_LENGTH) break
    }
  }

  return output
}
