import { useEffect, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { connect as wsConnect, disconnect as wsDisconnect, subscribe as wsSubscribe } from '../api/websocket';

const ADMIN_LINKS = [
  { to: '/dashboard',    label: 'Дашборд'        },
  { to: '/incidents',    label: 'Заявки'          },
  { to: '/history',      label: 'История'         },
  { to: '/parking-lots', label: 'Стоянки'         },
  { to: '/reports',      label: 'Отчёты'          },
  { to: '/users',        label: 'Сотрудники'      },
  { to: '/audit-log',    label: 'Журнал действий' },
];

const DISPATCHER_LINKS = [
  { to: '/dashboard',    label: 'Дашборд'  },
  { to: '/incidents',    label: 'Заявки'   },
  { to: '/history',      label: 'История'  },
  { to: '/parking-lots', label: 'Стоянки'  },
  { to: '/reports',      label: 'Отчёты'   },
];

const TECH_LINKS = [
  { to: '/dashboard',    label: 'Дашборд'  },
  { to: '/incidents',    label: 'Заявки'   },
  { to: '/history',      label: 'История'  },
  { to: '/parking-lots', label: 'Стоянки'  },
];

const ROLE_LABELS = { admin: 'Администратор', dispatcher: 'Диспетчер', tech: 'Техник' };

const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

export default function Layout() {
  const { user, setUser } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  // WebSocket + desktop notifications
  useEffect(() => {
    if (!user) return;

    wsConnect();

    // Request notification permission silently for tech/admin on desktop
    if (!isMobile && user.role !== 'dispatcher' && 'Notification' in window) {
      if (Notification.permission === 'default') {
        Notification.requestPermission().catch(() => {});
      }
    }

    const unsub = wsSubscribe((msg) => {
      if (msg.type === 'new_incident' && !isMobile && Notification.permission === 'granted') {
        const { lot_name, description } = msg.data;
        new Notification(`🔴 Новый сбой — ${lot_name}`, {
          body: description,
          icon: '/icon-192.png',
        });
      }
    });

    return () => {
      unsub();
      wsDisconnect();
    };
  }, [user?.id]);

  // Закрывать drawer при нажатии Escape
  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') setMenuOpen(false); }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  // Блокировать прокрутку body когда drawer открыт
  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [menuOpen]);

  const links =
    user?.role === 'admin'      ? ADMIN_LINKS :
    user?.role === 'dispatcher' ? DISPATCHER_LINKS :
    TECH_LINKS;

  function handleLogout() {
    localStorage.removeItem('token');
    setUser(null);
    navigate('/login', { replace: true });
  }

  function closeMenu() { setMenuOpen(false); }

  return (
    <>
      {/* ── Мобильная шапка ── */}
      <header className="mobile-header">
        <button className="hamburger" onClick={() => setMenuOpen(true)} aria-label="Открыть меню">
          ☰
        </button>
        <span className="mobile-title">Parking CRM</span>
      </header>

      {/* ── Затемнение за drawer ── */}
      {menuOpen && (
        <div className="sidebar-backdrop" onClick={closeMenu} />
      )}

      {/* ── Боковое меню ── */}
      <div className={`sidebar${menuOpen ? ' sidebar-open' : ''}`}>
        <NavLink to="/dashboard" className="sidebar-brand" onClick={closeMenu}>
          <svg width="22" height="22" viewBox="0 0 100 100" fill="none">
            <rect width="100" height="100" rx="18" fill="#2563eb"/>
            <text x="50" y="72" textAnchor="middle" fontFamily="Arial" fontSize="62" fontWeight="bold" fill="white">P</text>
          </svg>
          Parking CRM
        </NavLink>

        <ul className="sidebar-nav">
          {links.map(({ to, label }) => (
            <li key={to}>
              <NavLink to={to} className={({ isActive }) => isActive ? 'active' : ''} onClick={closeMenu}>
                {label}
              </NavLink>
            </li>
          ))}
        </ul>

        <div className="sidebar-footer">
          <div className="sidebar-user">
            {user?.name || user?.email}<br/>
            <span className="text-sm">{ROLE_LABELS[user?.role] ?? user?.role}</span>
          </div>

          <button className="btn btn-secondary" style={{ width: '100%' }} onClick={handleLogout}>
            Выйти
          </button>
        </div>
      </div>
    </>
  );
}
