#!/usr/bin/env bash
# Build → serverga yuklash → symlink almashtirish → restart → health-check (xato bo'lsa avvalgi relizga qaytadi).
#   deploy/deploy.sh             yangi reliz
#   deploy/deploy.sh --rollback  avvalgi relizga qaytish
set -euo pipefail
cd "$(dirname "$0")/.."

HOST=${DEPLOY_HOST:-root@169.58.4.28}
KEY=${DEPLOY_KEY:-$HOME/.ssh/fibotai_contabo}
APP_DIR=/opt/zakovat
SSH=(ssh -i "$KEY" -o BatchMode=yes "$HOST")

remote_switch='
set -euo pipefail
cd '"$APP_DIR"'
health() { for i in $(seq 1 30); do curl -fsS -o /dev/null http://127.0.0.1:3100/ && return 0; sleep 1; done; return 1; }
switch() { ln -sfn "releases/$1" current.tmp && mv -T current.tmp current && systemctl restart zakovat; }
'

if [[ "${1:-}" == "--rollback" ]]; then
  "${SSH[@]}" "$remote_switch"'
    cur=$(basename "$(readlink current)")
    prev=$(ls -1 releases | sort | grep -B1 -x "$cur" | head -1)
    [[ -n "$prev" && "$prev" != "$cur" ]] || { echo "Avvalgi reliz yo‘q"; exit 1; }
    switch "$prev" && health && echo "Qaytarildi: $prev"'
  exit 0
fi

REL=$(date +%Y%m%d%H%M%S)
npm run validate
npm test
npm run build

STAGE=.deploy/$REL
rm -rf .deploy && mkdir -p "$STAGE"
cp -R .next/standalone/. "$STAGE/"
mkdir -p "$STAGE/.next" && cp -R .next/static "$STAGE/.next/static"
[[ -d public ]] && cp -R public "$STAGE/public"
find "$STAGE" -maxdepth 1 -name ".env*" -delete   # sirlar faqat /etc/zakovat/zakovat.env da

rsync -az --delete -e "ssh -i $KEY -o BatchMode=yes" "$STAGE/" "$HOST:$APP_DIR/releases/$REL/"

"${SSH[@]}" "$remote_switch"'
  chown -R zakovat:zakovat releases/'"$REL"'
  prev=$(readlink current 2>/dev/null | xargs -r basename || true)
  switch '"$REL"'
  if health; then
    echo "Ishga tushdi: '"$REL"'"
    ls -1 releases | sort | head -n -3 | xargs -r -I{} rm -rf "releases/{}"
  else
    echo "Health-check xato — avvalgi relizga qaytilmoqda" >&2
    journalctl -u zakovat -n 30 --no-pager >&2 || true
    [[ -n "$prev" ]] && switch "$prev"
    exit 1
  fi'
rm -rf .deploy
