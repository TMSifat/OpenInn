import { DatabaseSync } from 'node:sqlite'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'

const path = process.env.DATABASE_PATH ?? './data/openinn.db'
if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true })

export const db = new DatabaseSync(path)

db.exec(`
  PRAGMA journal_mode = WAL;
  CREATE TABLE IF NOT EXISTS conversations (
    id TEXT PRIMARY KEY,            -- "<connector>:<externalId>"
    connector TEXT NOT NULL,
    external_id TEXT NOT NULL,
    property_id TEXT,
    guest_name TEXT,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    conversation_id TEXT NOT NULL REFERENCES conversations(id),
    external_id TEXT UNIQUE,
    role TEXT NOT NULL CHECK (role IN ('guest', 'host')),
    body TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS drafts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    conversation_id TEXT NOT NULL REFERENCES conversations(id),
    message_id INTEGER NOT NULL UNIQUE REFERENCES messages(id),
    body TEXT NOT NULL,
    confidence REAL NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('pending', 'sending', 'sent', 'rejected')),
    escalated INTEGER NOT NULL DEFAULT 0,
    reason TEXT,
    created_at TEXT NOT NULL
  );
`)

// A crash mid-send leaves a draft in 'sending'; hand it back to the host, who checks the PMS before resending
db.prepare(`UPDATE drafts SET status = 'pending', escalated = 1, reason = 'Sending was interrupted. Check your PMS before resending.' WHERE status = 'sending'`).run()

export type Draft = {
  id: number
  conversation_id: string
  message_id: number
  body: string
  confidence: number
  status: 'pending' | 'sending' | 'sent' | 'rejected'
  escalated: number
  reason: string | null
  created_at: string
}
