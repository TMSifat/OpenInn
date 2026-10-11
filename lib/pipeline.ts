import { randomUUID } from 'node:crypto'
import { db, type Draft } from './db.ts'
import { loadProperties, findProperty, type Property } from './knowledge.ts'
import { draftReply, type AiDraft, type Turn } from './ai.ts'
import { sensitiveTopic, threshold, notifyHost, envNumber, type Alert } from './escalation.ts'
import { getConnectors, getConnector, type Connector, type IncomingConversation } from './connectors/index.ts'

// Guest messages older than this are imported as history but never answered (avoids replying to old threads on first sync).
const MAX_AGE_MS = 24 * 3_600_000

export type Deps = {
  draft: (property: Property, history: Turn[]) => Promise<AiDraft>
  notify: (alert: Alert) => Promise<void>
}
const defaultDeps: Deps = { draft: (p, h) => draftReply(p, h), notify: notifyHost }

const now = () => new Date().toISOString()
// PMSs send different timestamp formats; store one ISO format so string ordering is time ordering
const iso = (t: string) => (Number.isNaN(Date.parse(t)) ? now() : new Date(t).toISOString())

export async function ingest(connector: Connector, conv: IncomingConversation, properties: Property[], deps = defaultDeps) {
  const property = findProperty(properties, conv.listingId)
  if (!property) return // listing not managed by OpenInn

  const id = `${connector.name}:${conv.externalId}`
  db.prepare(
    `INSERT INTO conversations (id, connector, external_id, property_id, guest_name, updated_at) VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET property_id = excluded.property_id, guest_name = excluded.guest_name`,
  ).run(id, connector.name, conv.externalId, property.id, conv.guestName, now())

  const insert = db.prepare(
    `INSERT INTO messages (conversation_id, external_id, role, body, created_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(external_id) DO NOTHING`,
  )
  const sorted = conv.messages.map((m) => ({ ...m, createdAt: iso(m.createdAt) })).sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  let lastNew: { rowId: number; role: string; createdAt: string } | undefined
  for (const m of sorted) {
    const r = insert.run(id, `${connector.name}:${m.externalId}`, m.role, m.body, m.createdAt)
    lastNew = r.changes ? { rowId: Number(r.lastInsertRowid), role: m.role, createdAt: m.createdAt } : undefined
  }
  // Only act if the newest message in the thread is one we haven't seen before
  if (!lastNew) return
  db.prepare('UPDATE conversations SET updated_at = ? WHERE id = ?').run(now(), id)

  const reason = lastNew.role === 'host' ? 'Host replied directly' : 'Superseded by a newer guest message'
  db.prepare(`UPDATE drafts SET status = 'rejected', reason = ? WHERE conversation_id = ? AND status = 'pending'`).run(reason, id)

  if (lastNew.role === 'guest' && Date.now() - Date.parse(lastNew.createdAt) < MAX_AGE_MS) {
    await respond(id, lastNew.rowId, property, deps)
  }
}

async function respond(conversationId: string, messageId: number, property: Property, deps: Deps) {
  const history = (
    db.prepare('SELECT role, body FROM messages WHERE conversation_id = ? ORDER BY created_at DESC, id DESC LIMIT 20').all(conversationId) as Turn[]
  ).reverse()
  const guestMessage = history.at(-1)!.body
  // Everything the guest said since the host last replied, so "any update?" after a complaint still escalates
  const unanswered = history.slice(history.findLastIndex((t) => t.role === 'host') + 1).map((t) => t.body).join('\n')

  let ai: AiDraft
  try {
    ai = await deps.draft(property, history)
  } catch (err) {
    console.error('[openinn] AI draft failed:', (err as Error).message) // not the whole error: it contains the guest's messages
    ai = { reply: '', confidence: 0, needsHost: true, reason: `AI error: ${(err as Error).message}`.slice(0, 300) }
  }
  const sensitive = sensitiveTopic(unanswered)
  const escalate = Boolean(sensitive) || ai.needsHost || ai.confidence < threshold() || !ai.reply.trim()
  const reason = sensitive ?? ai.reason

  const draftId = Number(
    db.prepare(
      `INSERT INTO drafts (conversation_id, message_id, body, confidence, status, escalated, reason, created_at) VALUES (?, ?, ?, ?, 'pending', ?, ?, ?)`,
    ).run(conversationId, messageId, ai.reply, ai.confidence, escalate ? 1 : 0, reason, now()).lastInsertRowid,
  )

  if (!escalate && property.mode === 'autopilot') {
    try {
      return await sendDraft(draftId)
    } catch (err) {
      console.error('[openinn] autopilot send failed:', (err as Error).message)
      db.prepare('UPDATE drafts SET escalated = 1, reason = ? WHERE id = ?').run(`Send failed: ${(err as Error).message}`.slice(0, 300), draftId)
    }
  }
  const draft = db.prepare('SELECT * FROM drafts WHERE id = ?').get(draftId) as Draft
  // Escalations always alert; in draft mode every new draft does too, since it waits on the host
  if (draft.escalated || property.mode === 'draft') {
    const conv = db.prepare('SELECT guest_name FROM conversations WHERE id = ?').get(conversationId) as { guest_name: string }
    await deps.notify({
      property: property.name,
      guest: conv.guest_name,
      message: guestMessage,
      draft: draft.body,
      reason: draft.escalated ? (draft.reason ?? '') : 'Draft ready for your approval',
      link: `${process.env.PUBLIC_URL ?? 'http://localhost:3000'}/?c=${encodeURIComponent(conversationId)}`,
    })
  }
}

