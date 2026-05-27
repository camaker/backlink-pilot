# Pricing Review Queue

Generated: 2026-05-27T10:28:13.101Z

Policy: read-only queue for runnable targets whose pricing is still `unknown`. This file does not approve submissions and does not write the registry.

## Summary

- Total candidates: 44
- Selected rows: 44
- Rows with scout evidence: 42
- Rows with forms: 37
- Submitted rows still needing pricing classification: 0

### By Mode

| Mode | Count |
|---|---:|
| assisted | 44 |

## Rows

| Order | Priority | Target ID | Domain | Mode | Submit URL |
|---|---|---|---|---|---|
| 1 | P1 | 247webdirectory | 247webdirectory.com | assisted | https://www.247webdirectory.com/ |
| 2 | P1 | asr | activesearchresults.com | assisted | https://www.activesearchresults.com/addwebsite.php |
| 3 | P1 | ai-ailookme | ailookme.com | assisted | https://www.ailookme.com/%e7%bd%91%e5%9d%80%e6%8f%90%e4%ba%a4 |
| 4 | P1 | ai-nav | ainavpro.com | assisted | https://www.ainavpro.com/contribute |
| 5 | P1 | appalist-com | appalist.com | assisted | https://appalist.com/ |
| 6 | P1 | ashlist-com | ashlist.com | assisted | https://ashlist.com/ |
| 7 | P1 | foundr-ai | foundr.ai | assisted | https://foundr.ai/ |
| 8 | P1 | hhlink-com | hhlink.com | assisted | https://www.hhlink.com/%E6%8F%90%E4%BA%A4%E6%96%B0%E7%BD%91%E7%AB%99 |
| 9 | P1 | iforai | iforai.com | assisted | https://iforai.com/submit_website |
| 10 | P1 | launchscroll-com | launchscroll.com | assisted | https://launchscroll.com/ |
| 11 | P1 | mylaunchstash-com | mylaunchstash.com | assisted | https://mylaunchstash.com/ |
| 12 | P1 | offpagesavvy | offpagesavvy.com | assisted | https://www.offpagesavvy.com/submit-your-site |
| 13 | P1 | poweruptools-com | poweruptools.com | assisted | https://poweruptools.com/ |
| 14 | P1 | productlistdir-com | productlistdir.com | assisted | https://productlistdir.com/ |
| 15 | P1 | productwing-com | productwing.com | assisted | https://productwing.com/ |
| 16 | P1 | saasfield-com | saasfield.com | assisted | https://saasfield.com/ |
| 17 | P1 | saashubdirectory-com | saashubdirectory.com | assisted | https://saashubdirectory.com/ |
| 18 | P1 | saasroots-com | saasroots.com | assisted | https://saasroots.com/ |
| 19 | P1 | smartkithub-com | smartkithub.com | assisted | https://smartkithub.com/ |
| 20 | P1 | softwarebolt-com | softwarebolt.com | assisted | https://softwarebolt.com/ |
| 21 | P1 | solvertools-com | solvertools.com | assisted | https://solvertools.com/ |
| 22 | P1 | sourcedir-com | sourcedir.com | assisted | https://sourcedir.com/ |
| 23 | P1 | stackdirectory-com | stackdirectory.com | assisted | https://stackdirectory.com/ |
| 24 | P1 | startupvessel-com | startupvessel.com | assisted | https://startupvessel.com/ |
| 25 | P1 | theapptools-com | theapptools.com | assisted | https://theapptools.com/ |
| 26 | P1 | thecoretools-com | thecoretools.com | assisted | https://thecoretools.com/ |
| 27 | P1 | tinytoolhub-com | tinytoolhub.com | assisted | https://tinytoolhub.com/ |
| 28 | P1 | toolcosmos-com | toolcosmos.com | assisted | https://toolcosmos.com/ |
| 29 | P1 | toolfinddir-com | toolfinddir.com | assisted | https://toolfinddir.com/ |
| 30 | P1 | toolsignal-com | toolsignal.com | assisted | https://toolsignal.com/ |
| 31 | P1 | toolslisthq-com | toolslisthq.com | assisted | https://toolslisthq.com/ |
| 32 | P1 | toolsunderradar-com | toolsunderradar.com | assisted | https://toolsunderradar.com/ |
| 33 | P1 | toptrendtools-com | toptrendtools.com | assisted | https://toptrendtools.com/ |
| 34 | P1 | toshilist-com | toshilist.com | assisted | https://toshilist.com/ |
| 35 | P1 | trustiner-com | trustiner.com | assisted | https://trustiner.com/ |
| 36 | P1 | weliketools-com | weliketools.com | assisted | https://weliketools.com/ |
| 37 | P1 | xinquji-com | xinquji.com | assisted | https://xinquji.com/ |
| 38 | P1 | aitoptools | aitoptools.com | assisted | https://aitoptools.com/login?redirect_to=submit |
| 39 | P1 | broadwise-org | broadwise.org | assisted | https://broadwise.org/t/how-to-promote-your-startup-on-broadwise-org/125 |
| 40 | P1 | dizkaz-com | dizkaz.com | assisted | https://dizkaz.com/ |
| 41 | P1 | gainweb-org | gainweb.org | assisted | https://gainweb.org/ |
| 42 | P1 | openfuture-ai | openfuture.ai | assisted | https://openfuture.ai/zh/submit-tool |
| 43 | P1 | www-ruanyifeng-com | ruanyifeng.com | assisted | https://www.ruanyifeng.com/ |
| 44 | P1 | wechalet-cn | wechalet.cn | assisted | https://wechalet.cn/appstore/add |

## Next Commands

```powershell
node src/cli.js targets pricing-review-evidence backlink-url/auth-triage-pricing/pricing-review-queue.csv --output backlink-url/pricing-review/pricing-review-evidence.csv --json-output backlink-url/pricing-review/pricing-review-evidence.json
node src/cli.js targets pricing-review-suggest backlink-url/auth-triage-pricing/pricing-review-queue.csv backlink-url/pricing-review/pricing-review-evidence.csv --output backlink-url/pricing-review/pricing-review-suggestions.csv --json-output backlink-url/pricing-review/pricing-review-suggestions.json
```
