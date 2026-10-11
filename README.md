<div align="center">

# OpenInn

**The free, open-source AI guest assistant for short-term rental hosts.**

Self-hosted · Your data stays yours · Works with any AI model

[![CI](https://github.com/TMSifat/OpenInn/actions/workflows/ci.yml/badge.svg)](https://github.com/TMSifat/OpenInn/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![Node.js 24+](https://img.shields.io/badge/node-%3E%3D24-brightgreen.svg)](https://nodejs.org)
[![PRs welcome](https://img.shields.io/badge/PRs-welcome-blue.svg)](CONTRIBUTING.md)

[Quick start](#quick-start) · [How it works](#how-it-works) · [Configuration](#configuration) · [Docs](docs/) · [Roadmap](#roadmap)

<img src="docs/images/dashboard.png" alt="OpenInn dashboard showing a guest conversation with an AI-suggested reply waiting for approval" width="900">

</div>

---

OpenInn answers guest messages for Airbnb and vacation rental hosts. It uses each property's own details and your tone. It reads messages from your property management system (PMS), drafts a reply, and either waits for your approval or sends it. When it isn't sure, it hands the conversation to you.

Paid AI messaging tools cost about **$9–29 per listing per month**, are closed-source, and keep your guests' data on their servers. OpenInn is free, runs on your own machine or server, and works with the AI model of your choice, including free local models.

## Features

- **Property knowledge base:** one Markdown file per property for Wi-Fi, check-in steps, house rules, parking and local tips. Edit the file and the next reply uses it.
- **Your tone:** friendly, formal, short or detailed, set per property.
- **Draft mode (default):** the AI writes the reply, you approve, edit or dismiss it in the dashboard, and you get an alert for each new draft.
- **Autopilot mode:** replies go out automatically, but only when the AI is confident and the topic is safe.
- **Escalation:** a Telegram or email alert when the AI is unsure, a guest complains, or the topic is money, damage or safety.
- **PMS connections:** Hospitable, Hostaway and Guesty, plus a demo mode for trying it without an account.
- **Any AI model:** Claude, GPT, Gemini, Groq, or free local models through Ollama.
- **One-command setup:** `docker compose up -d`.
- **Private by design:** SQLite on your own disk. No telemetry, no third-party service apart from the AI provider you choose.

## Quick start

### With Docker (recommended)

```bash
git clone https://github.com/TMSifat/OpenInn.git
cd OpenInn
cp .env.example .env     # set DASHBOARD_PASSWORD and an AI key, see Configuration
docker compose up -d
```

Open **http://localhost:3000** and sign in with any username and your `DASHBOARD_PASSWORD`.

Use **Simulate a guest message** in the sidebar to see a reply drafted before you connect a PMS.

### Without Docker

Requires **Node.js 24 or newer**.

```bash
git clone https://github.com/TMSifat/OpenInn.git
cd OpenInn
npm install
cp .env.example .env
npm run dev              # http://localhost:3000, no password needed in development
```

For a production server without Docker, run `npm run build` and `npm start` (see [docs/deployment.md](docs/deployment.md)).

> [!IMPORTANT]
> The dashboard can send messages to your guests. In production it won't start until `DASHBOARD_PASSWORD` is set. If you expose it to the internet, put it behind HTTPS. See [Deployment](docs/deployment.md#https).

## How it works

```mermaid
flowchart TD
    A[Guest message<br/>Airbnb, Booking.com, VRBO…] --> B[Your PMS<br/>Hospitable · Hostaway · Guesty]
    B -->|checked every minute| C[OpenInn]
    C --> D[Property file + conversation history]
    D --> E[AI drafts a reply<br/>with a confidence score]
    E --> F{Safe and confident?}
    F -->|Yes, autopilot| G[Reply sent to guest]
    F -->|Yes, draft mode| H[Draft waits for approval<br/>+ alert to host]
    F -->|No| I[Escalated to host<br/>Telegram / email alert]
```

### When the assistant hands over to you

The AI never handles these alone, whatever its confidence:

| Trigger | Examples |
|---|---|
| Money | refunds, deposits, fees, prices, discounts, "how much…" |
| Damage or broken things | "we broke a glass", "no hot water", "the heating doesn't work" |
| Complaints | dirty, noisy, smells, mould, pests |
| Access problems | locked out, door code not working |
| Serious topics | cancellations, legal matters, emergencies, safety |
| Missing information | the answer isn't in the property file |
| Low confidence | below `CONFIDENCE_THRESHOLD` (default `0.8`) |
| Errors | the AI call fails, or sending the reply fails |

The keyword check looks at **every guest message since your last reply**, so a vague "any update?" after a complaint still escalates. The keyword list covers common cases, not every possible wording. For anything it misses, the AI's own judgement decides. Keep a property in draft mode until you trust its replies.

## Add your properties

Each property is one Markdown file in [`properties/`](properties/). Copy the example [`seaside-cottage.md`](properties/seaside-cottage.md) and edit it:

```markdown
---
name: Seaside Cottage
tone: friendly        # friendly | formal | short | detailed
mode: draft           # draft | autopilot
listing_id: 12345     # this property's id in your PMS
---

## Wi-Fi
- Network: SeasideCottage
- Password: shells-and-sand-42

## Check-in
- From 4:00 PM. Self check-in with the keypad…
```

- **Write it like a guest guide.** Include everything a guest might ask. The assistant uses only facts from this file and says it will check with you when something isn't covered.
- **Changes apply to the next message**, with no restart needed.
- **A file with a mistake is skipped**, the error appears at the top of the dashboard, and your other properties keep working.

## Configuration

Copy [`.env.example`](.env.example) to `.env`. Everything is set with environment variables.

### Required

| Variable | Description |
|---|---|
| `DASHBOARD_PASSWORD` | Password for the dashboard (any username). Required in production. |
| `AI_MODEL` | `<provider>:<model>`, for example `anthropic:claude-sonnet-5-5`. See [AI models](#ai-models). |
| Provider API key | `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GOOGLE_GENERATIVE_AI_API_KEY` or `GROQ_API_KEY`. Not needed for Ollama. |

### PMS connections

Set one or more. Only listings that have a property file are handled.

| PMS | Variables | `listing_id` in property files |
|---|---|---|
| [Hospitable](https://hospitable.com) | `HOSPITABLE_TOKEN` (Personal Access Token) | Hospitable property UUID |
| [Hostaway](https://hostaway.com) | `HOSTAWAY_ACCOUNT_ID`, `HOSTAWAY_API_KEY` | Hostaway listing id |
| [Guesty](https://guesty.com) | `GUESTY_CLIENT_ID`, `GUESTY_CLIENT_SECRET` (Open API) | Guesty listing `_id` |

On the first sync, guest messages older than 24 hours are imported as history but not answered, so old threads don't get surprise replies.

> [!NOTE]
> The connectors follow each PMS's public API documentation but **have not yet been tested against live accounts**. Start in draft mode and please [report what you find](https://github.com/TMSifat/OpenInn/issues/new?template=connector_report.yml). See [docs/connectors.md](docs/connectors.md).

### AI models

| Provider | `AI_MODEL` example | Key |
|---|---|---|
| Anthropic | `anthropic:claude-sonnet-5-5` | `ANTHROPIC_API_KEY` |
| OpenAI | `openai:gpt-5` | `OPENAI_API_KEY` |
| Google | `google:gemini-2.5-flash` | `GOOGLE_GENERATIVE_AI_API_KEY` |
| Groq | `groq:llama-3.3-70b-versatile` | `GROQ_API_KEY` |
| Ollama (free, local) | `ollama:llama3.1` | none; set `OLLAMA_URL` |

Use any model id your provider offers. Small local models are less reliable at following the rules, so keep them in draft mode.

### Alerts

| Channel | Variables |
|---|---|
| Telegram | `TELEGRAM_BOT_TOKEN` (from [@BotFather](https://t.me/BotFather)), `TELEGRAM_CHAT_ID` |
| Email | `SMTP_URL` (for example `smtps://user:pass@smtp.example.com:465`), `ALERT_EMAIL_TO`, optional `ALERT_EMAIL_FROM` |

If neither is set, alerts are written to the server log.

### Optional

| Variable | Default | Description |
|---|---|---|
| `PUBLIC_URL` | `http://localhost:3000` | Dashboard address used in alert links |
| `CONFIDENCE_THRESHOLD` | `0.8` | Replies below this confidence (0–1) go to you |
| `POLL_INTERVAL_SECONDS` | `60` | How often to check the PMS (minimum 10) |
| `DATABASE_PATH` | `./data/openinn.db` | SQLite database file |
| `PROPERTIES_DIR` | `./properties` | Folder with property files |
| `OPENINN_POLLER` | `on` | Set to `off` to disable PMS polling (dashboard only) |

## Project structure

```
app/                  Next.js dashboard: inbox, drafts, properties
lib/
  pipeline.ts         ingest → draft → send or escalate
  ai.ts               model selection and prompt
  escalation.ts       sensitive-topic rules, Telegram and email alerts
  knowledge.ts        property file loader
  db.ts               SQLite schema (node:sqlite)
  connectors/         hospitable, hostaway, guesty, demo
properties/           property files
test/                 unit tests (node:test, no API keys needed)
docs/                 architecture, connectors, deployment
```

Read [docs/architecture.md](docs/architecture.md) for how the pieces fit together.

## Development

```bash
npm install
npm run dev          # dashboard with hot reload
npm test             # unit tests
npm run typecheck    # TypeScript
npm run build        # production build
```

Contributions are welcome, especially testing the connectors against real PMS accounts. See [CONTRIBUTING.md](CONTRIBUTING.md).

## Roadmap

| Version | Focus |
|---|---|
| **v1.0** | Guest replies, draft and autopilot, escalation, Hospitable / Hostaway / Guesty, any AI model, Docker |
| v1.1 | Connectors verified against live accounts, webhooks instead of polling, alert settings |
| v1.2 | Review responses, multi-language replies |
| v2.0 | WhatsApp, team accounts, analytics |

See [CHANGELOG.md](CHANGELOG.md) for release notes.

## FAQ

**Is it really free?**
Yes. OpenInn is MIT-licensed. You pay only for the AI model you choose, and that's $0 with Ollama.

**Where is my data stored?**
In a SQLite file on your own machine or server. Messages go to your AI provider only to draft replies. With Ollama, nothing leaves your machine.

**Will it send something wrong to a guest?**
Draft mode is the default, and nothing is sent until you approve it. In autopilot, sensitive topics and low-confidence replies always come to you first.

**Do I need to be technical?**
You need to be able to run Docker and edit a text file. A one-click deploy is on the roadmap.

## Security

Please report vulnerabilities privately. See [SECURITY.md](SECURITY.md).

## License

[MIT](LICENSE) © 2026 OpenInn contributors
