import json

from sqlalchemy.ext.asyncio import AsyncSession

from models import AuditAction, AuditLog, IncidentPriority, IncidentType, ParkingLot, User


def calculate_priority(incident_type: str, lot: ParkingLot) -> IncidentPriority:
    t = incident_type

    if t in (IncidentType.entry_group, IncidentType.exit_group):
        return IncidentPriority.critical

    if t == IncidentType.cash_register:
        if lot.cash_registers_count == 1 and not lot.has_controller:
            return IncidentPriority.critical
        return IncidentPriority.high

    if t in (IncidentType.cashless, IncidentType.cash_payment):
        return IncidentPriority.high

    if t in (IncidentType.cctv, IncidentType.operator, IncidentType.display, IncidentType.info_board):
        return IncidentPriority.medium

    return IncidentPriority.low


async def log_action(
    db: AsyncSession,
    user: User,
    action: AuditAction,
    entity: str | None = None,
    entity_id: int | None = None,
    details: dict | None = None,
) -> None:
    entry = AuditLog(
        user_id=user.id,
        user_name=user.name,
        action=action,
        entity=entity,
        entity_id=entity_id,
        details=json.dumps(details, ensure_ascii=False) if details else None,
    )
    db.add(entry)
    # commit is handled by the caller after the main operation
