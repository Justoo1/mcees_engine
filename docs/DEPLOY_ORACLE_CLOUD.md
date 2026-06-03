# Deploying mcees_engine to Oracle Cloud Always Free

This runs the entire stack (Postgres, Redis, API, worker, dashboard, Caddy)
on a single Always-Free ARM VM (4 vCPU, 24 GB RAM) with auto-renewing TLS.
Recurring cost: **$0**.

Time required: ~45 minutes for the first deploy.

---

## 0. What you'll have at the end

```
                       Internet
                          │
                  https://YOURDOMAIN
                          │
                  ┌───────▼───────┐
                  │     Caddy     │  (80/443, TLS via Let's Encrypt)
                  └───┬───────┬───┘
                      │       │
                  ┌───▼──┐ ┌──▼────────┐
                  │  api │ │ dashboard │
                  └──┬───┘ └──┬────────┘
                     │        │
                ┌────▼────────▼────┐
                │ postgres │ redis │
                └──────────────────┘
        all internal — only Caddy is exposed publicly
```

---

## 1. Create an Oracle Cloud account

1. Go to https://signup.cloud.oracle.com
2. Use a personal email. Pick **"Always Free"**.
3. You'll be asked for a credit card — this is for identity verification.
   Oracle's Always Free resources literally cannot be upgraded by accident.
4. Pick the home region carefully: **you cannot change it later**.
   Choose the closest to your demo audience.

> ⚠️  Always-Free Ampere capacity is sometimes exhausted in popular regions.
> If you see "Out of capacity" later, retry over a few hours, or try a
> nearby region during account creation.

---

## 2. Provision the VM (Always-Free Ampere A1)

In the Oracle Cloud Console:

1. **Hamburger menu → Compute → Instances → Create instance**
2. **Name**: `mcees-prod`
3. **Image and shape → Edit**:
   - **Image**: Canonical **Ubuntu 22.04** (or 24.04)
   - **Shape**: change to **Ampere → VM.Standard.A1.Flex**
   - **OCPU**: `4`  ·  **Memory (GB)**: `24`
4. **Networking** → leave the default VCN/subnet selections; ensure
   "Assign a public IPv4 address" is checked.
5. **Add SSH keys** → upload your local `~/.ssh/id_ed25519.pub`
   (or generate a new keypair from the console and download it).
6. **Boot volume** → leave default (50 GB is fine; you have 200 GB free).
7. **Create**.

Wait ~1 minute for state = **Running**. Copy the **Public IP address**.

---

## 3. Open ports 80 and 443

By default Oracle's VCN blocks everything except SSH.

1. **Networking → Virtual Cloud Networks → your VCN → Security Lists →
   Default Security List**
2. **Add Ingress Rules**:
   - Source CIDR `0.0.0.0/0`, IP Protocol `TCP`, Destination Port `80`
   - Source CIDR `0.0.0.0/0`, IP Protocol `TCP`, Destination Port `443`
3. (Optional) For HTTP/3, also add UDP port `443`.

Then on the VM itself (Ubuntu's iptables ships configured to reject
most inbound traffic):

```bash
ssh ubuntu@<PUBLIC_IP>

sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80  -j ACCEPT
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT
sudo netfilter-persistent save
```

---

## 4. Point a domain at the VM

You need a domain so Caddy can issue Let's Encrypt certificates.

**Free option — DuckDNS:**
1. Sign in at https://www.duckdns.org with GitHub
2. Claim a subdomain, e.g. `mcees-yourname.duckdns.org`
3. Set its IP to your VM's public IP. Click **update**.
4. (Optional) On the VM, schedule an auto-update so the record self-heals
   if the IP ever changes — DuckDNS gives you a one-line cron snippet on
   the same page.

**If you own a real domain:** add an A record:
```
mcees.yourdomain.com  →  <PUBLIC_IP>
```
(Optionally also `api.mcees.yourdomain.com` → same IP, if you want the
FastAPI endpoint reachable publicly for webhooks.)

Wait ~1 minute for DNS to propagate, then verify:
```bash
dig +short mcees-yourname.duckdns.org    # should print the public IP
```

---

## 5. Install Docker on the VM

```bash
ssh ubuntu@<PUBLIC_IP>

# Docker via the official convenience script
curl -fsSL https://get.docker.com | sudo sh

# Allow non-root use (re-login after this)
sudo usermod -aG docker $USER

# Sanity check (after re-login)
exit
ssh ubuntu@<PUBLIC_IP>
docker compose version
```

