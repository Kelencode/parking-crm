# Parking CRM — система техподдержки автостоянок

## Стек

- **Backend**: Python FastAPI + SQLite
- **Frontend**: React PWA (Vite)
- **Уведомления**: Web Push (VAPID)

## Быстрый старт

### Бэкенд

```bash
cd backend
pip install -r requirements.txt
copy .env.example .env
# Заполни .env своими значениями
python seed_data.py
uvicorn main:app --reload
```

### Фронтенд

```bash
cd frontend
npm install
npm run dev
```

### Или запусти всё сразу

Двойной клик на `start-all.bat`

## Доступ

http://localhost:5173

## Тестовые пользователи

| Email | Пароль | Роль |
|---|---|---|
| `superadmin@parking.ru` | `Admin2025!` | Администратор |
| `disp@parking.ru` | `disp123` | Диспетчер |
| `tech1@parking.ru` | `tech123` | Техник |
| `tech2@parking.ru` | `tech123` | Техник |

## Роли

- **admin** — полный доступ, управление пользователями
- **dispatcher** — создаёт заявки, управляет стоянками, скачивает отчёты
- **tech** — принимает и закрывает заявки

## Структура проекта

```
parking-crm/
  backend/
    main.py           # FastAPI — все маршруты
    models.py         # Модели SQLAlchemy
    database.py       # Подключение к БД
    utils.py          # Вспомогательные функции
    seed_data.py      # Начальные данные (стоянки + пользователи)
    requirements.txt
    .env.example
  frontend/
    src/
      api/            # Axios-клиенты для каждого ресурса
      components/     # Layout, StatusBadge, PriorityBadge и др.
      context/        # AuthContext
      pages/          # Dashboard, Incidents, History, Reports и др.
    public/           # PWA-иконки, manifest, service worker
    vite.config.js
  start-all.bat       # Запуск бэкенда и фронтенда одной командой
  CLAUDE.md           # Инструкции для Claude Code
```
