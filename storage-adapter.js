import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

export class JsonStorage {
  constructor(filePath) {
    this.filePath = filePath;
  }

  async load(fallback) {
    try {
      return { ...fallback, ...JSON.parse(await fs.readFile(this.filePath, 'utf8')) };
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      await this.save(fallback);
      return fallback;
    }
  }

  async save(db) {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    const temp = `${this.filePath}.tmp`;
    await fs.writeFile(temp, JSON.stringify(db, null, 2), 'utf8');
    await fs.rename(temp, this.filePath);
  }
}

export class NeonStorage {
  constructor(connectionString) {
    this.connectionString = connectionString;
  }

  async init() {
    const { neon } = await import('@neondatabase/serverless');
    this.sql = neon(this.connectionString);
    await this.sql`
      CREATE TABLE IF NOT EXISTS m3a_cortex_core_state (
        key text PRIMARY KEY,
        value jsonb NOT NULL,
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `;
  }

  async load(fallback) {
    if (!this.sql) await this.init();
    const rows = await this.sql`
      SELECT value FROM m3a_cortex_core_state WHERE key = 'default'
    `;
    return rows[0]?.value ? { ...fallback, ...rows[0].value } : fallback;
  }

  async save(db) {
    if (!this.sql) await this.init();
    await this.sql`
      INSERT INTO m3a_cortex_core_state (key, value, updated_at)
      VALUES ('default', ${JSON.stringify(db)}::jsonb, now())
      ON CONFLICT (key) DO UPDATE
      SET value = EXCLUDED.value, updated_at = now()
    `;
  }
}

export function sha256(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}