---

## 6. Clone the repo and configure `.env`

```bash
cd ~
git clone https://github.com/<your-username>/mcees_engine.git
cd mcees_engine

cp .env.production.example .env
nano .env
```

Fill in **at minimum**:
- `POSTGRES_PASSWORD` → `openssl rand -hex 24`
- Both `POSTGRES_URL` and `DATABASE_URL` → use the same password
- `AUTH_SECRET` → `openssl rand -hex 32`
- `ODOO_*` → your real Odoo instance
- `SHOPIFY_WEBHOOK_SECRET` and `WOOCOMMERCE_WEBHOOK_SECRET` →
  generate fresh with `openssl rand -hex 32` and copy the SAME value
  into your Shopify/WooCommerce webhook config
- `PUBLIC_DOMAIN` → `mcees-yourname.duckdns.org` (no protocol prefix)
- `ACME_EMAIL` → your real email

---

## 7. First deploy

```bash
docker compose up -d --build
```

The first build takes ~5–8 minutes (slower on ARM). Watch progress:
```bash
docker compose logs -f
```

Verify each service is healthy:
```bash
docker compose ps
# All five should be "running" (Caddy shows no health status, that's fine)

curl -k https://localhost/health  # bypasses Caddy via host port
```

When Caddy logs `certificate obtained successfully`, hit your domain in
a browser:
```
https://mcees-yourname.duckdns.org
```
You should land on the **Sign in** page.

---

## 8. Create the first admin user

The first user to sign up is auto-promoted to `ADMIN`. Go to
`https://YOURDOMAIN/signup` in your browser and create an account.

Alternative — seed via CLI:
```bash
docker compose exec dashboard sh -c "node ./node_modules/prisma/build/index.js generate && \
  SEED_ADMIN_EMAIL=you@example.com SEED_ADMIN_PASSWORD='your-strong-pass' \
  npx tsx prisma/seed.ts"
```

---

## 9. Ongoing operations

**Deploy a new version:**
```bash
make prod-pull-deploy
```
(Pulls `git pull --ff-only`, rebuilds changed images, restarts api +
worker + dashboard without restarting Postgres/Redis/Caddy.)

**Tail logs:**
```bash
make prod-logs
docker compose logs -f dashboard       # one service only
```

**Back up the database:**
```bash
make prod-backup-db
# Writes backups/<timestamp>.sql.gz on the VM
```

Schedule daily backups via cron:
```bash
crontab -e
# Add:
0 3 * * * cd /home/ubuntu/mcees_engine && /usr/bin/make prod-backup-db >> /var/log/mcees-backup.log 2>&1
```

For off-VM safety, periodically `scp` the `backups/` dir to a second
host or upload to OCI Object Storage (also free).

---

## 10. Pointing Shopify / WooCommerce at it

In each platform's admin:
- **Endpoint URL**: `https://api.YOURDOMAIN/api/v1/webhooks/shopify/orders`
  (or `/woocommerce/orders`, etc.)
- **Secret**: the same value you put in `SHOPIFY_WEBHOOK_SECRET` /
  `WOOCOMMERCE_WEBHOOK_SECRET`

Fire a test from the platform; watch `make prod-logs` for the
`RECEIVED → PROCESSING → SYNCED` flow.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `caddy: failed to obtain certificate` | DNS hasn't propagated, or port 80 isn't reachable | `dig +short YOURDOMAIN`; re-check Security List + iptables rules |
| `dashboard` keeps restarting | `AUTH_SECRET` not set or under 32 chars | Check `.env`, regenerate, `docker compose up -d dashboard` |
| `api` healthcheck fails | DB migration hasn't run | The dashboard runs `prisma db push` on startup — wait for it, or run manually |
| OOM kills | Three services + DB on 24 GB should never OOM; usually a runaway query. `docker stats` to see who | Tune Postgres `shared_buffers` or kill the offender |
| "Out of host capacity" creating the VM | Always-Free Ampere region is saturated | Retry hourly, or pick a different region (you can only do this during signup) |

---

## What's NOT in this setup (and when to add it)

- **CDN** — for a portfolio demo, Caddy serving directly is fine
- **Centralised logging** — `docker compose logs` is enough; add Loki/Grafana if you scale
- **External DB** — single-VM is fine until you outgrow Always-Free
- **Blue/green deploys** — `prod-pull-deploy` causes ~10s of downtime per service; that's acceptable here
- **Worker autoscaling** — add a second worker service with different queue
  routing if traffic justifies it
