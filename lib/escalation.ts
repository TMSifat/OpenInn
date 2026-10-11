import nodemailer from 'nodemailer'

// Topics the AI must never handle alone, whatever its confidence.
const SENSITIVE = [
  /refund|money|reimburse|compensat|discount|\bcharged\b|overcharg|deposit|\bpay(ment|ing)?\b|price|\bcosts?\b|how much|\bfees?\b|invoice/i,
  /damage|\bbroke|stain|spill|cracked|leak|flood/i,
  /(doesn't|does not|don't|isn't|is not|not|stopped|won't) (work|working|turn on|open)|no (hot water|heat|heating|power|electricity|water|wi-?fi|internet)/i,
  /locked out|can't get in|cannot get in|\bstuck\b/i,
  /complain|disappoint|unacceptable|terrible|awful|dirty|filthy|disgusting|smell|noisy|noise|mou?ld|bed ?bugs?|cockroach|mouse|mice|\brats?\b/i,
  /cancel|lawyer|legal|police/i,
  /emergency|injur|hurt|\bfire\b|smoke|gas leak|ambulance|hospital|unsafe/i,
]

export function sensitiveTopic(text: string): string | null {
  const hit = SENSITIVE.map((re) => text.match(re)).find(Boolean)
  return hit ? `Sensitive topic: "${hit[0]}"` : null
}

// An empty or malformed value must never switch a safety check off, so it falls back to the default
export function envNumber(name: string, fallback: number): number {
  const n = Number(process.env[name])
  return process.env[name]?.trim() && Number.isFinite(n) ? n : fallback
}

export const threshold = () => envNumber('CONFIDENCE_THRESHOLD', 0.8)

export type Alert = { property: string; guest: string; message: string; draft: string; reason: string; link: string }

export async function notifyHost(alert: Alert): Promise<void> {
  const text = `OpenInn needs you — ${alert.property}
Guest ${alert.guest}: "${alert.message}"

Why: ${alert.reason}
Suggested reply: "${alert.draft}"

Review: ${alert.link}`

  const jobs: Promise<unknown>[] = []
  const { TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, SMTP_URL, ALERT_EMAIL_TO, ALERT_EMAIL_FROM } = process.env
  if (TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID) {
    jobs.push(
      fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text }),
      }).then((r) => {
        if (!r.ok) throw new Error(`Telegram ${r.status}`)
      }),
    )
  }
  if (SMTP_URL && ALERT_EMAIL_TO) {
    jobs.push(
      nodemailer.createTransport(SMTP_URL).sendMail({
        from: ALERT_EMAIL_FROM ?? ALERT_EMAIL_TO,
        to: ALERT_EMAIL_TO,
        subject: `OpenInn: ${alert.property} needs your reply`,
        text,
      }),
    )
  }
  if (!jobs.length) console.warn('[openinn] escalation (no TELEGRAM_* or SMTP_URL configured):\n' + text)
  const results = await Promise.allSettled(jobs)
  for (const r of results) if (r.status === 'rejected') console.error('[openinn] alert failed:', r.reason)
}
