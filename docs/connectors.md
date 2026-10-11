# PMS connectors

OpenInn reads and sends guest messages through your property management system (PMS). Each connector lives in `lib/connectors/` and is turned on by setting its environment variables.

## Status

| Connector | Auth | Reads | Sends | Verified against a live account |
|---|---|---|---|---|
| Demo | none | Dashboard "Simulate" form | Stored locally | n/a |
| Hospitable | Personal Access Token | Reservations → messages | `POST /reservations/{id}/messages` | ❌ Not yet |
| Hostaway | Client credentials | Conversations → messages | `POST /conversations/{id}/messages` | ❌ Not yet |
| Guesty | OAuth2 client credentials (Open API) | Conversations → posts | `POST /communication/conversations/{id}/send-message` | ❌ Not yet |

The connectors were written from each provider's public API documentation. Field names that couldn't be confirmed from public docs are marked with `shortcut:` comments in the code. **Use draft mode until you've seen correct replies for your account.** If you test one, please [open a connector report](https://github.com/TMSifat/OpenInn/issues/new?template=connector_report.yml), whether it worked or not.

## Hospitable

- **Get a token:** in Hospitable, go to **Apps → API access** and create a Personal Access Token with read and write access to messages.
- **Set:** `HOSPITABLE_TOKEN`.
- **`listing_id`:** the Hospitable property UUID.
- **Behaviour:**
  - Fetches reservations from 30 days ago to 90 days ahead for your listed properties.
  - Reads each reservation's messages.
  - Replies on the reservation thread.

## Hostaway

- **Get credentials:** in Hostaway, go to **Settings → Hostaway API** and create an API key. Your account ID is shown there.
- **Set:** `HOSTAWAY_ACCOUNT_ID`, `HOSTAWAY_API_KEY`.
- **`listing_id`:** the Hostaway listing id (`listingMapId`).
- **Behaviour:**
  - Reads the 20 most recently active conversations.
  - Replies through the booking channel (`communicationType: channel`).
  - If the token is rejected, it fetches a new one and retries once.

## Guesty

- **Get credentials:** in Guesty, go to **Integrations → API** and create an Open API application.
- **Set:** `GUESTY_CLIENT_ID`, `GUESTY_CLIENT_SECRET`.
- **`listing_id`:** the Guesty listing `_id`.
- **Behaviour:**
  - Reads the 20 most recent conversations and skips internal notes and logs.
  - Replies on the channel the guest last wrote on (for example `airbnb2`), falling back to `platform`.
- **Token limit:** Guesty allows 5 tokens per 24 hours. OpenInn keeps one token per process, so avoid frequent restarts.

## Adding a connector

A connector implements two methods, defined in [`lib/connectors/types.ts`](../lib/connectors/types.ts):

```ts
interface Connector {
  name: string
  // Recently active conversations with their latest messages
  fetchConversations(listingIds: string[]): Promise<IncomingConversation[]>
  send(conversationExternalId: string, body: string): Promise<void>
}
```

1. Create `lib/connectors/<name>.ts` that exports a factory returning a `Connector`. Use the shared `http()` helper for requests.
2. Map each message to `{ externalId, role: 'guest' | 'host', body, createdAt }`. Any timestamp format that `Date` can parse is fine.
3. Filter to `listingIds` so OpenInn only handles listings that have a property file.
4. Register it in `createConnectors()` in [`lib/connectors/index.ts`](../lib/connectors/index.ts), turned on by its environment variables.
5. Add the variables to `.env.example` and a section to this page.

The pipeline takes care of deduplication, ordering, drafting, escalation and send safety, so a connector only needs to translate API responses.
