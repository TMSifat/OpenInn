# Deployment

OpenInn runs anywhere Docker or Node.js 24 runs: a home server, a Raspberry Pi 4/5, or a $5/month VPS.

## Docker Compose (recommended)

```bash
git clone https://github.com/TMSifat/OpenInn.git
cd OpenInn
cp .env.example .env      # set DASHBOARD_PASSWORD, AI_MODEL and its key, and your PMS credentials
docker compose up -d
docker compose logs -f    # watch the poller start
```

- **`./properties`** is mounted into the container. Edit property files on the host and changes apply to the next message.
- **The SQLite database** is stored in the `openinn-data` Docker volume.
- **Ollama on the same machine:** set `OLLAMA_URL=http://host.docker.internal:11434`.

### Updating

```bash
git pull
docker compose up -d --build
```

### Backups

The whole state is one SQLite file. Back it up with:

```bash
docker compose exec openinn node -e "new (require('node:sqlite').DatabaseSync)('/app/data/openinn.db').exec(\"VACUUM INTO '/app/data/backup.db'\")"
docker compose cp openinn:/app/data/backup.db ./openinn-backup.db
```

Your property files are already on the host, so keep them in git or your normal backups.

## Node.js without Docker

```bash
npm ci
npm run build
npm start                 # serves on port 3000; set PORT to change
```

Run it under a process manager such as systemd or pm2 so it restarts after a reboot.

## HTTPS

The dashboard uses HTTP Basic authentication. The password is sent with every request, so **never expose the dashboard over plain HTTP on the internet.** Pick one of these:

- **Keep it private:** reach it over [Tailscale](https://tailscale.com) or your home network only.
- **Cloudflare Tunnel:** `cloudflared tunnel --url http://localhost:3000` gives you HTTPS without opening ports.
- **Reverse proxy:** for example [Caddy](https://caddyserver.com), which gets certificates automatically:

  ```
  openinn.example.com {
      reverse_proxy localhost:3000
  }
  ```

Set `PUBLIC_URL` to the address you use, so links in alerts point to the right place.

## Checklist before going live

- [ ] `DASHBOARD_PASSWORD` is long and unique
- [ ] The dashboard is reachable only over HTTPS or a private network
- [ ] Every property file has the correct `listing_id`
- [ ] Every property is in `mode: draft` for the first days
- [ ] A test alert reaches your Telegram or email. Use **Simulate a guest message** with "I want a refund".
- [ ] You've checked several drafts for each property before switching any to `autopilot`
