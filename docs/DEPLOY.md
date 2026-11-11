# Putting Payper on the internet (public read-only site)

**Status: prepared, not deployed.** Nothing has been created, uploaded or paid for. The steps marked **YOU** need your own accounts and a payment card. Nobody else can or should do them for you.

## What the public site is (and is not)

- It is the same paper-trading desk, running in **public read-only mode** (`PAYPER_MODE=public`).
- Every visitor sees **one shared demonstration paper account**: virtual USD, labelled *SHARED DEMONSTRATION · not your wallet*. It is nobody's real money and nobody's wallet.
- **Nobody can change anything from the web**, not even you. Pause, Reset, saving agents and Start/Stop/Delete are hidden in the page, and the server refuses every change request with `403 read-only`. There is no admin page, no login, no wallet sign-in and no API that writes. To change settings you edit them on the host and redeploy.
- The PAYPER token line shows **NOT LAUNCHED YET** until you set `TOKEN_MINT` (see [CONTRACT-ADDRESS.md](CONTRACT-ADDRESS.md)).
- Real trading is not implemented. The site says so.

Your own computer (START.bat) stays in **local mode** with the private controls, reachable only from that computer.

## Cost: check this before paying

From Render's pricing page, read on **11 Nov 2026**. Prices can change, so check https://render.com/pricing on the day you pay.

| Item | Price |
|---|---|
| Workspace plan "Hobby" | $0 per month (you pay only for compute) |
| Web service, plan **Starter / 0.5c-512mb** (0.5 CPU, 512 MB) | **$7.00 per month** |
| Persistent disk, **1 GB** | $0.25 per GB per month = **$0.25 per month** |
| Bandwidth | 5 GB per month included, then $0.15 per GB |
| **Expected total** | **about $7.25 per month**, plus any tax and any bandwidth over 5 GB |

Why not free: Render's free web service sleeps when idle and cannot have a disk, so the shared paper record would be wiped on every restart. A disk needs a paid service.

Render shows the price on the creation form before you confirm. Compare it with this table. If it differs, stop and check.

## What YOU need first

1. **A Render account**: sign up at https://dashboard.render.com and add a payment card (needed for the paid service).
2. **The code in a Git repository.** Render deploys from GitHub, GitLab or Bitbucket. It cannot take a zip upload. There is no ready-made image either: nothing has been published to Docker Hub or any registry.
   - Create a **private** repository (for example on GitHub: **New repository** → name `payper` → **Private** → **Create**).
   - Unzip `payper-greenbar.zip` and upload **the contents of the `payper-greenbar` folder** (so `package.json`, `render.yaml` and the `server` folder sit at the top of the repo). On GitHub: **Add file → Upload files**, drag the files and folders in, then **Commit changes**.
   - The `data` folder is empty apart from `.keep`. Never commit a `.env` file or any private key (this app needs none).
3. Connect that Git account to Render when Render asks (**New + → Web Service → Connect GitHub/GitLab/Bitbucket**) and allow access to just that repo.

## Option 1 (recommended): Render Dashboard, native Node.js

In the Render Dashboard: **New + → Web Service** → pick your `payper` repository, then fill in:

| Field | Value |
|---|---|
| Name | `payper` (your free address becomes `https://payper.onrender.com`, or a variant if that name is taken) |
| Region | any; **Singapore** is closest to Manila |
| Branch | `main` |
| Language / Runtime | **Node** |
| Build Command | `true` (there is nothing to install; `npm install` also works) |
| Start Command | `node server/server.mjs` |
| Instance type | **Starter** (0.5 CPU, 512 MB, $7/month). **Not Free.** |

Then open **Advanced**:

- **Health Check Path:** `/healthz`
- **Add Disk:** Name `payper-data`, Mount Path **`/var/data`**, Size **1 GB**. You can grow it later, never shrink it. 1 GB is far more than this app needs.
- **Environment Variables** (Add Environment Variable):

| Key | Value | Needed? |
|---|---|---|
| `PAYPER_MODE` | `public` | **required**: turns on read-only mode |
| `DATA_DIR` | `/var/data` | **required**: must equal the disk Mount Path, or the paper record is lost on every deploy |
| `NODE_VERSION` | `24` | recommended |
| `PUBLIC_ORIGIN` | leave out for now | only for your own domain, see below. Without it, the app uses Render's own `https://<name>.onrender.com` address (`RENDER_EXTERNAL_URL`) |
| `TOKEN_MINT` | leave out | only when the token really exists ([CONTRACT-ADDRESS.md](CONTRACT-ADDRESS.md)) |
| `PORT` | leave out | Render sets it (10000) and the app listens on it |

Click **Deploy Web Service**. When the log shows `Payper (PAYPER) is running … PUBLIC READ-ONLY mode` and the status is **Live**, open the address.

