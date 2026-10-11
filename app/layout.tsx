import type { ReactNode } from 'react'
import './globals.css'

export const metadata = { title: 'OpenInn', description: 'Self-hosted AI guest assistant' }

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="top">
          <a href="/" className="brand">OpenInn</a>
          <nav>
            <a href="/">Inbox</a>
            <a href="/properties">Properties</a>
          </nav>
        </header>
        {children}
      </body>
    </html>
  )
}
