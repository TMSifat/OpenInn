import { NextResponse, type NextRequest } from 'next/server'

// The dashboard can message guests, so it is never left open in production.
export function proxy(req: NextRequest) {
  const password = process.env.DASHBOARD_PASSWORD
  if (!password) {
    if (process.env.NODE_ENV === 'production') {
      return new NextResponse('Set DASHBOARD_PASSWORD in your .env to use the OpenInn dashboard.', { status: 503 })
    }
    return NextResponse.next()
  }
  const [scheme, encoded] = (req.headers.get('authorization') ?? '').split(' ')
  let supplied = ''
  try {
    if (scheme === 'Basic' && encoded) supplied = atob(encoded).split(':').slice(1).join(':')
  } catch {} // malformed header is treated as no password
  if (supplied === password) return NextResponse.next()
  return new NextResponse('Authentication required', { status: 401, headers: { 'WWW-Authenticate': 'Basic realm="OpenInn"' } })
}

export const config = { matcher: '/((?!_next/static|_next/image|favicon.ico).*)' }
