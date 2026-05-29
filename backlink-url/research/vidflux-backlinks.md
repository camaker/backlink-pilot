# VidFlux Backlink Discovery

Research date: 2026-05-29

Scope: public web discovery for pages outside `vidflux.ai` that mention or link to `https://vidflux.ai`. This is not a complete Ahrefs/Semrush-style backlink graph. It is a reproducible list of publicly discoverable candidates, with direct HTML verification where possible.

## Verified Links

| Source | Status | Target href | Clean target | Rel | Confidence | Notes |
|---|---:|---|---|---|---|---|
| https://www.aimyflow.com/en/ai/vidflux-ai-ai-video-generator | 200 | `https://vidflux.ai/ai-video-generator` | `https://vidflux.ai/ai-video-generator` | `noopener noreferrer` | High | Public AI directory listing with direct external link. |
| https://toolhunt.io/vidflux-ai-ai-video-generator/ | 200 | `https://vidflux.ai/ai-video-generator??ref=toolhunt.io` | `https://vidflux.ai/ai-video-generator` | empty | High | Public tool listing. Target has malformed `??ref=` parameter. |
| https://topvideo.tools/tools/vidflux | 200 | `https://vidflux.ai/?ref=topvideotools` | `https://vidflux.ai/` | `noopener noreferrer` | High | Public video tools directory listing; repeated homepage links plus pricing link. |
| https://aipure.ai/products/vidflux-ai | 200 | `https://vidflux.ai/?utm_source=aipure` | `https://vidflux.ai/` | empty | High | Public product page with direct outbound links. |
| https://www.aidir.tools/item/vidflux | 200 | `https://vidflux.ai/?utm_source=aidir.tools&utm_medium=referral&utm_campaign=navigation` | `https://vidflux.ai/` | empty | High | Public AI directory item page. |
| https://aiextension.ai/item/vidflux | 200 | `http://vidflux.ai/?utm_source=aiextension.ai&utm_medium=referral&utm_campaign=navigation` | `http://vidflux.ai/` | empty | High | Public AI extension/item page; outbound uses HTTP and UTM parameters. |
| https://toolerific.ai/ai-tools/sites/vidflux-ai | 200 | `https://vidflux.ai/?utm_source=toolerific&utm_medium=referral&utm_campaign=tools_section` | `https://vidflux.ai/` | empty | High | Public AI tools page. |
| https://www.aipowerstacks.com/tools/vidflux | 200 | `https://vidflux.ai/` | `https://vidflux.ai/` | `noopener noreferrer` | High | Public tools directory page with repeated direct outbound links. |

## Unverified Or Blocked Candidates

| Source | Status | Evidence | Confidence | Notes |
|---|---:|---|---|---|
| https://aiaxio.com/tools/ai/vidflux-ai/ | 403 | Search candidate, fetch blocked | Medium | Backlink not verified. |
| https://aistage.net/tool/vidflux-ai | 403 | Search candidate, fetch blocked | Medium | Backlink not verified. |
| https://creati.ai/ai-tools/vidflux/ | 403 | Search candidate, fetch blocked | Medium | Backlink not verified. |
| https://creati.ai/es/ai-tools/vidflux/ | 403 | Search candidate, fetch blocked | Medium | Backlink not verified. |
| https://www.toolify.ai/tool/vidflux/ | 403 | Search candidate, fetch blocked | Medium | Backlink not verified. |
| https://www.futurepedia.io/tool/vidflux-ai | 500 | Page response mentioned VidFlux, no parsed outbound link | Medium | Needs browser/manual verification. |
| https://aiwith.me/tools/vidflux-ai/ | 404 | Candidate page not found | Low | Likely dead URL. |
| https://www.saashub.com/vidflux | 403 | Search candidate, fetch blocked | Medium | Backlink not verified. |
| https://www.saashub.com/vidflux-alternatives | 403 | Search candidate, fetch blocked | Medium | Backlink not verified. |
| https://eliteai.tools/tool/vidflux | 200 | Page mentions VidFlux, no parsed outbound anchor | Medium | May use JS/redirect or no direct backlink. |
| https://www.scamadviser.com/check-website/vidflux.ai | 403 | Response text mentioned vidflux.ai, fetch blocked | Medium | Trust/check page candidate, not a promotional directory backlink. |
| https://www.reddit.com/r/u_softtechhubus/comments/1nkbuxc | ERR | Local fetch failed | Low | Needs browser or Reddit API/manual check. |

## Summary

- Verified linking source pages: 8
- Verified unique source domains: 8
- Blocked/unverified candidates: 12
- Most verified links are AI/tool directory listings.
- Several backlinks carry tracking parameters (`utm_source`, `ref`) and should be normalized to `https://vidflux.ai/` or `https://vidflux.ai/ai-video-generator` for dedupe.
- ToolHunt uses a malformed target URL with `??ref=toolhunt.io`.

## Suggested Next Checks

1. Open blocked candidates with a browser to confirm whether a visible outbound link exists.
2. Run a backlink crawler/API export from Ahrefs, Semrush, Google Search Console, or Bing Webmaster Tools if account access exists.
3. Normalize all discovered target URLs by removing `utm_*` and `ref` parameters before dedupe.
4. Verify whether each outbound link is visible in rendered DOM and whether it has `nofollow`, `sponsored`, or redirect wrapping.
