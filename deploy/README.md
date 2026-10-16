# Hosting careers.hotdoogy.com

The site is static: `npm run build` output served by Nginx on the same VPS as
Operations (`2.24.118.177`, Hostinger). Nothing runs server-side; the form posts
straight to the Supabase Edge Function.

- Files: `/var/www/hot-doogy-careers` (owner root, group www-data).
- Nginx: `/etc/nginx/sites-available/hot-doogy-careers`, linked from `sites-enabled`.
  `nginx-careers-bootstrap.conf` is the port-80 stage used before the certificate;
  `nginx-careers.conf` is the final HTTPS configuration.
- Certificate: `/etc/letsencrypt/live/careers.hotdoogy.com/`, renewed by `certbot.timer`
  (the existing renewal hook reloads Nginx).
- DNS: `A careers` → `2.24.118.177` in the hotdoogy.com zone at Hostinger (TTL 300).

## Publish a new version

```bash
bash deploy/publish.sh
```

Builds locally, uploads `dist/` to a staging folder on the VPS, swaps it into place
and reloads Nginx. Requires the VPS SSH key.

## First-time HTTPS

1. Create the DNS record and wait until `dig +short careers.hotdoogy.com` returns the VPS.
2. With the bootstrap config active: `certbot certonly --webroot -w /var/www/hot-doogy-acme -d careers.hotdoogy.com`.
3. Install `nginx-careers.conf` as the site file, `nginx -t`, `systemctl reload nginx`.
4. `certbot renew --cert-name careers.hotdoogy.com --dry-run`.
5. Lock the Edge Function to the origin:
   `supabase secrets set CAREERS_ALLOWED_ORIGINS=https://careers.hotdoogy.com --project-ref kfnsfnytnnpwptklmbip`.
