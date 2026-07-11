# Official Trade2 integration

The official source is [Path of Exile 2 Trade](https://www.pathofexile.com/trade2/search/poe2/Runes%20of%20Aldur).

## Query generation

`trade.ts` builds a Trade2-compatible object with online status, base/type, rarity, item-level and defence ranges, important pseudo stats, and ascending price sort. Required level remains part of item parsing but is not sent because Trade2 rejects the legacy `lvl_req` key for PoE 2. It emits a browser URL with the JSON encoded in a base64url `q` parameter. When the official search endpoint accepts the query, its returned search ID becomes the preferred browser URL.

The generator deliberately uses ranges rather than exact numeric equality so the result set can contain meaningful comparables.

### Category-specific query priorities

Detection happens before query generation. Exact-base searches always pin the pasted base. Same-slot fallback searches use the official category for armour, off-hands, accessories, ranged/caster weapons, and recognised one-/two-handed weapon classes.

- Shields use `armour.shield`, local defence filters, and defensive pseudo stats; they never broaden to Body Armour.
- Boots include movement speed before other pseudo stats.
- Attack weapons use DPS, physical DPS, attacks per second, and critical chance instead of life/resistance filters.
- Quivers use `armour.quiver` and do not search by defensive pseudo stats.
- Caster weapons remain inside their weapon category and do not receive defensive filters.

The Category Analysis card exposes the human-readable search priorities before the user opens the official URL.

## URL parsing

The parser requires a `pathofexile.com` host and a `/trade2/search/poe2/` path. It extracts:

- league from the path;
- query ID from the trailing path segment when present;
- `q` as JSON, URL-decoded JSON, or base64url JSON;
- type, rarity, filter groups, stat groups, and sort from the decoded query.

Every parsed URL is saved in `trade_queries`.

## Live request flow

1. `POST /api/trade2/search/poe2/{league}` with an exact-base query restricted to Exalted/Divine prices.
2. If it is empty, automatically retry with the official same-slot category and the target's core stat minimums.
3. Take up to 40 result IDs.
4. Fetch details in batches of 10 from `/api/trade2/fetch/{ids}?query={searchId}`.
5. Accept only explicit Exalted or Divine asking prices.
6. Normalize Trade2 modifier objects and defence properties for similarity scoring.

The live search has a 12-second timeout. Responses with no priced results produce no estimate.

## Failure and cache policy

Trade2 is an external service and may enforce rate limits, Cloudflare checks, session access, or API changes. The app surfaces the actual HTTP/timeout error and never fabricates listings. It can use same-league, exact-base official results saved during the previous 24 hours; these are marked `cache`.

For manual evidence, paste a JSON export or simple price lines. Manual data is always marked `manual`, accompanied by a verification warning and the generated official link. The result table can also be exported as normalized JSON for auditing or reuse.

Be considerate of the official service: the implementation caps result count, batches fetches, does not continuously poll, and caches successful evidence.
