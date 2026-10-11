
import './setup.ts'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { MockLanguageModelV4 } from 'ai/test'
import { db, type Draft } from '../lib/db.ts'
import { ingest, sendDraft, rejectDraft, type Deps } from '../lib/pipeline.ts'
import { draftReply } from '../lib/ai.ts'
import type { Connector, IncomingConversation } from '../lib/connectors/index.ts'
import type { Property } from '../lib/knowledge.ts'
import type { Alert } from '../lib/escalation.ts'

const property = (mode: Property['mode']): Property => ({ id: 'p1', name: 'Loft', tone: 'friendly', mode, listingId: 'L1', knowledge: 'Wi-Fi: loft123' })

function harness(ai: { reply: string; confidence: number; needsHost: boolean; reason: string } | Error) {
  const sent: string[] = []
  const alerts: Alert[] = []
  const connector: Connector = { name: 'fake', fetchConversations: async () => [], send: async (_id, body) => void sent.push(body) }
  const deps: Deps = {
    draft: async () => {
      if (ai instanceof Error) throw ai
      return ai
    },
    notify: async (a) => void alerts.push(a),
  }
  return { sent, alerts, connector, deps }
}

let n = 0
const conv = (body: string, role: 'guest' | 'host' = 'guest', createdAt = new Date().toISOString()): IncomingConversation => ({
  externalId: `c${++n}`,
  listingId: 'L1',
  guestName: 'Alex',
  messages: [{ externalId: `m${n}`, role, body, createdAt }],
})
const draftsFor = (externalId: string) => db.prepare('SELECT * FROM drafts WHERE conversation_id = ?').all(`fake:${externalId}`) as Draft[]

// Connector lookup in sendDraft goes through getConnector; register the fake on the shared cache
function register(connector: Connector) {
  ;(globalThis as any).openinnConnectors = [connector]
}

test('draft mode: confident reply is queued, not sent, host told a draft is ready', async () => {
  const h = harness({ reply: 'Wi-Fi is loft123', confidence: 0.95, needsHost: false, reason: 'In guide' })
  const c = conv('Wifi password?')
  await ingest(h.connector, c, [property('draft')], h.deps)
  const [d] = draftsFor(c.externalId)
  assert.equal(d.status, 'pending')
  assert.equal(d.escalated, 0)
  assert.equal(h.sent.length, 0)
  assert.equal(h.alerts.length, 1)
  assert.match(h.alerts[0].reason, /Draft ready/)
})

test('autopilot: confident reply is sent', async () => {
  const h = harness({ reply: 'Wi-Fi is loft123', confidence: 0.95, needsHost: false, reason: 'In guide' })
  register(h.connector)
  const c = conv('Wifi password?')
  await ingest(h.connector, c, [property('autopilot')], h.deps)
  assert.deepEqual(h.sent, ['Wi-Fi is loft123'])
  assert.equal(draftsFor(c.externalId)[0].status, 'sent')
})

test('autopilot: low confidence escalates and does not send', async () => {
  const h = harness({ reply: 'Maybe?', confidence: 0.4, needsHost: false, reason: 'Not in guide' })
  register(h.connector)
  const c = conv('Is there a hot tub?')
  await ingest(h.connector, c, [property('autopilot')], h.deps)
  assert.equal(h.sent.length, 0)
  assert.equal(h.alerts.length, 1)
  assert.equal(draftsFor(c.externalId)[0].escalated, 1)
})

test('autopilot: sensitive topic escalates even at high confidence', async () => {
  const h = harness({ reply: 'Sure, refund done', confidence: 0.99, needsHost: false, reason: '' })
  register(h.connector)
  const c = conv('I want a refund')
  await ingest(h.connector, c, [property('autopilot')], h.deps)
  assert.equal(h.sent.length, 0)
  assert.match(h.alerts[0].reason, /refund/)
})

test('AI failure escalates with an empty draft instead of crashing', async () => {
  const h = harness(new Error('rate limited'))
  const c = conv('Hello?')
  await ingest(h.connector, c, [property('autopilot')], h.deps)
  const [d] = draftsFor(c.externalId)
  assert.equal(d.escalated, 1)
  assert.match(d.reason!, /rate limited/)
  assert.equal(h.alerts.length, 1)
})

test('re-polling the same message does not create a second draft', async () => {
  const h = harness({ reply: 'Hi', confidence: 0.9, needsHost: false, reason: '' })
  const c = conv('Hi there')
  await ingest(h.connector, c, [property('draft')], h.deps)
  await ingest(h.connector, c, [property('draft')], h.deps)
  assert.equal(draftsFor(c.externalId).length, 1)
})

test('old guest messages and unknown listings are not answered', async () => {
  const h = harness({ reply: 'Hi', confidence: 0.9, needsHost: false, reason: '' })
  const old = conv('Old message', 'guest', new Date(Date.now() - 3 * 86_400_000).toISOString())
  await ingest(h.connector, old, [property('draft')], h.deps)
  assert.equal(draftsFor(old.externalId).length, 0)
  const other = { ...conv('Hi'), listingId: 'unknown' }
  await ingest(h.connector, other, [property('draft')], h.deps)
  assert.equal(draftsFor(other.externalId).length, 0)
})

