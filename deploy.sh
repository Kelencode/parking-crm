#!/bin/bash
set -e

echo "=== Установка системных зависимостей ==="
apt-get update -q
apt-get install -y python3 python3-pip python3-venv nodejs npm git nginx certbot python3-certbot-nginx

echo "=== Установка и настройка PostgreSQL ==="
bash /opt/parking-crm/setup_postgres.sh

echo "=== Клонирование репозитория ==="
cd /opt
git clone https://github.com/Kelencode/parking-crm.git
cd parking-crm

echo "=== Настройка бэкенда ==="
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env

echo "=== Генерация SECRET_KEY ==="
SECRET_KEY=$(python3 -c "import secrets; print(secrets.token_hex(32))")
sed -i "s/your-secret-key-here-min-32-chars/$SECRET_KEY/" .env

echo "=== Заполнение БД ==="
python3 seed_data.py

echo "=== Настройка фронтенда ==="
cd /opt/parking-crm/frontend
npm install
VITE_API_URL=https://mr.kirill.zhukov.fvds.ru/api npm run build

echo "=== Настройка systemd для бэкенда ==="
cat > /etc/systemd/system/parking-crm.service << EOF
[Unit]
Description=Parking CRM Backend
After=network.target postgresql.service

[Service]
Type=simple
User=root
WorkingDirectory=/opt/parking-crm/backend
Environment=PATH=/opt/parking-crm/backend/venv/bin
ExecStart=/opt/parking-crm/backend/venv/bin/uvicorn main:app --host 127.0.0.1 --port 8000
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable parking-crm
systemctl start parking-crm

echo "=== Настройка Nginx ==="
cat > /etc/nginx/sites-available/parking-crm << EOF
server {
    listen 80;
    server_name mr.kirill.zhukov.fvds.ru;

    location /api/ {
        proxy_pass http://127.0.0.1:8000/;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 3600;
    }

    location / {
        root /opt/parking-crm/frontend/dist;
        try_files \$uri \$uri/ /index.html;
    }
}
EOF

ln -sf /etc/nginx/sites-available/parking-crm /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl restart nginx

echo "=== Готово! ==="
echo "Сайт доступен на http://mr.kirill.zhukov.fvds.ru"
echo "Следующий шаг: certbot --nginx -d mr.kirill.zhukov.fvds.ru"
