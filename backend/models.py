from datetime import datetime
from enum import Enum as PyEnum
from typing import Optional

from sqlalchemy import (
    Boolean, DateTime, ForeignKey, Integer, String, Text,
    Enum, func
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database import Base


class UserRole(str, PyEnum):
    admin      = "admin"
    dispatcher = "dispatcher"
    tech       = "tech"


class IncidentPriority(str, PyEnum):
    critical = "critical"
    high     = "high"
    medium   = "medium"
    low      = "low"


class IncidentStatus(str, PyEnum):
    new         = "new"
    assigned    = "assigned"
    in_progress = "in_progress"
    closed      = "closed"


class LotType(str, PyEnum):
    city      = "город"
    intercept = "перехват"


class Software(str, PyEnum):
    cursus = "курсус"
    ptp    = "птп"
    intervo = "интерво"


class IncidentType(str, PyEnum):
    entry_group   = "Въездная группа (шлагбаум/стойка)"
    exit_group    = "Выездная группа (шлагбаум/стойка)"
    cash_register = "Касса оплаты"
    cashless      = "Безналичная оплата"
    cash_payment  = "Оплата наличными"
    cctv          = "Камера видеонаблюдения"
    operator      = "Связь с оператором"
    display       = "Дисплей/экран"
    info_board    = "Информационное табло"
    lighting      = "Освещение"
    software      = "Программное обеспечение"
    other         = "Другое"



class AuditAction(str, PyEnum):
    login              = "login"
    incident_created   = "incident_created"
    incident_accepted  = "incident_accepted"
    incident_closed    = "incident_closed"
    incident_reopened  = "incident_reopened"
    incident_updated   = "incident_updated"
    user_created       = "user_created"
    user_updated       = "user_updated"
    shift_note_created = "shift_note_created"
    shift_note_deleted = "shift_note_deleted"


class User(Base):
    __tablename__ = "users"

    id:                   Mapped[int]      = mapped_column(Integer, primary_key=True, index=True)
    name:                 Mapped[str]      = mapped_column(String(128), nullable=False)
    email:                Mapped[str]      = mapped_column(String(256), unique=True, index=True, nullable=False)
    password_hash:        Mapped[str]      = mapped_column(String(256), nullable=False)
    role:                 Mapped[UserRole] = mapped_column(Enum(UserRole), nullable=False, default=UserRole.tech)
    is_active:            Mapped[bool]     = mapped_column(Boolean, nullable=False, default=True, server_default="true")
    must_change_password: Mapped[bool]     = mapped_column(Boolean, nullable=False, default=False, server_default="false")
    created_at:           Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, server_default=func.now())

    incidents_created:  Mapped[list["Incident"]] = relationship("Incident", foreign_keys="Incident.created_by", back_populates="creator")
    incidents_assigned: Mapped[list["Incident"]] = relationship("Incident", foreign_keys="Incident.assigned_to", back_populates="assignee")
    shift_notes:        Mapped[list["ShiftNote"]] = relationship("ShiftNote", back_populates="creator")


class ParkingLot(Base):
    __tablename__ = "parking_lots"

    id:                  Mapped[int]             = mapped_column(Integer, primary_key=True, index=True)
    name:                Mapped[str]             = mapped_column(String(256), nullable=False)
    address:             Mapped[Optional[str]]   = mapped_column(String(512), nullable=True)
    lot_type:            Mapped[Optional[LotType]]  = mapped_column(Enum(LotType), nullable=True)
    software:            Mapped[Optional[Software]] = mapped_column(Enum(Software), nullable=True)
    has_controller:      Mapped[bool]            = mapped_column(Boolean, default=False)
    cash_registers_count: Mapped[int]            = mapped_column(Integer, default=1)
    has_entry_group:     Mapped[bool]            = mapped_column(Boolean, default=False)
    has_exit_group:      Mapped[bool]            = mapped_column(Boolean, default=False)
    is_active:           Mapped[bool]            = mapped_column(Boolean, default=True, server_default="true")
    notes:               Mapped[Optional[str]]   = mapped_column(Text, nullable=True)

    incidents: Mapped[list["Incident"]] = relationship("Incident", back_populates="parking_lot")