test('host replying in the PMS dismisses the pending draft', async () => {
  const h = harness({ reply: 'Hi', confidence: 0.9, needsHost: false, reason: '' })
  const c = conv('Question')
  await ingest(h.connector, c, [property('draft')], h.deps)
  const later = new Date(Date.now() + 1000).toISOString()
  await ingest(h.connector, { ...c, messages: [...c.messages, { externalId: 'reply1', role: 'host', body: 'Answered', createdAt: later }] }, [property('draft')], h.deps)
  assert.equal(draftsFor(c.externalId)[0].status, 'rejected')
})

test('host can edit and send, or reject; sent drafts cannot be resent', async () => {
  const h = harness({ reply: 'Draft', confidence: 0.9, needsHost: false, reason: '' })
  register(h.connector)
  const c1 = conv('A')
  await ingest(h.connector, c1, [property('draft')], h.deps)
  const d1 = draftsFor(c1.externalId)[0]
  await sendDraft(d1.id, 'Edited reply')
  assert.deepEqual(h.sent, ['Edited reply'])
  await assert.rejects(sendDraft(d1.id), /no longer pending/)

  const c2 = conv('B')
  await ingest(h.connector, c2, [property('draft')], h.deps)
  const d2 = draftsFor(c2.externalId)[0]
  rejectDraft(d2.id)
  assert.equal(draftsFor(c2.externalId)[0].status, 'rejected')
  await assert.rejects(sendDraft(d2.id), /no longer pending/)
})

test('draftReply parses structured output from the model', async () => {
  const json = JSON.stringify({ reply: 'Wi-Fi is loft123', confidence: 0.9, needsHost: false, reason: 'In guide' })
  const model = new MockLanguageModelV4({
    doGenerate: async () => ({
      content: [{ type: 'text', text: json }],
      finishReason: { unified: 'stop', raw: undefined },
      usage: {
        inputTokens: { total: 1, noCache: 1, cacheRead: undefined, cacheWrite: undefined },
        outputTokens: { total: 1, text: 1, reasoning: undefined },
      },
      warnings: [],
    }),
  })
  const out = await draftReply(property('draft'), [{ role: 'guest', body: 'Wifi?' }], model)
  assert.equal(out.reply, 'Wi-Fi is loft123')
})

test('double submit sends the reply only once', async () => {
  const h = harness({ reply: 'Draft', confidence: 0.9, needsHost: false, reason: '' })
  const slow: Connector = { ...h.connector, send: async (_id, body) => void (await new Promise((r) => setTimeout(r, 20)), h.sent.push(body)) }
  register(slow)
  const c = conv('Q')
  await ingest(slow, c, [property('draft')], h.deps)
  const d = draftsFor(c.externalId)[0]
  const results = await Promise.allSettled([sendDraft(d.id, 'X'), sendDraft(d.id, 'X')])
  assert.deepEqual(h.sent, ['X'])
  assert.equal(results.filter((r) => r.status === 'rejected').length, 1)
})

test('failed send returns the draft to pending so the host can retry', async () => {
  const h = harness({ reply: 'Draft', confidence: 0.9, needsHost: false, reason: '' })
  const failing: Connector = { ...h.connector, send: async () => { throw new Error('PMS down') } }
  register(failing)
  const c = conv('Q')
  await ingest(failing, c, [property('draft')], h.deps)
  const d = draftsFor(c.externalId)[0]
  await assert.rejects(sendDraft(d.id), /PMS down/)
  assert.equal(draftsFor(c.externalId)[0].status, 'pending')
})

test('empty CONFIDENCE_THRESHOLD falls back to the default instead of disabling the check', async () => {
  process.env.CONFIDENCE_THRESHOLD = ''
  try {
    const h = harness({ reply: 'Guess', confidence: 0.1, needsHost: false, reason: '' })
    register(h.connector)
    await ingest(h.connector, conv('Is there a sauna?'), [property('autopilot')], h.deps)
    assert.equal(h.sent.length, 0)
  } finally {
    process.env.CONFIDENCE_THRESHOLD = '0.8'
  }
})

test('mixed timestamp formats are ordered by real time', async () => {
  const h = harness({ reply: 'Hi', confidence: 0.9, needsHost: false, reason: '' })
  const t = Date.now()
  const c: IncomingConversation = {
    externalId: `tz${++n}`, listingId: 'L1', guestName: 'Alex',
    messages: [
      // host at t-2h written in +02:00, guest at t-1h in UTC: the guest message is newer
      { externalId: `h${n}`, role: 'host', body: 'Welcome', createdAt: new Date(t - 7_200_000 + 7_200_000).toISOString().replace('Z', '+02:00') },
      { externalId: `g${n}`, role: 'guest', body: 'Thanks, where is parking?', createdAt: new Date(t - 3_600_000).toISOString() },
    ],
  }
  await ingest(h.connector, c, [property('draft')], h.deps)
  assert.equal(draftsFor(c.externalId).length, 1)
})

test('a vague follow-up to an unanswered complaint still escalates', async () => {
  const h = harness({ reply: 'On it!', confidence: 0.99, needsHost: false, reason: '' })
  register(h.connector)
  const t = Date.now()
  const c: IncomingConversation = {
    externalId: `f${++n}`, listingId: 'L1', guestName: 'Alex',
    messages: [
      { externalId: `a${n}`, role: 'guest', body: 'There is no hot water', createdAt: new Date(t - 60_000).toISOString() },
      { externalId: `b${n}`, role: 'guest', body: 'Any update?', createdAt: new Date(t).toISOString() },
    ],
  }
  await ingest(h.connector, c, [property('autopilot')], h.deps)
  assert.equal(h.sent.length, 0)
  assert.equal(draftsFor(c.externalId)[0].escalated, 1)
})
