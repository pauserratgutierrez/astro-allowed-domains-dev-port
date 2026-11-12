// For each origin: a cross-origin request to `astro dev`, the same host as X-Forwarded-Host to the built server, and the exported validator.
import { spawn } from "node:child_process";
import { BaseApp } from "astro/app";
import { allowedDomains } from "./allowed-domains.mjs";

const origins = [
  "https://shop.example.com", // matches { hostname: "**.example.com", protocol: "https" }
  "https://staging.myapp.com", // matches { hostname: "staging.myapp.com", protocol: "https", port: "443" }
  "https://evil.example.org", // matches nothing
];

/** Runs a server, resolves with its origin once it prints one, and keeps what it writes. */
function run(args, env = {}) {
  const child = spawn(process.execPath, args, { env: { ...process.env, ...env } });
  let output = "";
  child.stdout.on("data", (chunk) => (output += chunk));
  child.stderr.on("data", (chunk) => (output += chunk));
  const origin = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`server did not start\n${output}`)), 20_000);
    const check = setInterval(() => {
      const match = /http:\/\/(?:localhost|127\.0\.0\.1):\d+/.exec(output);
      if (match) {
        clearInterval(check);
        clearTimeout(timer);
        resolve(match[0]);
      }
    }, 50);
  });
  return { child, origin, output: () => output };
}

const dev = run(["node_modules/astro/bin/astro.mjs", "dev", "--port", "4399"]);
const built = run(["dist/server/entry.mjs"], { HOST: "127.0.0.1", PORT: "0" });
const [devOrigin, builtOrigin] = await Promise.all([dev.origin, built.origin]);

const rows = [];
for (const origin of origins) {
  const host = new URL(origin).host;
  // What a browser sends for a fetch() or module script from a page on `origin`.
  const fromDev = await fetch(devOrigin + "/", {
    headers: { Origin: origin, "Sec-Fetch-Site": "cross-site", "Sec-Fetch-Mode": "cors" },
  });
  const devBody = (await fromDev.text()).trim();
  // What a TLS-terminating proxy for `origin` sends.
  const fromBuilt = await fetch(builtOrigin + "/", {
    headers: { "X-Forwarded-Host": host, "X-Forwarded-Proto": "https" },
  });
  const url = /<p>(.*?)<\/p>/.exec(await fromBuilt.text())?.[1];
  rows.push({
    origin,
    "astro dev": `${fromDev.status}${fromDev.status === 403 ? ` ${devBody}` : ""}`,
    "built server: Astro.url": url,
    "BaseApp.validateForwardedHost": BaseApp.validateForwardedHost(host, allowedDomains, "https"),
  });
}

dev.child.kill();
built.child.kill();
console.table(rows);
console.log("\nastro dev warnings:");
for (const line of dev.output().split("\n")) if (line.includes("Blocked")) console.log(line.replace(/\x1b\[[0-9;]*m/g, "").trim());
