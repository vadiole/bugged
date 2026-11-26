---
name: update-rules
description: Refresh Bugged's link cleaning rules from the maintained tracker lists. Use when asked to update, research or extend tracking parameters or redirect wrappers, or when a link comes out dirty or broken.
---

Goal: `rules.txt` and `redirects.txt` match what the maintained lists and vendor docs agree on today, and every case passes. A false positive breaks someone's link, which is worse than a missed tracker: when unsure, leave the parameter in.

The curated source is `tools/rules/build.py` (global list, host dict, country domains) and `tools/rules/redirects.base`. `app/src/main/assets/rules.txt` and `redirects.txt` are generated from them; edit the source, never the assets.

## Steps

1. Fetch every source in the table with `curl -sSL`, each into its own directory under the scratchpad. Check that each still has recent commits: `gh api 'repos/<owner>/<repo>/commits?per_page=1' --jq '.[0].commit.committer.date'`. A moved file is found with `gh api 'repos/<owner>/<repo>/git/trees/master?recursive=1'`. Quote every URL and wildcard, because zsh globs `?` and `*`.
2. Normalize: `python3 tools/rules/extract.py <srcdir> <facts.tsv>`. It writes `source, host, param, scope` facts and ClearURLs redirections to `<facts.tsv>.redirects`. When a source changed format, fix `extract.py` first.
3. Find newcomers. Count families per global param in the facts and compare with the current `*` line. Search the web for click IDs and share parameters introduced in the last year, and for referrer parameters added by AI chat apps and new social apps.
4. Decide each candidate with `python3 tools/rules/q.py <facts.tsv> param <names...>` and `... host <hosts...>`, using the rules below. Done when every candidate is either added with its evidence or rejected with a reason.
5. Edit `build.py` and `redirects.base`. Add a line to `app/src/test/resources/cases.txt` (`dirty clean`, one space) for every new host and every new trap, including links that must stay unchanged.
6. Regenerate and check:
   ```
   python3 tools/rules/build.py app/src/main/assets/rules.txt app/src/main/assets/redirects.txt
   python3 tools/rules/verify.py app/src/main/assets/rules.txt app/src/main/assets/redirects.txt app/src/test/resources/cases.txt
   ./gradlew testDebugUnitTest 2>&1 | tee /tmp/gradle-test.log | tail -40
   ```
   `verify.py` checks only the file formats. `CleanerTest` runs every case through the real cleaner and is the one verdict on behavior.
7. Report what was added, what was rejected and why, and any source that died or moved. Update the source table and the traps below when they changed.

## Sources

Families for counting agreement: AG, UBO, ALS, BR, CU, NU, FF. AG, UBO and ALS copy each other, so three hits among only those three weigh less than AG + BR + CU.

| Family | Raw URL | Use |
|---|---|---|
| AG | `https://raw.githubusercontent.com/AdguardTeam/AdguardFilters/master/TrackParamFilter/sections/general_url.txt` | Best for the `*` line; each rule names its vendor |
| AG | `https://raw.githubusercontent.com/AdguardTeam/AdguardFilters/master/TrackParamFilter/sections/specific.txt` | Best for host lines |
| BR | `https://raw.githubusercontent.com/brave/adblock-lists/master/brave-lists/query-filter.json` | Short, conservative global list |
| BR | `https://raw.githubusercontent.com/brave/adblock-lists/master/brave-lists/clean-urls.json` | Per-host list; also the Google, Amazon and eBay country domains |
| BR | `https://raw.githubusercontent.com/brave/adblock-lists/master/brave-lists/debounce.json` | Best for redirect wrappers |
| CU | `https://raw.githubusercontent.com/ClearURLs/Rules/master/data.min.json` | Aggressive; includes functional params. `rules2.clearurls.xyz` is a stale mirror |
| FF | `https://firefox.settings.services.mozilla.com/v1/buckets/main/collections/query-stripping/records` | Small; anything here is safe globally |
| UBO | `https://raw.githubusercontent.com/uBlockOrigin/uAssets/master/filters/privacy.txt` | `removeparam` rules |
| ALS | `https://raw.githubusercontent.com/DandelionSprout/adfilt/master/LegitimateURLShortener.txt` | Largest and most aggressive; tiebreaker only |
| NU | `https://raw.githubusercontent.com/Smile4ever/Neat-URL/master/data/default-params-by-category.json` | Small, categorized |

Vendor docs justify a click ID the lists don't carry yet: Simo Ahava's click identifier table (`https://www.simoahava.com/analytics/common-mistakes-click-identifiers/`) and each ad platform's conversion API docs.

## Decision rules

- **`*` line**: the name is distinctive (a vendor prefix or a click-ID shape) and is global in three families, or in two plus vendor docs. Short or generic names (`t`, `s`, `si`, `ref`, `source`, `id`, `share`) are host lines only.
- **Host line**: two families on that host, or one family plus a confirmed share or tracking meaning. First check what the parameter does on that site.
- **Prefix wildcard**: only for a vendor-specific prefix (`utm_*`, `mtm_*`, `pf_rd_*`). `pk_*`, `ga_*` and `itm_*` stay rejected; list the individual names.
- **Affiliate parameters** are removed, as Brave and AdGuard do.
- **Redirect wrapper**: the parameter holds a plain or percent-encoded URL. Base64 payloads and short links that need a network lookup are out of scope.
- **Redirect wrapper outside a parameter**: a line in `redirects.base` may name a token instead of a parameter. `:query` means the whole query is the destination (`href.li/?https://…`). `:segment` means one path segment after the prefix is the encoded destination (`awstrack.me/L0/<url>/…`); `:segment-https` and `:segment-http` are the same for a segment without a scheme. `:rest` means everything after the prefix, from the first `http`, is the destination; `:rest-https` is the same for a path without a scheme (AMP caches). Every new token line gets a case that unwraps and a case that must stay unchanged.
- **Licensing**: Bugged is MIT and several lists are GPL or LGPL. Take parameter names and hosts as facts; write nothing by copying a list's rules, regexes or structure.

## Traps

- A path-scoped rule in AG or UBO looks like a host rule when you grep the host: YouTube `si` is listed there only for `/shorts/`, `/live/` and `/@`. Bugged strips it on all of youtube.com, as Brave does.
- Value-conditional rules (`__s` with a value pattern, `source=googleps`) can't be expressed; skip them.
- `google.com` also covers docs, maps, play and accounts, so generic names (`source`, `client`, `sa`, `usp`, `entry`, `udm`) stay.
- Functional parameters that lists strip anyway: YouTube `t`, `v`, `list`, `index`; Amazon `th`, `psc`, `smid` and search filters (`k`, `rh`, `keywords`, `rnid`); NYT `unlocked_article_code`; Xiaohongshu `xsec_token`; eBay `epid`; Reddit `context`; Spotify `context`; Instagram `img_index`. Each has an unchanged case in `cases.txt`.
- Never global: `spm` (Alibaba hosts only), `fb_comment_id`, `cmpid`, `ncid`, `awc`, ClearURLs' `[a-z]?mc` pattern.
- Names in the files are lowercase and the cleaner matches case-insensitively; real links carry `ScCid` and `linkCode`.
- Percent-encoded names such as Reddit's `%24deep_link` are listed in both spellings.
