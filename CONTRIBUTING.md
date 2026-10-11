# Contributing to OpenInn

Thanks for helping make OpenInn better. Contributions of every size are welcome: bug reports, docs fixes, connector testing and code.

## The most useful contribution right now

**Test a connector against your real PMS account.** The Hospitable, Hostaway and Guesty connectors were written from public API docs and haven't been tested against live accounts yet. Run OpenInn in draft mode with your account and [file a connector report](https://github.com/TMSifat/OpenInn/issues/new?template=connector_report.yml), even if everything worked.

## Development setup

Requirements: **Node.js 24+** and npm.

```bash
git clone https://github.com/TMSifat/OpenInn.git
cd OpenInn
npm install
cp .env.example .env
npm run dev
```

No API keys are needed for development. Use **Simulate a guest message** in the dashboard. Without an AI key, drafts are escalated with an "AI error" reason, which is enough to work on the UI and pipeline.

## Before you open a pull request

```bash
npm test            # unit tests
npm run typecheck   # TypeScript
npm run build       # production build
```

CI runs the same three commands, plus a Docker build.

## Guidelines

- **Keep it simple.** OpenInn is for small hosts who self-host. Prefer the standard library and the existing dependencies over new ones. Prefer a small, clear change over a flexible framework.
- **Safety first.** Anything that affects what reaches a guest needs a test in `test/pipeline.test.ts`. This covers escalation rules, autopilot and sending.
- **Match the existing style.** That means 2-space indentation, no semicolons, single quotes, and comments that explain *why*, not *what*.
- **Imports inside `lib/` use relative paths with the `.ts` extension**, so tests run directly with `node --test`.
- **One change per pull request**, with a clear description of what and why.
- **Update the docs** (README, `docs/`, `.env.example`) when you change behaviour or configuration.

## Adding a PMS connector

See [docs/connectors.md](docs/connectors.md#adding-a-connector). A connector needs only two methods.

## Reporting bugs

Use the [bug report template](https://github.com/TMSifat/OpenInn/issues/new?template=bug_report.yml). Never paste API keys, tokens or guest personal data into an issue.

For security vulnerabilities, follow [SECURITY.md](SECURITY.md) instead of opening a public issue.

## Code of conduct

This project follows the [Code of Conduct](CODE_OF_CONDUCT.md). By participating, you agree to uphold it.

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).
