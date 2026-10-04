#!/usr/bin/env bash
# Bir martalik server sozlamasi (idempotent). Ishlatish:
#   ssh -i ~/.ssh/fibotai_contabo root@169.58.4.28 'bash -s' < deploy/server-setup.sh
# fibotai servislari va fayllariga tegmaydi.
set -euo pipefail

NODE_MAJOR=24
APP_DIR=/opt/zakovat

export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq redis-server curl ca-certificates xz-utils rsync >/dev/null

# Redis: faqat lokal, cheklangan xotira, AOF bilan saqlanadi.
REDIS_CONF=/etc/redis/redis.conf
set_redis() { grep -qE "^$1 " "$REDIS_CONF" && sed -i "s|^$1 .*|$1 $2|" "$REDIS_CONF" || echo "$1 $2" >> "$REDIS_CONF"; }
set_redis bind "127.0.0.1 -::1"
set_redis protected-mode yes
set_redis maxmemory 128mb
set_redis maxmemory-policy noeviction
set_redis appendonly yes
systemctl enable --now redis-server >/dev/null
systemctl restart redis-server

# Node.js LTS — /opt/node ga (tizim paketlariga tegmaydi), SHA256 tekshiriladi.
if ! /opt/node/bin/node -v 2>/dev/null | grep -q "^v${NODE_MAJOR}\."; then
  base="https://nodejs.org/dist/latest-v${NODE_MAJOR}.x"
  file=$(curl -fsSL "$base/SHASUMS256.txt" | awk '/linux-x64.tar.xz$/{print $2}')
  sum=$(curl -fsSL "$base/SHASUMS256.txt" | awk '/linux-x64.tar.xz$/{print $1}')
  tmp=$(mktemp -d)
  curl -fsSL "$base/$file" -o "$tmp/$file"
  echo "$sum  $tmp/$file" | sha256sum -c - >/dev/null
  tar -xJf "$tmp/$file" -C /opt
  ln -sfn "/opt/${file%.tar.xz}" /opt/node
  rm -rf "$tmp"
fi

# Ilova foydalanuvchisi va papkalar.
id zakovat >/dev/null 2>&1 || useradd --system --home "$APP_DIR" --shell /usr/sbin/nologin zakovat
install -d -o zakovat -g zakovat -m 755 "$APP_DIR" "$APP_DIR/releases"
install -d -o root -g zakovat -m 750 /etc/zakovat

echo "node: $(/opt/node/bin/node -v) · redis: $(redis-cli ping)"
