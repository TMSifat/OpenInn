import { db, type Draft } from '../lib/db.ts'
import { readProperties } from '../lib/knowledge.ts'
import { sendAction, rejectAction, simulateAction } from './actions.ts'

export const dynamic = 'force-dynamic'

type ConvRow = { id: string; connector: string; property_id: string; guest_name: string; pending: number; escalated: number | null; last: string | null }
type Msg = { id: number; role: 'guest' | 'host'; body: string; created_at: string }

const time = (iso: string) => new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })

export default async function Inbox({ searchParams }: { searchParams: Promise<{ c?: string; error?: string }> }) {
  const { c, error } = await searchParams
  const { properties, errors } = readProperties()
  const propName = (id: string) => properties.find((p) => p.id === id)?.name ?? id

  const conversations = db
    .prepare(
      `SELECT c.*,
         (SELECT COUNT(*) FROM drafts d WHERE d.conversation_id = c.id AND d.status = 'pending') AS pending,
         (SELECT MAX(escalated) FROM drafts d WHERE d.conversation_id = c.id AND d.status = 'pending') AS escalated,
         (SELECT body FROM messages m WHERE m.conversation_id = c.id ORDER BY created_at DESC, id DESC LIMIT 1) AS last
       FROM conversations c ORDER BY pending DESC, updated_at DESC LIMIT 200`,
    )
    .all() as ConvRow[]

  const selected = conversations.find((x) => x.id === c) ?? conversations[0]
  const messages = selected
    ? (db.prepare('SELECT id, role, body, created_at FROM messages WHERE conversation_id = ? ORDER BY created_at, id').all(selected.id) as Msg[])
    : []
  const drafts = selected
    ? (db.prepare('SELECT * FROM drafts WHERE conversation_id = ? ORDER BY id DESC').all(selected.id) as Draft[])
    : []
  const pending = drafts.find((d) => d.status === 'pending')

  return (
    <main className="inbox">
      <aside>
        <details className="card simulate" open={!conversations.length}>
          <summary>Simulate a guest message</summary>
          <form action={simulateAction}>
            <label>
              Property
              <select name="property" required>
                {properties.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </label>
            <label>
              Guest name
              <input name="guest" placeholder="Alex" />
            </label>
            <label>
              Message
              <textarea name="body" rows={3} required placeholder="Hi! What's the Wi-Fi password?" />
            </label>
            <button type="submit">Send as guest</button>
          </form>
        </details>

        <ul className="convs">
          {conversations.map((x) => (
            <li key={x.id}>
              <a href={`/?c=${encodeURIComponent(x.id)}`} aria-current={x.id === selected?.id ? 'page' : undefined}>
                <span className="row">
                  <strong>{x.guest_name}</strong>
                  {x.pending > 0 && <span className={x.escalated ? 'badge alert' : 'badge'}>{x.escalated ? 'Needs you' : 'Draft'}</span>}
                </span>
                <span className="muted small">{propName(x.property_id)} · {x.connector}</span>
                <span className="preview">{x.last}</span>
              </a>
            </li>
          ))}
          {!conversations.length && <li className="muted empty">No conversations yet.</li>}
        </ul>
      </aside>

      <section className="thread">
        {error && <p className="error" role="alert">{error}</p>}
        {errors.map((e) => (
          <p key={e} className="error" role="alert">Skipped {e}</p>
        ))}
        {!selected ? (
          <p className="muted empty">Guest conversations appear here. Use “Simulate a guest message” to try it out.</p>
        ) : (
          <>
            <h1>
              {selected.guest_name} <span className="muted small">· {propName(selected.property_id)}</span>
            </h1>
            <ol className="messages">
              {messages.map((m) => (
                <li key={m.id} className={m.role}>
                  <p>{m.body}</p>
                  <time className="muted small">{m.role === 'guest' ? 'Guest' : 'You'} · {time(m.created_at)}</time>
                </li>
              ))}
            </ol>

            {pending && (
              <form className={`card draft ${pending.escalated ? 'escalated' : ''}`} action={sendAction}>
                <div className="row">
                  <strong>{pending.escalated ? 'Needs your attention' : 'Suggested reply'}</strong>
                  <span className="muted small">confidence {Math.round(pending.confidence * 100)}%</span>
                </div>
                {pending.reason && <p className="muted small">{pending.reason}</p>}
                <input type="hidden" name="draft" value={pending.id} />
                <input type="hidden" name="conversation" value={selected.id} />
                <label className="sr-only" htmlFor="reply">Reply</label>
                <textarea id="reply" name="body" rows={7} defaultValue={pending.body} placeholder="Write your reply…" />
                <div className="row">
                  <button type="submit">Send reply</button>
                  <button type="submit" formAction={rejectAction} className="secondary">Dismiss</button>
                </div>
              </form>
            )}

            {drafts.some((d) => d.status !== 'pending') && (
              <details className="history">
                <summary className="muted small">Draft history</summary>
                <ul>
                  {drafts.filter((d) => d.status !== 'pending').map((d) => (
                    <li key={d.id} className="small">
                      <span className={`badge ${d.status}`}>{d.status}</span> {d.body || <em>(empty)</em>}
                      {d.reason && <span className="muted"> — {d.reason}</span>}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </>
        )}
      </section>
    </main>
  )
}
