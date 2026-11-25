/**
 * Claim store for the Christmas list (optional).
 *
 * Points at the same Cloudflare Worker the Draft Fight watch party uses —
 * see party/README.md — over https rather than wss. The worker only ever
 * sees encrypted blobs; see gifts.js for why.
 *
 * Leave null and the page is fully static: no shopping mode, no requests,
 * everything else works exactly the same.
 */
export const GIFTS_URL = 'https://draft-fight-party.jlozano2002.workers.dev'
