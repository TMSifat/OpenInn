export type IncomingMessage = { externalId: string; role: 'guest' | 'host'; body: string; createdAt: string }

export type IncomingConversation = {
  externalId: string
  listingId: string
  guestName: string
  messages: IncomingMessage[]
}

export interface Connector {
  name: string
  // Recently active conversations with their latest messages
  fetchConversations(listingIds: string[]): Promise<IncomingConversation[]>
  send(conversationExternalId: string, body: string): Promise<void>
}

export async function http<T>(url: string, init: RequestInit & { token?: string } = {}): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      accept: 'application/json',
      ...(init.body && typeof init.body === 'string' ? { 'content-type': 'application/json' } : {}),
      ...(init.token ? { authorization: `Bearer ${init.token}` } : {}),
      ...init.headers,
    },
  })
  if (!res.ok) throw new Error(`${init.method ?? 'GET'} ${url} → ${res.status} ${await res.text().catch(() => '')}`.slice(0, 500))
  return (res.status === 204 ? undefined : await res.json()) as T
}
