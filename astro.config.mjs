import node from "@astrojs/node";
import { defineConfig } from "astro/config";
import { allowedDomains } from "./allowed-domains.mjs";

export default defineConfig({
  output: "server",
  adapter: node({ mode: "standalone" }),
  security: { allowedDomains },
});
