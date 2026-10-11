import { http, type Connector } from './types.ts'

const BASE = 'https://open-api.guesty.com'
const REPLY_CHANNELS = ['airbnb2', 'platform', 'email', 'sms', 'whatsapp']

export function guesty(clientId: string, clientSecret: string): Connector {
  // shortcut: token cached in memory only; Guesty allows 5 tokens per 24h, so frequent restarts can hit
  // that limit. Persist the token to the database if that becomes a problem.
  let token: { value: string; expires: number } | undefined

  async function auth() {
    if (!token || token.expires < Date.now() + 300_000) {
      const r = await http<{ access_token: string; expires_in: number }>(`${BASE}/oauth2/token`, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ grant_type: 'client_credentials', scope: 'open-api', client_id: clientId, client_secret: clientSecret }),
      })
      token = { value: r.access_token, expires: Date.now() + r.expires_in * 1000 }
    }
    return token.value
  }

  async function guestPosts(conversationId: string): Promise<any[]> {
    const { data } = await http<{ data: { posts: any[] } }>(`${BASE}/v1/communication/conversations/${conversationId}/posts`, { token: await auth() })
    return data.posts
      .filter((p) => p.body && REPLY_CHANNELS.includes(p.module?.type)) // skip internal notes and logs
      .reverse() // API returns newest first
  }

  return {
    name: 'guesty',

    async fetchConversations(listingIds) {
      const t = await auth()
      const { data } = await http<{ data: { conversations: any[] } }>(`${BASE}/v1/communication/conversations?limit=20`, { token: t })
      const convs = data.conversations.filter((c) => listingIds.includes(c.meta?.reservations?.[0]?.listing?._id))
      return Promise.all(
        convs.map(async (c) => {
          const posts = await guestPosts(c._id)
          return {
            externalId: c._id,
            listingId: c.meta.reservations[0].listing._id,
            guestName: c.meta.guest?.fullName ?? 'Guest',
            messages: posts.map((p) => ({
              externalId: p._id,
              role: p.sentBy === 'guest' ? ('guest' as const) : ('host' as const),
              body: p.body,
              createdAt: p.createdAt,
            })),
          }
        }),
      )
    },

    async send(conversationId, body) {
      // Reply on the same channel the guest last wrote on
      const channel = (await guestPosts(conversationId)).findLast((p) => p.sentBy === 'guest')?.module.type ?? 'platform'
      await http(`${BASE}/v1/communication/conversations/${conversationId}/send-message`, {
        method: 'POST',
        token: await auth(),
        body: JSON.stringify({ module: { type: channel }, body }),
      })
    },
  }
}
