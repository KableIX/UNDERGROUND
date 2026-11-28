# members-web (dev)

Dev scaffold for the private members website. Zero dependencies (plain Node 22), no `package.json` on purpose so the pnpm workspace and lockfile are not affected. GLM may add one when needed; run `pnpm install` consequences through review.

- `server.mjs`: static server for `public/`, `/healthz`, and `/api/dev/members` (fixtures).
- Env: `PORT` (default 8795), `BIND_HOSTS` (comma list), `BUILD_SHA`.
- Data: fixtures only. This dev site has no access to the live API or any database.

Atlas deploy: on Atlas as user `glm-dev`, run `/home/glm-dev/bin/deploy-dev.sh`. It fetches `glm/social` only and restarts `underground-members-dev.service`. The site is LAN and Tailscale only.