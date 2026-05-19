#!/bin/bash
set -e

DB_USER="parking_user"
DB_PASS="parking_secure_pass_2026"
DB_NAME="parking_crm"

echo "=== Установка PostgreSQL ==="
apt-get update -q
apt-get install -y postgresql postgresql-contrib

echo "=== Создание пользователя и базы данных ==="
sudo -u postgres psql << EOF
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = '$DB_USER') THEN
    CREATE USER $DB_USER WITH PASSWORD '$DB_PASS';
  END IF;
END
\$\$;

SELECT 'CREATE DATABASE $DB_NAME OWNER $DB_USER'
  WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '$DB_NAME') \gexec

GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;
EOF

echo "=== PostgreSQL настроен ==="
echo "  Пользователь : $DB_USER"
echo "  База данных  : $DB_NAME"
echo "  DATABASE_URL : postgresql+asyncpg://$DB_USER:$DB_PASS@localhost/$DB_NAME"
