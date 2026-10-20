# Deploy Vanta on your VPS

This guide installs Vanta from the [GitHub repository](https://github.com/erron8/Vanta-watcher) with Docker Compose. It is written for an Ubuntu or Debian VPS where your SSH user can run `sudo`. The homepage will be public; `/screener`, `/bookmarks`, and their data APIs require sign-in. The built-in `admin` can add more accounts through `/admin`.

Replace `YOUR_SERVER_IP` and `vanta.yourdomain.com` with your own values. You do not need Node.js or PostgreSQL installed on the VPS.

## 1. Point your domain at the VPS

Create an **A record** for `vanta.yourdomain.com` pointing to the VPS public IPv4 address. Add an **AAAA record** only if the VPS has a working public IPv6 address. In your VPS provider firewall, allow inbound TCP ports **22** (or your custom SSH port), **80**, and **443**; UDP **443** is optional. Make sure no other web server is using ports 80 or 443.

Caddy will request and renew HTTPS certificates once the domain resolves to this server and ports 80/443 are reachable. See the [Caddy HTTPS setup guide](https://caddyserver.com/docs/quick-starts/https).

## 2. Connect to the server and install Docker

```sh
ssh YOUR_SSH_USER@YOUR_SERVER_IP
```

If Docker Engine and the Compose plugin are already installed, skip to step 3. For supported Ubuntu or Debian versions, use Docker's official package repository:

```sh
. /etc/os-release
case "$ID" in ubuntu|debian) ;; *) echo "Use the Docker install guide for your OS"; exit 1 ;; esac
sudo apt-get update
sudo apt-get install -y ca-certificates curl git
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL "https://download.docker.com/linux/$ID/gpg" -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc
sudo tee /etc/apt/sources.list.d/docker.sources >/dev/null <<EOF_DOCKER
Types: deb
URIs: https://download.docker.com/linux/$ID
Suites: ${UBUNTU_CODENAME:-$VERSION_CODENAME}
Components: stable
Architectures: $(dpkg --print-architecture)
Signed-By: /etc/apt/keyrings/docker.asc
EOF_DOCKER
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo docker compose version
```

For another Linux distribution, follow [Docker's installation guide](https://docs.docker.com/engine/install/) instead. Docker's official [Ubuntu](https://docs.docker.com/engine/install/ubuntu/) and [Debian](https://docs.docker.com/engine/install/debian/) guides cover package conflicts and supported versions.

## 3. Give the VPS read access to the private GitHub repo

The repository is currently **private**. If `git clone git@github.com:erron8/Vanta-watcher.git` already works from your VPS, use it and skip the deploy-key setup below. Otherwise, create a read-only deploy key:

```sh
mkdir -p "$HOME/.ssh"
chmod 700 "$HOME/.ssh"
ssh-keygen -t ed25519 -f "$HOME/.ssh/vanta_deploy" -N ''
cat "$HOME/.ssh/vanta_deploy.pub"
```

Copy the public key shown by `cat`. In GitHub, open **Vanta-watcher → Settings → Deploy keys → Add deploy key**, paste the public key, and leave **Allow write access** unchecked. Keep the private key on the VPS. GitHub's [deploy-key instructions](https://docs.github.com/en/authentication/connecting-to-github-with-ssh/managing-deploy-keys) explain this access method.

Create a dedicated SSH alias for this repository:

```sh
cat >> "$HOME/.ssh/config" <<'EOF_SSH'
Host github-vanta
  HostName github.com
  User git
  IdentityFile ~/.ssh/vanta_deploy
  IdentitiesOnly yes
EOF_SSH
chmod 600 "$HOME/.ssh/config"
```

Then clone the code:

```sh
git clone git@github-vanta:erron8/Vanta-watcher.git
cd Vanta-watcher
```

If your VPS already has normal GitHub SSH access, clone with `git@github.com:erron8/Vanta-watcher.git` instead.

## 4. Generate private credentials and set your domain

Run the account generator inside a temporary Node container; Node does not need to be installed on the VPS:

```sh
sudo docker run --rm --user "$(id -u):$(id -g)" -v "$PWD:/app" -w /app node:22-bookworm-slim node scripts/create-accounts.mjs
```

This creates `.env` and `.vanta-initial-credentials`, both ignored by Git. Edit only the `VANTA_DOMAIN` line in `.env`:

```sh
nano .env
```

Set it to your actual hostname, for example `VANTA_DOMAIN=vanta.yourdomain.com`, without `https://` or a trailing slash. Keep the generated database password, session secret, and password hashes unchanged. To read the new login passwords:

```sh
cat .vanta-initial-credentials
```

The initial usernames are `admin` and `guest`. Both can use the screener and bookmarks; only `admin` can manage additional users from the Admin tab. Store their passwords safely. The passwords previously generated on your Mac will **not** work on this fresh VPS unless you securely copy your Mac's matching `.env` to the server instead of running the generator.

## 5. Start Vanta

```sh
sudo docker compose config --quiet
sudo docker compose up -d --build
sudo docker compose ps
```

The first build can take several minutes. The stack starts PostgreSQL, applies the database schema, starts the Next.js app, and puts Caddy in front of it. Only Caddy exposes public ports; PostgreSQL remains inside the Compose network. Check the logs if startup does not finish:

```sh
sudo docker compose logs --tail=100 app caddy migrate
```

Open `https://vanta.yourdomain.com/`. The homepage should open without a password. Open `/screener` or `/bookmarks`; you should be sent to the sign-in page. If HTTPS is not ready, check that DNS points to this VPS, TCP 80/443 are reachable, and Caddy's logs show certificate activity.

**Existing data:** this VPS starts with an empty PostgreSQL database. Scans saved in the older hosted Site's Cloudflare D1 database do not move automatically. Bookmarks are now saved only in each browser's local storage and are not migrated from the older shared database. Keep the old Site until its data has been exported or you are happy to start fresh.

## Updates and backups

To deploy later GitHub changes:

```sh
cd Vanta-watcher
git pull --ff-only
sudo docker compose up -d --build
```

Before major updates, save a private PostgreSQL backup:

```sh
cd Vanta-watcher
umask 077
sudo docker compose exec -T db pg_dump -U vanta -d vanta > "vanta-$(date +%F).sql"
```

Store the SQL backup somewhere private and off the VPS as well. Do not commit it or either credential file to GitHub. To check service health later, run `sudo docker compose ps` and `sudo docker compose logs --tail=100 app caddy`.
