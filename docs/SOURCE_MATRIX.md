# Source matrix

The application keeps provenance domains separate. A value is authoritative only for the domain stated below; absence is represented as unknown and is never converted into a negative fact.

| Source | Authority | Stored metadata | May overwrite local equipment? | Required UI language |
| --- | --- | --- | --- | --- |
| Local application | User-confirmed state, budgets, plans, snapshots and journals | User, timestamp, operation and snapshot | Only after an explicit confirmed operation | Local, confirmed or manually entered |
| Official GGG API | Account and character payload returned by an owned OAuth connection | Connection, sync timestamp, upstream identifiers and error state | No; reconciliation requires confirmation | Official, last synchronized, compatibility limits |
| poe.ninja | Public profile and source-reported public statistics | Profile URL/identity, fetched timestamp, tree version and confidence | Never | Public, independent from GGG, reported/unknown |
| Trade2 | Live listing evidence returned by a successful query | Query, league, listing timestamp, currency and cache state | Never | Active listing, not a confirmed sale |
| Gemini | Explanation and proposed actions grounded in server-selected facts | Conversation, model response metadata, facts, sources and limitations | Never; every mutation requires confirmation | AI suggestion, confidence and missing evidence |
| Manual input | Text or choices explicitly supplied by the user | Input type, timestamp and parsing outcome | Only through a confirmed local action | Manual, parsed/rejected/duplicate status |

## Conflict rules

- Local, official and public loadouts remain independent records.
- Official or public changes create comparisons and snapshots before any optional reconciliation.
- Patch-specific quest absence requires an exact validated catalog. Otherwise the result is unknown.
- DPS is labelled source-reported, validated-model, estimated or unknown. No missing value is extrapolated.
- Trade listings are evidence of asking prices, not completed transactions.
- Gemini cannot upgrade source confidence and cannot supply missing game or market facts.
