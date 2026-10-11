# Security policy

OpenInn handles guest conversations and can send messages on a host's behalf, so security reports are taken seriously.

## Supported versions

| Version | Supported |
|---|---|
| 1.x | ✅ |

## Reporting a vulnerability

**Please do not open a public issue for security problems.**

Report vulnerabilities privately through [GitHub Security Advisories](https://github.com/TMSifat/OpenInn/security/advisories/new). Include:

- a description of the issue and its impact
- steps to reproduce, or a proof of concept
- the affected version or commit

You can expect an acknowledgement within 7 days. Once the issue is confirmed, a fix will be prioritised and you'll be credited in the release notes unless you'd rather stay anonymous.

## Scope

In scope:

- authentication bypass on the dashboard
- unintended messages being sent to guests
- leaks of guest data, API keys or tokens
- injection (XSS, SQL) and cross-site request forgery
- prompt-injection paths that bypass the escalation rules in autopilot

Out of scope:

- deployments exposed over plain HTTP. The docs require HTTPS or a private network.
- vulnerabilities in third-party AI providers or PMS APIs
- attacks that need access to the host's server or `.env` file

## Hardening tips for self-hosters

- Use a long, unique `DASHBOARD_PASSWORD`.
- Serve the dashboard over HTTPS or a private network only (see [docs/deployment.md](docs/deployment.md#https)).
- Give PMS API tokens the minimum permissions they need.
- Keep OpenInn updated: `git pull && docker compose up -d --build`.
