import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { parseProperty, loadProperties, readProperties, findProperty } from '../lib/knowledge.ts'
import { sensitiveTopic } from '../lib/escalation.ts'

test('parses frontmatter and body', () => {
  const p = parseProperty('x', '---\r\nname: "Loft"\r\ntone: short\r\nmode: autopilot\r\nlisting_id: 123\r\n---\r\n# Wi-Fi\nabc')
  assert.deepEqual(p, { id: 'x', name: 'Loft', tone: 'short', mode: 'autopilot', listingId: '123', knowledge: '# Wi-Fi\nabc' })
})

test('defaults to friendly draft mode, file without frontmatter is all knowledge', () => {
  const p = parseProperty('y', 'Just notes')
  assert.equal(p.tone, 'friendly')
  assert.equal(p.mode, 'draft')
  assert.equal(p.name, 'y')
  assert.equal(p.knowledge, 'Just notes')
})

test('rejects unknown tone or mode instead of silently using autopilot', () => {
  assert.throws(() => parseProperty('z', '---\nmode: auto\n---\n'), /mode must be/)
  assert.throws(() => parseProperty('z', '---\ntone: rude\n---\n'), /tone must be/)
})

test('a broken property file is skipped and reported, others still load', () => {
  const dir = mkdtempSync(join(tmpdir(), 'openinn-'))
  writeFileSync(join(dir, 'good.md'), '---\nname: Good\n---\nInfo')
  writeFileSync(join(dir, 'bad.md'), '---\ntone: chill\n---\nInfo')
  const { properties, errors } = readProperties(dir)
  assert.deepEqual(properties.map((p) => p.id), ['good'])
  assert.match(errors[0], /bad\.md: .*tone must be/)
})

test('example property loads and matches by id', () => {
  const props = loadProperties('./properties')
  assert.ok(findProperty(props, 'seaside-cottage'))
})

test('sensitive topics escalate, everyday questions do not', () => {
  for (const msg of ['Can I get a refund?', 'We broke a glass, sorry', 'The place is dirty', 'I want to cancel', 'There is smoke in the kitchen', 'there was a mouse!',
    'There is no hot water', 'The heating does not work', 'I am locked out', 'The neighbours are really noisy', 'There is mould in the bathroom', 'How much is an extra night?', 'Is there a cleaning fee?']) {
    assert.ok(sensitiveTopic(msg), msg)
  }
  for (const msg of ["What's the Wi-Fi password?", 'Where do we park?', 'How does the fireplace work?', 'Any good coffee nearby?', 'We will leave a great review!',
    'Where can I charge my phone?', 'Can we crack a window?']) {
    assert.equal(sensitiveTopic(msg), null, msg)
  }
})