export async function sendDraft(draftId: number, body?: string) {
  const draft = db.prepare('SELECT * FROM drafts WHERE id = ?').get(draftId) as Draft | undefined
  if (!draft || draft.status !== 'pending') throw new Error('Draft is no longer pending')
  const text = (body ?? draft.body).trim()
  if (!text) throw new Error('Reply is empty')
  // Claim the draft atomically so a double click or a racing autopilot can't message the guest twice
  if (!db.prepare(`UPDATE drafts SET status = 'sending' WHERE id = ? AND status = 'pending'`).run(draftId).changes) {
    throw new Error('Draft is no longer pending')
  }
  const conv = db.prepare('SELECT connector, external_id FROM conversations WHERE id = ?').get(draft.conversation_id) as { connector: string; external_id: string }
  try {
    await getConnector(conv.connector).send(conv.external_id, text)
  } catch (err) {
    db.prepare(`UPDATE drafts SET status = 'pending' WHERE id = ?`).run(draftId)
    throw err
  }
  db.prepare(`UPDATE drafts SET status = 'sent', body = ? WHERE id = ?`).run(text, draftId)
  // Real PMS connectors return the sent message on the next poll; the demo connector has no PMS, so store it now
  if (conv.connector === 'demo') {
    db.prepare(`INSERT INTO messages (conversation_id, external_id, role, body, created_at) VALUES (?, ?, 'host', ?, ?)`).run(
      draft.conversation_id, `demo:${randomUUID()}`, text, now(),
    )
  }
}

export function rejectDraft(draftId: number) {
  db.prepare(`UPDATE drafts SET status = 'rejected', reason = 'Rejected by host' WHERE id = ? AND status = 'pending'`).run(draftId)
}

export async function simulateGuest(propertyId: string, guestName: string, body: string, deps = defaultDeps) {
  const properties = loadProperties()
  const property = properties.find((p) => p.id === propertyId)
  if (!property) throw new Error(`Unknown property ${propertyId}`)
  const externalId = `${property.id}-${encodeURIComponent(guestName.trim().toLowerCase())}`
  await ingest(
    getConnector('demo'),
    {
      externalId,
      listingId: property.id,
      guestName,
      messages: [{ externalId: randomUUID(), role: 'guest', body, createdAt: now() }],
    },
    properties,
    deps,
  )
  return `demo:${externalId}`
}

export async function pollOnce(deps = defaultDeps) {
  const properties = loadProperties()
  const listingIds = properties.map((p) => p.listingId).filter(Boolean)
  for (const connector of getConnectors()) {
    try {
      for (const conv of await connector.fetchConversations(listingIds)) await ingest(connector, conv, properties, deps)
    } catch (err) {
      console.error(`[openinn] ${connector.name} poll failed:`, err)
    }
  }
}

export function startPoller() {
  const g = globalThis as { openinnPoller?: boolean }
  if (g.openinnPoller) return
  g.openinnPoller = true
  const seconds = Math.max(10, envNumber('POLL_INTERVAL_SECONDS', 60))
  let running = false
  const tick = async () => {
    if (running) return // a slow AI call must not cause overlapping polls
    running = true
    try {
      await pollOnce()
    } catch (err) {
      console.error('[openinn] poll failed:', err)
    } finally {
      running = false
    }
  }
  setInterval(tick, seconds * 1000)
  void tick()
  console.log(`[openinn] polling every ${seconds}s with connectors: ${getConnectors().map((c) => c.name).join(', ')}`)
}
