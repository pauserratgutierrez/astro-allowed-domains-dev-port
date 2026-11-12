# An `allowedDomains` entry with `port: "443"` never matches in `astro dev`

The `security.allowedDomains` example in Astro's docs lists `{ hostname: "staging.myapp.com", protocol: "https", port: "443" }`. Since Astro 7.4.11 the built server accepts `https://staging.myapp.com` with it, but the dev server's cross-origin check (`secFetchMiddleware`) blocks every request from that origin with 403: it matches with `BaseApp.validateForwardedHost`, which still applies the rules from before 7.4.11.

## Run

```sh
npm install
npm run build
npm run repro
```

`npm run repro` starts `astro dev` and the built server (`node dist/server/entry.mjs`), then, for each of three origins:

- sends `astro dev` what a browser sends for a `fetch()` or a module script from a page on that origin: `Origin`, `Sec-Fetch-Site: cross-site`, `Sec-Fetch-Mode: cors`;
- sends the built server that host as a TLS-terminating proxy does (`X-Forwarded-Host`, `X-Forwarded-Proto: https`), and reads `Astro.url` from the page;
- calls `BaseApp.validateForwardedHost` from `astro/app`, as the dev server's check does.

`allowed-domains.mjs` holds the docs' example, and `astro.config.mjs` uses it.

## Result

```
┌─────────┬─────────────────────────────┬────────────────────────────────────┬──────────────────────────────┬───────────────────────────────┐
│ (index) │ origin                      │ astro dev                          │ built server: Astro.url      │ BaseApp.validateForwardedHost │
├─────────┼─────────────────────────────┼────────────────────────────────────┼──────────────────────────────┼───────────────────────────────┤
│ 0       │ 'https://shop.example.com'  │ '200'                              │ 'https://shop.example.com/'  │ true                          │
│ 1       │ 'https://staging.myapp.com' │ '403 Cross-origin request blocked' │ 'https://staging.myapp.com/' │ false                         │
│ 2       │ 'https://evil.example.org'  │ '403 Cross-origin request blocked' │ 'http://localhost/'          │ false                         │
└─────────┴─────────────────────────────┴────────────────────────────────────┴──────────────────────────────┴───────────────────────────────┘
```

Row 1 should be `200` in `astro dev`, as row 0 is: the built server accepts that origin with the same config.
