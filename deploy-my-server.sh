#!/usr/bin/env bash
set -e

cd /opt/trms-remake
git fetch origin
git reset --hard origin/main

cat > /opt/trms-remake/.env << 'EOF'
DATABASE_URL="postgresql://trms:trms_password@127.0.0.1:5433/trms_remake?schema=public"
PORT=4010
EOF
cp /opt/trms-remake/.env /opt/trms-remake/apps/api/.env

export COREPACK_ENABLE_DOWNLOAD_PROMPT=0
pnpm install --no-frozen-lockfile
pnpm --filter @trms/api db:generate
pnpm --filter @trms/web build

# Create systemd service for @trms/api on port 4010
cat > /etc/systemd/system/trms-api.service << 'EOF'
[Unit]
Description=TRMS Remake GraphQL API Server
After=network.target docker.service

[Service]
Type=simple
WorkingDirectory=/opt/trms-remake/apps/api
Environment=NODE_ENV=production
Environment=PORT=4010
Environment=DATABASE_URL=postgresql://trms:trms_password@127.0.0.1:5433/trms_remake?schema=public
ExecStart=/usr/bin/env npx tsx src/server.ts
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable trms-api
systemctl restart trms-api

# Configure Nginx for trms.minduclab.duckdns.org
cat > /etc/nginx/sites-available/trms.minduclab.duckdns.org << 'EOF'
server {
    listen 80;
    server_name trms.minduclab.duckdns.org;

    client_max_body_size 50M;

    root /opt/trms-remake/apps/web/dist;
    index index.html;

    location /graphql {
        proxy_pass http://127.0.0.1:4010/graphql;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_http_version 1.1;
        proxy_read_timeout 300s;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:4010/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /trms/ {
        proxy_pass http://127.0.0.1:4010/trms/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /health {
        proxy_pass http://127.0.0.1:4010/health;
    }

    location / {
        try_files $uri $uri/ /index.html;
    }
}
EOF

ln -sf /etc/nginx/sites-available/trms.minduclab.duckdns.org /etc/nginx/sites-enabled/trms.minduclab.duckdns.org
nginx -t && systemctl reload nginx
certbot --nginx -d trms.minduclab.duckdns.org --non-interactive --agree-tos --redirect --register-unsafely-without-email || true

sleep 3
curl -s http://127.0.0.1:4010/api/health
echo ""
echo "DEPLOY_COMPLETE_OK"
