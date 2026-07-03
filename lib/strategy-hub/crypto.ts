import "server-only";
import { createCipheriv, randomBytes, scryptSync } from "node:crypto";

/**
 * Szyfrowanie sekretów dostępowych (project_credentials).
 * AES-256-GCM. Klucz z env `STRATEGY_HUB_SECRET_KEY` (dowolny ciąg ≥ 16 znaków).
 * Format zapisu: base64(salt[16] | iv[12] | tag[16] | ciphertext).
 *
 * Reguła bezpieczeństwa: NIGDY nie zapisujemy sekretu w plaintext.
 * Brak klucza w env → rzucamy, zamiast degradować się do plaintextu.
 */

const ALGO = "aes-256-gcm";

function getMasterKey(): string {
  const key = process.env.STRATEGY_HUB_SECRET_KEY;
  if (!key || key.length < 16) {
    throw new Error(
      "STRATEGY_HUB_SECRET_KEY nie jest ustawiony (min. 16 znaków) — nie mogę bezpiecznie zaszyfrować sekretu."
    );
  }
  return key;
}

export function encryptSecret(plaintext: string): string {
  const masterKey = getMasterKey();
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const derivedKey = scryptSync(masterKey, salt, 32);
  const cipher = createCipheriv(ALGO, derivedKey, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([salt, iv, tag, encrypted]).toString("base64");
}

