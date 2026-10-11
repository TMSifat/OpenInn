import { http, type Connector } from './types.ts'

const BASE = 'https://api.hostaway.com/v1'

// shortcut: conversation/message field names (listingMapId, isIncoming, insertedOn) are from Hostaway's
// API reference but untested against a live account; verify before relying on autopilot.
export function hostaway(accountId: string, apiKey: string): Connector {
  let token: string | undefined // Hostaway tokens live ~24 months, so one per process is plenty

  async function auth() {
    token ??= (
      await http<{ access_token: string }>(`${BASE}/accessTokens`, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ grant_type: 'client_credentials', client_id: accountId, client_secret: apiKey, scope: 'general' }),
      })
    ).access_token
    return token
  }

  // A revoked token comes back as 401/403: fetch a fresh one and retry once
  async function call<T>(url: string, init: RequestInit = {}): Promise<T> {
    try {
      return await http<T>(url, { ...init, token: await auth() })
    } catch (err) {
      if (!/ 40[13] /.test((err as Error).message)) throw err
      token = undefined
      return http<T>(url, { ...init, token: await auth() })
    }
  }

  return {
    name: 'hostaway',

    async fetchConversations(listingIds) {
      const { result } = await call<{ result: any[] }>(`${BASE}/conversations?limit=20&sortOrder=latestActivityDesc`)
      const convs = result.filter((c) => listingIds.includes(String(c.listingMapId)))
      return Promise.all(
        convs.map(async (c) => {
          const msgs = await call<{ result: any[] }>(`${BASE}/conversations/${c.id}/messages?limit=20`)
          return {
            externalId: String(c.id),
            listingId: String(c.listingMapId),
            guestName: c.recipientName ?? c.guestName ?? 'Guest',
            messages: msgs.result
              .filter((m) => m.body)
              .map((m) => ({
                externalId: String(m.id),
                role: m.isIncoming ? ('guest' as const) : ('host' as const),
                body: m.body,
                createdAt: new Date(m.insertedOn ?? m.date).toISOString(),
              })),
          }
        }),
      )
    },

    async send(conversationId, body) {
      await call(`${BASE}/conversations/${conversationId}/messages`, {
        method: 'POST',
        body: JSON.stringify({ body, communicationType: 'channel' }),
      })
    },
  }
}
