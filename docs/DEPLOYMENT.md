# Going live

How to put Bada Bazar on the internet: one small server runs the database, the API, nightly backups and a web server that serves three HTTPS sites. Everything is in `deploy/`.

| Address | What it is |
|---|---|
| `https://api.<domain>` | The backend (the Android app and both websites talk to it) |
| `https://shop.<domain>` | The customer web app. Its Welcome page is also the one sign-in page for the shop owner. Legal pages live at `/legal/…`. |
| `https://admin.<domain>` | The shop owner's dashboard |

Plan about two hours the first time. Steps marked **(you)** need your accounts or decisions.

---

## 1. Accounts and decisions (you)

1. **A domain.** Any registrar works (for example `badabazar.in`). You need to edit its DNS records.
2. **A server in or near India.** One small Linux machine is enough for one shop: 2 vCPU, 2–4 GB RAM, 40 GB disk, Ubuntu 24.04. Any provider with a Mumbai or Bengaluru region works. Note its public IP address.
3. **Cloudinary** (free tier is fine): copy the `CLOUDINARY_URL` from its dashboard. This stores product photos.
4. **Firebase** project for push notifications: follow [SETUP_PUSH_NOTIFICATIONS.md](SETUP_PUSH_NOTIFICATIONS.md) and download the **service-account key** (a JSON file).
5. **Google sign-in** for production: in Google Cloud Console, on the OAuth **web** client add `https://shop.<domain>` to *Authorized JavaScript origins*. Keep the web client ID, and the Android client ID from [SETUP_GOOGLE_SIGNIN.md](SETUP_GOOGLE_SIGNIN.md).

## 2. Point the domain at the server (you)

Create three DNS **A** records, each pointing at the server's IP: `api`, `admin`, `shop`. Wait until `ping api.<domain>` answers from that IP (usually minutes, sometimes an hour).

## 3. Prepare the server

Log in over SSH, then:

```bash
# Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER && newgrp docker

# Firewall: only SSH and the web
sudo ufw allow OpenSSH && sudo ufw allow 80 && sudo ufw allow 443 && sudo ufw --force enable

# The code
git clone https://github.com/vaibhav668/shop_app.git && cd shop_app/deploy
```

## 4. Settings and secrets

```bash
cp .env.example .env
nano .env
```

Fill in every value. Generate the two secrets with:

```bash
openssl rand -hex 24   # POSTGRES_PASSWORD
openssl rand -hex 48   # JWT_SECRET
```

`GOOGLE_ALLOWED_CLIENT_IDS` lists the web **and** Android client IDs, comma-separated. `ADMIN_EMAILS` is the owner's Google address.

Copy the Firebase key onto the server (from your laptop):

```bash
scp firebase-service-account.json <user>@<server-ip>:~/shop_app/deploy/secrets/firebase.json
chmod 600 ~/shop_app/deploy/secrets/firebase.json
```

The API refuses to start in production with a weak `JWT_SECRET`, local photo storage, fake push or dev login switched on. That's deliberate.

## 5. Start

```bash
docker compose up -d --build
docker compose ps          # all services "running"; api becomes "healthy" within a minute
docker compose logs -f api # Ctrl+C to stop following
```

Database migrations run automatically every time the API starts. Caddy fetches HTTPS certificates on the first request to each address.

Check:

- `https://api.<domain>/api/v1/health/db` shows `{"status":"ok"}`
- `https://shop.<domain>` opens the welcome page; sign in with the owner's Google account and you are handed into `https://admin.<domain>`
- `https://shop.<domain>/legal/privacy` shows the privacy policy

## 6. Point the Android app at production

In `mobile/.env` set:

```
EXPO_PUBLIC_API_URL=https://api.<domain>/api/v1
EXPO_PUBLIC_ADMIN_URL=https://admin.<domain>
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=<web client id>
```

Then build as described in [PLAY_STORE.md](PLAY_STORE.md). For EAS cloud builds, set the same three values as EAS environment variables for the `production` profile.

## 7. Backups

The `backup` service writes a full database dump to `deploy/backups/` at start-up and every night at about 02:30 IST, and keeps 14 days.

**Copy them off the server.** A backup on the same disk is lost with the disk. The simplest way is to pull them to your laptop weekly:

```bash
rsync -av <user>@<server-ip>:~/shop_app/deploy/backups/ ./bada-bazar-backups/
```

### Restore drill (do this once before launch)

```bash
cd ~/shop_app/deploy
ls backups/                              # pick the newest file
sh restore.sh backups/shop-<date>.dump   # type RESTORE to confirm
```

The script stops the API, replaces the database with the dump, and starts the API again. Open the admin and check that today's products and orders are there.

## 8. Updating to a new version

```bash
cd ~/shop_app && git pull
cd deploy && docker compose up -d --build
```

Migrations run on start. If something goes wrong, `git checkout <previous commit>` and run the same command; restore last night's backup only if a migration damaged data.

## 9. Keeping an eye on it

- **Uptime:** add `https://api.<domain>/api/v1/health/db` to a free uptime monitor (for example UptimeRobot) with SMS or email alerts.
- **Logs:** `docker compose logs --since 1h api`.
- **Disk:** `df -h` monthly; old backups are pruned automatically.
- **Security updates:** `sudo apt update && sudo apt upgrade` monthly; rebuild with `docker compose up -d --build --pull always` to pick up base-image fixes.
- Before every release, rerun the dependency checks listed in [SECURITY.md](SECURITY.md).

## 10. Legal pages

The pages in `deploy/legal/` (privacy, terms, refunds, account deletion) contain placeholders such as **[shop address]**, **[shop phone]** and **[shop email]**. Replace them before going live, then rebuild with `docker compose up -d --build web`. Their addresses are what the Play Store asks for:

- Privacy policy: `https://shop.<domain>/legal/privacy`
- Account deletion: `https://shop.<domain>/legal/account-deletion`
