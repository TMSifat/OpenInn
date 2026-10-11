# Changelog

All notable changes to this project are documented here.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project follows [Semantic Versioning](https://semver.org/).

## [1.0.0] - 2026-10-11

First public release.

### Added

- **Property knowledge base:** one Markdown file per property with name, tone, mode and PMS listing id.
- **Tones:** friendly, formal, short and detailed.
- **Modes:**
  - *Draft mode* (default): the host approves, edits or dismisses each reply and gets an alert per draft.
  - *Autopilot mode*: confident, safe replies are sent automatically.
- **Escalation to the host** by Telegram or email when the AI is unsure, confidence is below the threshold, the AI call fails, or a guest mentions money, damage, complaints, access problems, cancellations, legal matters or emergencies.
- **PMS connectors:** Hospitable, Hostaway and Guesty (not yet verified against live accounts), plus a demo connector.
- **AI models:** Anthropic, OpenAI, Google, Groq and Ollama through the Vercel AI SDK.
- **Dashboard:**
  - inbox, draft review and properties pages
  - Basic-auth protection that is required in production
  - a "Simulate a guest message" form for trying it without a PMS
- **Send safety:**
  - atomic draft claiming prevents double sends
  - failed sends return to pending
  - sends interrupted by a crash are handed back to the host
- **Resilience:** a broken property file is skipped and reported, and the other properties keep working.
- **Storage:** SQLite storage via `node:sqlite`.
- **Setup:** Docker and docker-compose setup.

[1.0.0]: https://github.com/TMSifat/OpenInn/releases/tag/v1.0.0
