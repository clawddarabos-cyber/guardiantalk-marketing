# GuardianTalk marketing site

Static marketing site for `guardiantalk.com`.

## Brand system

The site follows the GuardianTalk developer brand kit:

- Official teal `#00CDD1`, gold `#FFC51E`, black, white, and ink `#10242A`
- Official symbol SVG in navigation and footer lockups
- Official bordered app icon for product, favicon, and touch-icon use
- Approved tight reference artwork for the social sharing card

Canonical tokens and the brand handoff notes are preserved in `assets/brand/`.

## Local preview

```sh
python3 -m http.server 4173 --directory guardian-site
```

## Deploy

```sh
CLOUDFLARE_API_TOKEN="$(security find-generic-password -a john-darabos -s openclaw-cloudflare-api-token -w)" \
  npx wrangler pages deploy guardian-site --project-name guardiantalk --branch main
```

The public download CTA currently routes to the early-access email flow until signed Mac and Windows installers exist.