class Incident(Base):
    __tablename__ = "incidents"

    id:              Mapped[int]             = mapped_column(Integer, primary_key=True, index=True)
    parking_lot_id:  Mapped[int]             = mapped_column(ForeignKey("parking_lots.id"), nullable=False)
    type:            Mapped[str]             = mapped_column(String(256), nullable=False)
    description:     Mapped[str]             = mapped_column(Text, nullable=False)
    priority:        Mapped[IncidentPriority] = mapped_column(Enum(IncidentPriority), nullable=False, default=IncidentPriority.medium)
    status:          Mapped[IncidentStatus]  = mapped_column(Enum(IncidentStatus), nullable=False, default=IncidentStatus.new)
    resolution:      Mapped[Optional[str]]   = mapped_column(Text, nullable=True)
    is_repeat:       Mapped[bool]            = mapped_column(Boolean, default=False)
    created_by:      Mapped[int]             = mapped_column(ForeignKey("users.id"), nullable=False)
    assigned_to:     Mapped[Optional[int]]   = mapped_column(ForeignKey("users.id"), nullable=True)
    created_at:      Mapped[datetime]        = mapped_column(DateTime, server_default=func.now())
    closed_at:       Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    parking_lot: Mapped["ParkingLot"]       = relationship("ParkingLot", back_populates="incidents")
    creator:     Mapped["User"]             = relationship("User", foreign_keys=[created_by], back_populates="incidents_created")
    assignee:    Mapped[Optional["User"]]   = relationship("User", foreign_keys=[assigned_to], back_populates="incidents_assigned")


class ShiftNote(Base):
    __tablename__ = "shift_notes"

    id:         Mapped[int]             = mapped_column(Integer, primary_key=True, index=True)
    text:       Mapped[str]             = mapped_column(Text, nullable=False)
    expires_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    created_by: Mapped[int]             = mapped_column(ForeignKey("users.id"), nullable=False)
    created_at: Mapped[datetime]        = mapped_column(DateTime, server_default=func.now())
    is_active:  Mapped[bool]            = mapped_column(Boolean, default=True)

    creator: Mapped["User"] = relationship("User", back_populates="shift_notes")


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id:        Mapped[int]           = mapped_column(Integer, primary_key=True, index=True)
    user_id:   Mapped[int]           = mapped_column(ForeignKey("users.id"), nullable=False)
    user_name: Mapped[str]           = mapped_column(String(256), nullable=False)
    action:    Mapped[AuditAction]   = mapped_column(Enum(AuditAction), nullable=False)
    entity:    Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    entity_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    details:   Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # JSON string
    created_at: Mapped[datetime]     = mapped_column(DateTime, server_default=func.now())


class ShiftSnapshot(Base):
    __tablename__ = "shift_snapshots"

    id:             Mapped[int]           = mapped_column(Integer, primary_key=True, index=True)
    snapshot_time:  Mapped[datetime]      = mapped_column(DateTime, nullable=False)
    shift_type:     Mapped[str]           = mapped_column(String(16), nullable=False)
    date:           Mapped[str]           = mapped_column(String(10), nullable=False)
    incidents_json: Mapped[str]           = mapped_column(Text, nullable=False, default="[]")
    notes_json:     Mapped[str]           = mapped_column(Text, nullable=False, default="[]")
    created_by:     Mapped[Optional[int]] = mapped_column(ForeignKey("users.id"), nullable=True)
    created_at:     Mapped[datetime]      = mapped_column(DateTime, default=datetime.utcnow, server_default=func.now())
    is_auto:        Mapped[bool]          = mapped_column(Boolean, default=False)

    creator: Mapped[Optional["User"]] = relationship("User", foreign_keys=[created_by])


class JournalEntry(Base):
    __tablename__ = "journal_entries"

    id:             Mapped[int]              = mapped_column(Integer, primary_key=True, index=True)
    created_at:     Mapped[datetime]         = mapped_column(DateTime, server_default=func.now())
    parking_lot_id: Mapped[int]              = mapped_column(ForeignKey("parking_lots.id"), nullable=False)
    operation:      Mapped[str]              = mapped_column(String(20), nullable=False)
    grz:            Mapped[str]              = mapped_column(String(20), nullable=False)
    reason:         Mapped[str]              = mapped_column(String(100), nullable=False)
    note:           Mapped[Optional[str]]    = mapped_column(String(300), nullable=True)
    ticket_number:  Mapped[Optional[str]]    = mapped_column(String(20), nullable=True)
    created_by:     Mapped[int]              = mapped_column(ForeignKey("users.id"), nullable=False)

    parking_lot: Mapped["ParkingLot"] = relationship("ParkingLot")
    creator:     Mapped["User"]       = relationship("User", foreign_keys=[created_by])
