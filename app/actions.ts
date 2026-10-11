'use server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { sendDraft, rejectDraft, simulateGuest } from '../lib/pipeline.ts'

const field = (f: FormData, k: string) => String(f.get(k) ?? '').trim()
const back = (c: string, error?: string) =>
  redirect(`/?c=${encodeURIComponent(c)}${error ? `&error=${encodeURIComponent(error)}` : ''}`)

export async function sendAction(form: FormData) {
  const c = field(form, 'conversation')
  let error: string | undefined
  try {
    await sendDraft(Number(field(form, 'draft')), field(form, 'body'))
  } catch (err) {
    error = (err as Error).message
  }
  revalidatePath('/')
  back(c, error)
}

export async function rejectAction(form: FormData) {
  rejectDraft(Number(field(form, 'draft')))
  revalidatePath('/')
  back(field(form, 'conversation'))
}

export async function simulateAction(form: FormData) {
  const property = field(form, 'property')
  const guest = field(form, 'guest') || 'Demo Guest'
  const body = field(form, 'body')
  if (!body) back('', 'Type a guest message first')
  let c = ''
  let error: string | undefined
  try {
    c = await simulateGuest(property, guest, body)
  } catch (err) {
    error = (err as Error).message
  }
  revalidatePath('/')
  back(c, error)
}
