# Инструкция по развёртыванию CRM автостоянок

## Требования

- Docker Engine 24+
- Docker Compose v2+
- Linux сервер (любой дистрибутив)
- 2 CPU / 2 GB RAM / 20 GB диск

## Установка Docker (если не установлен)

```bash
curl -fsSL https://get.docker.com | sh
```

## Структура папки

```
parking-crm/
├── backend/          — FastAPI приложение
├── frontend/         — React приложение
└── docker/           — файлы развёртывания (вы здесь)
    ├── docker-compose.yml
    ├── Dockerfile.backend
    ├── Dockerfile.frontend
    ├── nginx.conf
    ├── .env.example  — шаблон переменных
    └── .env          — ваши пароли (создать вручную)
```

## Развёртывание

**1. Скопировать папку `parking-crm` на сервер**

```bash
scp -r parking-crm/ user@server:/opt/
```

**2. Перейти в папку docker/**

```bash
cd /opt/parking-crm/docker
```

**3. Создать файл `.env` и задать пароли**

```bash
cp .env.example .env
nano .env
```

Заполнить:
```
DB_PASSWORD=придумайте_надёжный_пароль
SECRET_KEY=случайная_строка_минимум_32_символа
```

Сгенерировать SECRET_KEY можно командой:
```bash
python3 -c "import secrets; print(secrets.token_hex(32))"
```

**4. Запустить систему**

```bash
docker compose up -d
```

Первый запуск скачает образы и соберёт контейнеры — займёт 2–5 минут.

**5. Заполнить базу данных начальными данными**

```bash
docker compose exec backend python seed_data.py
```

**6. Система доступна на `http://адрес_сервера`**

Тестовые учётные записи после seed_data.py:

| Email | Пароль | Роль |
|---|---|---|
| superadmin@parking.ru | Admin2025! | Администратор |
| disp@parking.ru | disp123 | Диспетчер |
| tech1@parking.ru | tech123 | Техник |

> Смените пароли сразу после первого входа.

## Проверка работоспособности

```bash
# Статус контейнеров
docker compose ps

# Логи бэкенда
docker compose logs backend

# Логи базы данных
docker compose logs db
```

## Обновление системы

```bash
cd /opt/parking-crm/docker
docker compose down
# Скопировать новую версию папки на сервер, затем:
docker compose up -d --build
```

## Резервное копирование БД

```bash
# Создать дамп
docker compose exec db pg_dump -U parking_user parking_crm > backup_$(date +%Y%m%d).sql

# Автоматическое резервное копирование (добавить в cron):
# 0 3 * * * cd /opt/parking-crm/docker && docker compose exec -T db pg_dump -U parking_user parking_crm > /backup/parking_$(date +\%Y\%m\%d).sql
```

## Восстановление БД из резервной копии

```bash
docker compose exec -T db psql -U parking_user parking_crm < backup.sql
```

## Настройка HTTPS (опционально)

Для включения SSL установите certbot и получите сертификат:

```bash
apt-get install -y certbot
certbot certonly --standalone -d ваш_домен.ru

# Добавить в nginx.conf блок для 443 и смонтировать сертификаты:
# volumes:
#   - /etc/letsencrypt:/etc/letsencrypt:ro
```

## Решение проблем

| Проблема | Решение |
|---|---|
| Контейнер `backend` падает сразу | Проверьте `.env` — возможно не задан DB_PASSWORD или SECRET_KEY |
| Ошибка подключения к БД | Подождите 30 сек после `docker compose up` — PostgreSQL стартует дольше |
| Порт 80 занят | Остановите nginx на сервере: `systemctl stop nginx` |
| Нет доступа к сайту | Проверьте firewall: `ufw allow 80` |
