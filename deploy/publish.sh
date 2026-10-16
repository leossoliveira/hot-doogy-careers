#!/usr/bin/env bash
# Builds the site and publishes dist/ to the VPS behind careers.hotdoogy.com.
# Run from the repository root on the Mac: bash deploy/publish.sh
# Requires SSH key access to the VPS (same key as ssh-access/vps.command).
set -euo pipefail
HOST="${CAREERS_VPS:-root@2.24.118.177}"
TARGET=/var/www/hot-doogy-careers
cd "$(dirname "$0")/.."
npm run build --silent
# Upload to a staging folder, then swap so visitors never see a half-copied site.
rsync -az --delete --chmod=Du=rwx,Dgo=rx,Fu=rw,Fgo=r dist/ "$HOST:$TARGET.next/"
ssh "$HOST" "set -e; rm -rf $TARGET.old; [ -d $TARGET ] && mv $TARGET $TARGET.old || true; mv $TARGET.next $TARGET; chown -R root:www-data $TARGET; rm -rf $TARGET.old; nginx -t -q && systemctl reload nginx"
echo "Published $(git rev-parse --short HEAD) to https://careers.hotdoogy.com"
