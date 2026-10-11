export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs' && process.env.OPENINN_POLLER !== 'off') {
    const { startPoller } = await import('./lib/pipeline.ts')
    startPoller()
  }
}
