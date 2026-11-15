#!/usr/bin/env bash
# One-time host setup on the VPS (needs sudo): nginx vhosts + Let's Encrypt certificate
# for quizlive.cloudyyy.tech and the uptime / errors / logs subdomains.
# Usage (from the repository checkout on the VPS):  sudo bash deploy/setup-host.sh
set -euo pipefail
cd "$(dirname "$0")"

DOMAINS=(quizlive.cloudyyy.tech uptime.quizlive.cloudyyy.tech errors.quizlive.cloudyyy.tech logs.quizlive.cloudyyy.tech)
SITE=/etc/nginx/sites-available/quizlive.cloudyyy.tech

# 1. HTTP-only vhost so certbot can answer the ACME challenge from /var/www/html
mkdir -p /var/www/html
sed -n '1,/^}/p' nginx/quizlive.conf > "$SITE"
ln -sf "$SITE" /etc/nginx/sites-enabled/quizlive.cloudyyy.tech
nginx -t && systemctl reload nginx

# 2. One certificate for all four names (renewed by the certbot timer, nginx reloaded after renewal)
args=(); for d in "${DOMAINS[@]}"; do args+=(-d "$d"); done
certbot certonly --webroot -w /var/www/html --cert-name quizlive.cloudyyy.tech "${args[@]}" \
  --non-interactive --agree-tos --register-unsafely-without-email --keep-until-expiring \
  --deploy-hook "systemctl reload nginx"

# 3. Full config with HTTPS
install -m 644 nginx/quizlive-tls.conf /etc/nginx/snippets/quizlive-tls.conf
install -m 644 nginx/quizlive-proxy.conf /etc/nginx/snippets/quizlive-proxy.conf
install -m 644 nginx/quizlive.conf "$SITE"
nginx -t && systemctl reload nginx
echo "Done: https://${DOMAINS[0]}"
