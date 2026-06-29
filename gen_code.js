/**
 * gen_code.js — Public opaque code generator (Session 124)
 *
 * Mints the random, non-guessable token that goes in a QR / referral link
 * (the `code` column on the general-purpose `code` table). The 4-byte link is
 * the INTERNAL primary key (via get_next_link.js); this token is the PUBLIC
 * value people scan — kept separate so the enumerable link is never exposed.
 *
 * - Random, from crypto.randomBytes (a real CSPRNG) — never Math.random.
 * - base58 (Bitcoin/IPFS alphabet): drops look-alikes 0/O/I/l, URL-safe,
 *   double-click-selectable.
 * - Default 16 bytes = 128 bits: collisions are astronomically impossible, so
 *   callers never need a uniqueness check/retry. `bytes` is tunable for callers
 *   that want a shorter, human-typable code.
 *
 * RULE: this is the only sanctioned way to build a public code token. Don't
 * hand-roll one off Math.random or a sequence.
 */

import crypto from 'crypto';

// Bitcoin/IPFS base58 alphabet — no 0, O, I, or l.
const B58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

/**
 * base58Encode - Encode a Buffer (big-endian) as a base58 string.
 * Leading zero bytes map to leading '1's, per the standard.
 */
function base58Encode(buf) {
  if (buf.length === 0) return '';

  let zeros = 0;
  while (zeros < buf.length && buf[zeros] === 0) zeros++;

  let num = 0n;
  for (const byte of buf) num = (num << 8n) + BigInt(byte);

  let out = '';
  while (num > 0n) {
    out = B58_ALPHABET[Number(num % 58n)] + out;
    num /= 58n;
  }
  return '1'.repeat(zeros) + out;
}

/**
 * generateCode - Build a random base58 code token.
 * @param {number} bytes - Entropy in bytes (default 16 = 128 bits).
 * @returns {string} base58 token.
 */
export function generateCode(bytes = 16) {
  return base58Encode(crypto.randomBytes(bytes));
}
