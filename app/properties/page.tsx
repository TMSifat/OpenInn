import { readProperties } from '../../lib/knowledge.ts'

export const dynamic = 'force-dynamic'

export default function Properties() {
  const { properties, errors } = readProperties()
  return (
    <main className="page">
      <h1>Properties</h1>
      <p className="muted">
        Each property is a Markdown file in <code>properties/</code>. Edit the file to change what the assistant knows, its tone or its mode.
        Changes apply to the next guest message.
      </p>
      {errors.map((e) => (
        <p key={e} className="error" role="alert">Skipped {e}</p>
      ))}
      {properties.map((p) => (
        <article key={p.id} className="card">
          <div className="row">
            <h2>{p.name}</h2>
            <span className={p.mode === 'autopilot' ? 'badge alert' : 'badge'}>{p.mode}</span>
          </div>
          <p className="muted small">
            File: properties/{p.id}.md · Tone: {p.tone} · PMS listing id: {p.listingId || <em>not set (demo only)</em>}
          </p>
          <details>
            <summary className="small">What the assistant knows</summary>
            <pre>{p.knowledge}</pre>
          </details>
        </article>
      ))}
      {!properties.length && <p className="muted">No property files found.</p>}
    </main>
  )
}
