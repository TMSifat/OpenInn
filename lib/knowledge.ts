import { readdirSync, readFileSync } from 'node:fs'
import { join, basename } from 'node:path'

export type Tone = 'friendly' | 'formal' | 'short' | 'detailed'
export type Mode = 'draft' | 'autopilot'

export type Property = {
  id: string
  name: string
  tone: Tone
  mode: Mode
  // Listing/property id in the PMS, used to match incoming conversations
  listingId: string
  knowledge: string
}

const TONES: Tone[] = ['friendly', 'formal', 'short', 'detailed']
const MODES: Mode[] = ['draft', 'autopilot']

// Flat "key: value" frontmatter only; property files are meant to be hand-written by hosts.
export function parseProperty(id: string, text: string): Property {
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/)
  const meta: Record<string, string> = {}
  for (const line of (match?.[1] ?? '').split(/\r?\n/)) {
    const i = line.indexOf(':')
    if (i > 0) meta[line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/^["']|["']$/g, '')
  }
  const tone = (meta.tone ?? 'friendly') as Tone
  const mode = (meta.mode ?? 'draft') as Mode
  if (!TONES.includes(tone)) throw new Error(`${id}: tone must be one of ${TONES.join(', ')}`)
  if (!MODES.includes(mode)) throw new Error(`${id}: mode must be one of ${MODES.join(', ')}`)
  return {
    id,
    name: meta.name || id,
    tone,
    mode,
    listingId: meta.listing_id ?? '',
    knowledge: (match ? match[2] : text).trim(),
  }
}

// A broken file is skipped and reported, so one typo never stops the other properties.
export function readProperties(dir = process.env.PROPERTIES_DIR ?? './properties'): { properties: Property[]; errors: string[] } {
  const properties: Property[] = []
  const errors: string[] = []
  // Property files are read at runtime (mounted in Docker), not bundled
  for (const f of readdirSync(/*turbopackIgnore: true*/ dir).filter((f) => f.endsWith('.md'))) {
    try {
      properties.push(parseProperty(basename(f, '.md'), readFileSync(join(/*turbopackIgnore: true*/ dir, f), 'utf8')))
    } catch (err) {
      errors.push(`properties/${f}: ${(err as Error).message}`)
    }
  }
  return { properties, errors }
}

export function loadProperties(dir?: string): Property[] {
  const { properties, errors } = readProperties(dir)
  for (const e of errors) console.error(`[openinn] skipped ${e}`)
  return properties
}

export function findProperty(properties: Property[], listingId: string): Property | undefined {
  return properties.find((p) => p.listingId === listingId || p.id === listingId)
}
