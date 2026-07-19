/**
 * document_storage.js — the Document Repository's storage black box.
 *
 * The card table (document) never knows where file bytes physically live;
 * it holds an opaque locator ("<backend>:<key>") and this module resolves
 * it. Day one there is ONE backend: 'db' — bytes in the document_file
 * table, deliberately separate from the card so card queries never drag
 * file content. When the production encrypted object storage is selected
 * (vendor + BAA, Erica's spec §9), it becomes a second backend here plus a
 * migration that walks locators and moves bytes — nothing above this
 * module changes, which is the whole point.
 *
 * Platform-shared file: generic, no tenant or vertical references.
 */
import crypto from "crypto";

// Stopgap-backend size cap. The db backend is demo-grade by design — every
// snapshot and backup carries these bytes, so uploads stay small until the
// real object storage lands. Overridable per tenant via sysparm
// (key 'document_storage', category 'limit', code 'max_mb').
export const MAX_MB_DEFAULT = 10;

const backends = {
  db: {
    async put(db, tenantId, buffer) {
      const r = await db.query(
        `INSERT INTO document_file (tenant_id, bytes) VALUES ($1, $2) RETURNING file_id`,
        [tenantId, buffer]
      );
      return `db:${r.rows[0].file_id}`;
    },
    async get(db, locator) {
      const fileId = parseInt(locator.slice(3), 10);
      const r = await db.query(`SELECT bytes FROM document_file WHERE file_id = $1`, [fileId]);
      if (!r.rows.length) {
        throw new Error(`Document storage: no stored file behind locator ${locator} — the card points at bytes that are gone`);
      }
      return r.rows[0].bytes;
    }
  }
};

// The active backend for NEW files. This is the config swap point: when
// production storage exists, new files go there while old locators keep
// resolving through whatever backend their prefix names.
const ACTIVE_BACKEND = "db";

export function checksumOf(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

export async function putFile(db, tenantId, buffer) {
  const locator = await backends[ACTIVE_BACKEND].put(db, tenantId, buffer);
  return { locator, checksum: checksumOf(buffer), size: buffer.length };
}

export async function getFile(db, locator, expectedChecksum) {
  const prefix = String(locator).split(":")[0];
  const backend = backends[prefix];
  if (!backend) {
    throw new Error(`Document storage: unknown backend "${prefix}" in locator — was a backend removed while its files still exist?`);
  }
  const buffer = await backend.get(db, locator);
  if (expectedChecksum) {
    const actual = checksumOf(buffer);
    if (actual !== expectedChecksum) {
      throw new Error(`Document storage: integrity check FAILED for locator ${locator} — stored bytes no longer match the filed checksum`);
    }
  }
  return buffer;
}
