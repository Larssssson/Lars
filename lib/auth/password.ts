import { randomBytes, randomInt, scrypt, timingSafeEqual } from "node:crypto";

/**
 * Passwörter für den Passwort-Login (DECISIONS D-125). Gespeichert wird nur ein scrypt-Hash
 * im Format scrypt$N$r$p$salt$hash (Base64), nie das Passwort selbst.
 */
const N = 16384;
const R = 8;
const P = 1;
const KEY_LENGTH = 32;
export const MIN_PASSWORD_LENGTH = 8;

function derive(password: string, salt: Buffer, n: number, r: number, p: number): Promise<Buffer> {
  return new Promise((resolve, reject) =>
    scrypt(password.normalize("NFC"), salt, KEY_LENGTH, { N: n, r, p, maxmem: 64 * 1024 * 1024 }, (error, key) => (error ? reject(error) : resolve(key))),
  );
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await derive(password, salt, N, R, P);
  return `scrypt$${N}$${R}$${P}$${salt.toString("base64")}$${key.toString("base64")}`;
}

export async function verifyPassword(password: string, stored: string | null | undefined): Promise<boolean> {
  if (!stored) return false;
  const [scheme, n, r, p, salt, hash] = stored.split("$");
  if (scheme !== "scrypt" || !salt || !hash) return false;
  const expected = Buffer.from(hash, "base64");
  const key = await derive(password, Buffer.from(salt, "base64"), Number(n), Number(r), Number(p));
  return key.length === expected.length && timingSafeEqual(key, expected);
}

// ohne leicht verwechselbare Zeichen (0/O, 1/l/I)
const SETS = ["ABCDEFGHJKLMNPQRSTUVWXYZ", "abcdefghijkmnopqrstuvwxyz", "23456789", "!#%+?@"];

/** Zufallspasswort mit Groß- und Kleinbuchstaben, Ziffer und Sonderzeichen. */
export function generatePassword(length = MIN_PASSWORD_LENGTH): string {
  const all = SETS.join("");
  const chars = SETS.map((set) => set[randomInt(set.length)]!);
  while (chars.length < length) chars.push(all[randomInt(all.length)]!);
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j]!, chars[i]!];
  }
  return chars.join("");
}
