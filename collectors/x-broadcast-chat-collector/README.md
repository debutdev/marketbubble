# X Broadcast Chat Collector

This optional worker bridges X livestream chat into the Market Bubble Next app.

X broadcast chat is not available by username alone. It is attached to a
broadcast id from URLs like:

```text
https://x.com/i/broadcasts/...
```

The collector uses a keyless X guest-token and Periscope chat websocket flow. It
runs outside Vercel Functions and posts normalized chat events to:

```text
POST /api/community-live-events
```

## Environment

```bash
MARKETBUBBLE_INGEST_URL=https://marketbubble.vercel.app/api/community-live-events
STREAM_EVENT_INGEST_SECRET=...

# Reliable path: direct broadcast URLs.
X_BROADCAST_URLS=Banks=https://x.com/i/broadcasts/...,blknoiz06=https://x.com/i/broadcasts/...

# Optional discovery path: poll the site's /api/x-feed route for public posts
# containing broadcast links. This works only when the public feed exposes the
# broadcast URL.
X_BROADCAST_HANDLES=blknoiz06,Banks
X_BROADCAST_DISCOVERY_SITE_URL=https://marketbubble.vercel.app
X_BROADCAST_HANDLE_POLL_MS=60000
```

`STREAM_EVENT_INGEST_SECRET` must match the Vercel project env var with the same
name. In local development, the ingest route accepts requests without the secret
when `NODE_ENV` is not production.

Never commit cookies, tokens, or private X session exports. This collector does
not need a paid X API key or a logged-in X session.

## Run

```bash
npm run x:collect-broadcasts
```

For local testing against the dev server:

```bash
MARKETBUBBLE_INGEST_URL=http://127.0.0.1:3000/api/community-live-events npm run x:collect-broadcasts
```

## Notes

- `X_BROADCAST_URLS` is the dependable setup for real live chat.
- `X_BROADCAST_HANDLES` can only discover broadcasts that appear as public links
  in the configured handle feeds.
- The website only displays X messages in live chat when they come from this
  collector as `x-broadcast:*` events. Profile posts belong in news/social
  surfaces, not the live chat rail.
