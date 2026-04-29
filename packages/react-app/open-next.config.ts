import { defineCloudflareConfig } from "@opennextjs/cloudflare";

export default defineCloudflareConfig({
  serverFunctions: {
    default: {
      bundle: {
        external: ["jose", "jwks-rsa"],
      },
    },
  },
});