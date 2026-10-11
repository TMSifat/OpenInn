import { createHash } from 'node:crypto'
import { http, type Connector, type IncomingConversation } from './types.ts'

const BASE = 'https://public.api.hospitable.com/v2'

// shortcut: message field names (body, sender_type, created_at) follow Hospitable's public API v2 docs
// but were not tested against a live account; verify with a real token before relying on autopilot.
export function hospitable(token: string): Connector {
  return {
    name: 'hospitable',

    async fetchConversations(listingIds) {
      if (!listingIds.length) return []
      const day = 86_400_000
      const params = new URLSearchParams({
        start_date: new Date(Date.now() - 30 * day).toISOString().slice(0, 10),
        end_date: new Date(Date.now() + 90 * day).toISOString().slice(0, 10),
        include: 'guest,properties',
        per_page: '50',
      })
      for (const id of listingIds) params.append('properties[]', id)
      const { data } = await http<{ data: any[] }>(`${BASE}/reservations?${params}`, { token })

      const out: IncomingConversation[] = []
      for (const r of data) {
        const msgs = await http<{ data: any[] }>(`${BASE}/reservations/${r.id}/messages`, { token })
        out.push({
          externalId: r.id,
          listingId: r.properties?.[0]?.id ?? r.property_id ?? '',
          guestName: [r.guest?.first_name, r.guest?.last_name].filter(Boolean).join(' ') || 'Guest',
          messages: msgs.data.map((m) => ({
            externalId: String(m.id ?? `${r.id}:${m.created_at}:${createHash('sha1').update(m.body ?? '').digest('hex')}`),
            role: m.sender_type === 'guest' ? 'guest' : 'host',
            body: m.body ?? '',
            createdAt: m.created_at,
          })),
        })
      }
      return out
    },

    async send(reservationId, body) {
      await http(`${BASE}/reservations/${reservationId}/messages`, { method: 'POST', token, body: JSON.stringify({ body }) })
    },
  }
}
