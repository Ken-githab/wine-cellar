import { pbkdf2Sync, randomBytes, timingSafeEqual } from "crypto";

const ITERATIONS = 310000;
const KEY_LENGTH = 32;
const DIGEST = "sha256";

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = pbkdf2Sync(password, salt, ITERATIONS, KEY_LENGTH, DIGEST).toString("hex");
  return `pbkdf2_${DIGEST}$${ITERATIONS}$${salt}$${hash}`;
}

export function verifyPassword(password: string, stored: string) {
  const [algorithm, iterations, salt, hash] = stored.split("$");
  if (algorithm !== `pbkdf2_${DIGEST}` || !iterations || !salt || !hash) return false;

  const expected = Buffer.from(hash, "hex");
  const actual = pbkdf2Sync(password, salt, Number(iterations), expected.length, DIGEST);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
