"""
Сидирование базы данных реальными данными стоянок и тестовыми пользователями.
Запуск: python seed_data.py
Внимание: удаляет пользователей, стоянки и инциденты, НО сохраняет push_subscriptions.
"""
import asyncio
import os
import sys

import bcrypt

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy import delete
from database import AsyncSessionLocal, Base, engine
from models import (
    AuditLog, Incident, LotType, ParkingLot,
    ShiftNote, Software, User, UserRole,
)


PARKING_LOTS: list[dict] = [
    # ---- Городские ----
    dict(name="5-й Предпортовый",   lot_type=LotType.city,      software=Software.cursus),
    dict(name="Греческая (БКЗ)",     lot_type=LotType.city,      software=Software.cursus),
    dict(name="Конюшенная",          lot_type=LotType.city,      software=Software.ptp),
    dict(name="Казанская",           lot_type=LotType.city,      software=Software.cursus),
    dict(name="Кронштадт уч.69",     lot_type=LotType.city,      software=Software.cursus),
    dict(name="Кронштадт уч.72",     lot_type=LotType.city,      software=Software.cursus),
    dict(name="Кронштадт уч.72а",    lot_type=LotType.city,      software=Software.ptp),
    dict(name="Кронштадт уч.17-18",  lot_type=LotType.city,      software=Software.ptp),
    dict(name="Лиговский",           lot_type=LotType.city,      software=Software.cursus),
    dict(name="Петергоф уч.1",       lot_type=LotType.city,      software=Software.ptp),
    dict(name="Петергоф уч.6",       lot_type=LotType.city,      software=Software.ptp),
    dict(name="Петергоф уч.7",       lot_type=LotType.city,      software=Software.intervo),
    dict(name="Оптиков",             lot_type=LotType.city,      software=Software.cursus),
    # ---- Перехватывающие ----
    dict(name="Витебский 158",       lot_type=LotType.intercept, software=Software.cursus,
         has_entry_group=True, has_exit_group=True, cash_registers_count=2),
    dict(name="Витебский 193",       lot_type=LotType.intercept, software=Software.cursus,
         has_entry_group=True, has_exit_group=True, cash_registers_count=2),
    dict(name="Гражданский",         lot_type=LotType.intercept, software=Software.cursus,
         has_entry_group=True, has_exit_group=True, cash_registers_count=2),
    dict(name="Грибакиных",          lot_type=LotType.intercept, software=Software.cursus,
         has_entry_group=True, has_exit_group=True, cash_registers_count=2),
    dict(name="Дачный",              lot_type=LotType.intercept, software=Software.cursus,
         has_entry_group=True, has_exit_group=True, cash_registers_count=2),
    dict(name="Заневский",           lot_type=LotType.intercept, software=Software.cursus,
         has_entry_group=True, has_exit_group=True, cash_registers_count=2),
    dict(name="Народного Ополчения", lot_type=LotType.intercept, software=Software.cursus,
         has_entry_group=True, has_exit_group=True, cash_registers_count=2),
    dict(name="Политех",             lot_type=LotType.intercept, software=Software.cursus,
         has_entry_group=True, has_exit_group=True, cash_registers_count=2),
    dict(name="Просвещения",         lot_type=LotType.intercept, software=Software.intervo,
         has_entry_group=True, has_exit_group=True, cash_registers_count=2),
    dict(name="Пятилеток",           lot_type=LotType.intercept, software=Software.cursus,
         has_entry_group=True, has_exit_group=True, cash_registers_count=2),
    dict(name="Салова",              lot_type=LotType.intercept, software=Software.cursus,
         has_entry_group=True, has_exit_group=True, cash_registers_count=2),
    dict(name="Стачек",              lot_type=LotType.intercept, software=Software.cursus,
         has_entry_group=True, has_exit_group=True, cash_registers_count=2),
    dict(name="Тепловозная",         lot_type=LotType.intercept, software=Software.cursus,
         has_entry_group=True, has_exit_group=True, cash_registers_count=2),
    dict(name="Торфяная",            lot_type=LotType.intercept, software=Software.cursus,
         has_entry_group=True, has_exit_group=True, cash_registers_count=2),
    dict(name="Удаловская (Пушкин)", lot_type=LotType.intercept, software=Software.cursus,
         has_entry_group=True, has_exit_group=True, cash_registers_count=2),
    dict(name="Фарфоровская",        lot_type=LotType.intercept, software=Software.cursus,
         has_entry_group=True, has_exit_group=True, cash_registers_count=2),
    dict(name="Шушары (Автозаводская)", lot_type=LotType.intercept, software=Software.cursus,
         has_entry_group=True, has_exit_group=True, cash_registers_count=2),
]

USERS: list[dict] = [
    dict(name="Супер Админ", email="superadmin@parking.ru", password="Admin2025!", role=UserRole.admin),
    dict(name="Диспетчер",   email="disp@parking.ru",       password="disp123",   role=UserRole.dispatcher),
    dict(name="Техник 1",    email="tech1@parking.ru",      password="tech123",   role=UserRole.tech),
    dict(name="Техник 2",    email="tech2@parking.ru",      password="tech123",   role=UserRole.tech),
]


def _hash(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


async def seed() -> None:
    print("[1/3] Создаём таблицы (если не существуют)...")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with AsyncSessionLocal() as db:
        # Удаляем только данные, push_subscriptions не трогаем
        await db.execute(delete(AuditLog))
        await db.execute(delete(Incident))
        await db.execute(delete(ShiftNote))
        await db.execute(delete(User))
        await db.execute(delete(ParkingLot))
        await db.commit()
        print("    Старые данные очищены (подписки сохранены)")

    async with AsyncSessionLocal() as db:
        print("[2/3] Создаём пользователей...")
        users_created = []
        for u in USERS:
            user = User(
                name=u["name"],
                email=u["email"],
                password_hash=_hash(u["password"]),
                role=u["role"],
            )
            db.add(user)
            users_created.append(user)
        await db.commit()
        for u in users_created:
            await db.refresh(u)

        print("[3/3] Создаём стоянки...")
        lots_created = []
        for data in PARKING_LOTS:
            lot = ParkingLot(
                name=data["name"],
                lot_type=data["lot_type"],
                software=data["software"],
                has_controller=data.get("has_controller", False),
                cash_registers_count=data.get("cash_registers_count", 1),
                has_entry_group=data.get("has_entry_group", False),
                has_exit_group=data.get("has_exit_group", False),
            )
            db.add(lot)
            lots_created.append(lot)
        await db.commit()
        for lot in lots_created:
            await db.refresh(lot)

    print()
    print("OK! Создано:")
    print(f"  Пользователей : {len(USERS)}")
    print(f"  Стоянок       : {len(PARKING_LOTS)}")
    print()
    print("Тестовые учётные записи:")
    role_labels = {UserRole.admin: "Админ", UserRole.dispatcher: "Диспетчер", UserRole.tech: "Техник"}
    for u in USERS:
        print(f"  {u['email']:35s} / {u['password']:<12s} [{role_labels[u['role']]}]")


if __name__ == "__main__":
    asyncio.run(seed())
