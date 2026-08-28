# Draft Fight watch-party worker

Live viewer count, emoji reactions, and a prediction tally for fight rooms.
Free tier is plenty: a league watch party is a dozen WebSocket connections
for a few minutes.

## One-time setup

1. Create a free Cloudflare account at dash.cloudflare.com (no card needed).
2. From this directory:

       npx wrangler login
       npx wrangler deploy

3. Wrangler prints the worker URL, e.g.
   `https://draft-fight-party.<your-subdomain>.workers.dev`.
   Put it in `src/draftfight/party-config.js` as
   `wss://draft-fight-party.<your-subdomain>.workers.dev` and push.

That's it. If the worker is ever down or unreachable, the site silently
hides the presence layer — fights are never affected.
