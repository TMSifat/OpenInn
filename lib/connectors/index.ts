import type { Connector } from './types.ts'
import { hospitable } from './hospitable.ts'
import { hostaway } from './hostaway.ts'
import { guesty } from './guesty.ts'

// Messages come in from the dashboard's "simulate guest" form; replies are only stored locally.
export const demo: Connector = {
  name: 'demo',
  fetchConversations: async () => [],
  send: async (id, body) => console.log(`[openinn] demo reply to ${id}: ${body}`),
}

// Kept on globalThis so the poller and the dashboard share one instance (and one auth token) per process.
const cache = globalThis as { openinnConnectors?: Connector[] }

export function getConnectors(): Connector[] {
  return (cache.openinnConnectors ??= createConnectors())
}

export function createConnectors(env = process.env): Connector[] {
  const list: Connector[] = [demo]
  if (env.HOSPITABLE_TOKEN) list.push(hospitable(env.HOSPITABLE_TOKEN))
  if (env.HOSTAWAY_ACCOUNT_ID && env.HOSTAWAY_API_KEY) list.push(hostaway(env.HOSTAWAY_ACCOUNT_ID, env.HOSTAWAY_API_KEY))
  if (env.GUESTY_CLIENT_ID && env.GUESTY_CLIENT_SECRET) list.push(guesty(env.GUESTY_CLIENT_ID, env.GUESTY_CLIENT_SECRET))
  return list
}

export function getConnector(name: string): Connector {
  const c = getConnectors().find((c) => c.name === name)
  if (!c) throw new Error(`Connector "${name}" is not configured`)
  return c
}

export type { Connector, IncomingConversation, IncomingMessage } from './types.ts'