**Check after the first deploy:**
- the page shows *SHARED DEMONSTRATION · READ-ONLY* and *PAYPER token · NOT LAUNCHED YET*;
- there are no Pause or Reset buttons;
- `https://<your-address>/healthz` shows `ok`;
- `https://<your-address>/paper.config.json` shows *Not found*.

The account starts empty ($10,000 virtual cash, no trades). Trades appear only when the real market data meets the rules.

## Option 2: Render Blueprint (`render.yaml`, same result)

The repo includes `render.yaml` with the same settings: Starter plan, `/healthz`, a 1 GB disk at `/var/data`, `PAYPER_MODE=public`, `DATA_DIR=/var/data`, `NODE_VERSION=24` and auto-deploy off. In the Dashboard choose **New + → Blueprint**, pick the repo, review the resources and the price shown, then apply.

It was checked against Render's published schema but **not** validated with the Render CLI or tried on a real account. If Render's form reports a problem, use Option 1. `TOKEN_MINT` and `PUBLIC_ORIGIN` are deliberately not in the file. Add them in **Environment**; Render keeps Dashboard variables that the Blueprint does not list.

## Option 3: Docker (Render "Docker" runtime or another container host)

A `Dockerfile` is included (node:24-alpine, runs as the unprivileged `node` user, `PAYPER_MODE=public`, `DATA_DIR=/data`, health check on `/healthz`). It was **not built or tested**: Docker was not available on the build machine. On Render choose Language **Docker**, mount the disk at **`/data`** and set `DATA_DIR=/data`. If the log says *cannot write to its data folder*, the disk is not writable by the `node` user; use Option 1 instead. Other hosts must provide `PUBLIC_ORIGIN` (exact `https://` address), a volume at `/data`, and pass the original `Host` header through their proxy.

## Your own domain (optional, later)

1. Render → service → **Settings → Custom Domains → Add**, then follow Render's DNS instructions at your domain registrar (Render issues the HTTPS certificate).
2. **Environment** → add `PUBLIC_ORIGIN` = `https://your-domain.com` (exact: `https://`, no path, no trailing slash, no `*`).
3. If you also use `www.`, add `TRUSTED_HOSTS` = `www.your-domain.com`. Exact names only, separated by commas.
4. **Save and deploy.** The `onrender.com` address keeps working too (it is trusted automatically).

## Changing things later

Settings, watchlist and limits come from `paper.config.json` in the repo: change the file in the repo, then **Manual Deploy → Deploy latest commit**. Environment variables: **Environment → Save and deploy**.

The paper record on the disk is kept across deploys. There is **no web reset**. To start the shared account over, delete `paper-state.json` (and `.bak`) from `/var/data` with Render's **Shell** tab, then redeploy. Render takes daily disk snapshots, kept 7 days.

**Downtime:** with a disk, Render runs exactly one instance and stops it before starting the new one. Each deploy means a short outage, and a deploy that fails to start (for example a wrong `TOKEN_MINT`) leaves the site offline until a good deploy. The log names the wrong setting.

## Security behaviour in public mode (what the server enforces)

- Listens on `0.0.0.0:$PORT` only when `PAYPER_MODE=public`; local mode always uses 127.0.0.1.
- Accepts requests only for the exact host in `PUBLIC_ORIGIN` / `RENDER_EXTERNAL_URL`, plus Render's own `RENDER_EXTERNAL_HOSTNAME` and any exact `TRUSTED_HOSTS`. Everything else gets `421`. `X-Forwarded-*` headers are never trusted. `PUBLIC_ORIGIN` must be `https://` (plain `http://` only for `localhost` tests); wildcards, paths and credentials are rejected at start.
- Every POST/PUT/PATCH/DELETE under `/api/` gets `403 read-only` before the request body is read.
- Serves only the `public/` folder. The config, server code, tests and data files are never served. API answers contain no server file paths.
- Sends a strict Content-Security-Policy and HSTS (`max-age=31536000`) when the origin is `https://`.
- At most 200 open live-update streams (`MAX_STREAMS`). There is no other rate limiting in the app.
- Wrong or missing settings stop the start with a plain-language list of what to fix.

## Static-only alternative (brochure)

`preview.html` with `public/css`, `public/img` and `public/fonts` can be hosted as a static page (for example Cloudflare Pages or Render Static Site, both free). It is a **design preview with example data**, clearly labelled as such. It shows *NOT LAUNCHED YET* and never live status, so it does not replace the live desk. If you set a token address later, the static preview does **not** update; only the live site shows it.

## Not tested

No deploy was made. Render, Docker, the Blueprint flow and a custom domain were not tried. Public mode was tested locally on the build machine (Linux, Node 24) with automated tests and a local server.
