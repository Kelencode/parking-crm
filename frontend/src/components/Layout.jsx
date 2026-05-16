import { useEffect, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getPushServerStatus, subscribeToPush, sendTestPush } from '../api/push';

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

export default function Layout() {
  const { user, setUser } = useAuth();
  const navigate = useNavigate();
  const [pushStatus, setPushStatus] = useState('checking');
  const [pushError, setPushError]   = useState('');
  const [testBusy, setTestBusy]     = useState(false);
  const [menuOpen, setMenuOpen]     = useState(false);

  const isSafariOnly = /Safari/.test(navigator.userAgent) && !/Chrome|CriOS|YaBrowser/.test(navigator.userAgent);

  useEffect(() => {
    async function checkPushStatus() {
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        setPushStatus('unsupported');
        return;
      }
      try {
        const reg = await navigator.serviceWorker.ready;
        const browserSub = await reg.pushManager.getSubscription();

        if (!browserSub) {
          localStorage.removeItem('push_confirmed_v2');
          setPushStatus('unsubscribed');
          return;
        }

        const serverHasSub = await getPushServerStatus();
        if (serverHasSub === false) {
          localStorage.removeItem('push_confirmed_v2');
          setPushStatus('unsubscribed');
        } else {
          setPushStatus('subscribed');
        }
      } catch {
        setPushStatus('unsupported');
      }
    }
    checkPushStatus();
  }, []);

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
    localStorage.removeItem('push_subscribed');
    localStorage.removeItem('push_confirmed_v2');
    setUser(null);
    navigate('/login', { replace: true });
  }

  async function handleEnablePush() {
    setPushError('');
    const result = await subscribeToPush();
    if (result?.error) {
      setPushError(result.error);
    } else if (result?.success) {
      setPushStatus('subscribed');
    }
  }

  async function handleTestPush() {
    setTestBusy(true);
    try {
      await sendTestPush();
      alert('Тестовый push отправлен — проверьте уведомления');
    } catch (e) {
      alert(e.response?.data?.detail ?? 'Ошибка');
    } finally {
      setTestBusy(false);
    }
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

          {pushStatus === 'subscribed' && (
            <div style={{ fontSize: 11, color: '#22c55e', padding: '4px 0 6px', textAlign: 'center' }}>
              Уведомления включены ✓
            </div>
          )}
          {pushStatus === 'unsupported' && (
            <div style={{ fontSize: 11, color: 'var(--c-muted)', padding: '4px 0 6px', textAlign: 'center' }}>
              Уведомления не поддерживаются в вашем браузере
            </div>
          )}
          {pushStatus === 'unsubscribed' && (
            <>
              <button className="btn btn-secondary" style={{ width: '100%', marginBottom: 4, fontSize: 12 }}
                onClick={handleEnablePush}>
                Включить уведомления
              </button>
              {pushError && (
                <div style={{ fontSize: 11, color: '#f87171', marginBottom: 4, lineHeight: 1.4 }}>
                  {pushError}
                </div>
              )}
              {isSafariOnly && (
                <div style={{ fontSize: 11, color: 'var(--c-muted)', lineHeight: 1.4, marginBottom: 4 }}>
                  На iPhone: откройте в Safari и добавьте на экран «Домой»
                </div>
              )}
            </>
          )}

          {user?.role === 'admin' && pushStatus === 'subscribed' && (
            <>
              <button className="btn btn-secondary" style={{ width: '100%', marginBottom: 4, fontSize: 12 }}
                onClick={handleTestPush} disabled={testBusy}>
                {testBusy ? 'Отправка...' : '🔔 Тест push'}
              </button>
              <div style={{ fontSize: 10, color: 'var(--c-muted)', lineHeight: 1.4, marginBottom: 6, padding: '0 2px' }}>
                Если уведомление не пришло:<br/>
                • Замок в адресной строке → Уведомления → Разрешить<br/>
                • Яндекс: Настройки → Сайты → Уведомления<br/>
                • Windows: Параметры → Система → Уведомления → включи Яндекс Браузер
              </div>
            </>
          )}

          <button className="btn btn-secondary" style={{ width: '100%' }} onClick={handleLogout}>
            Выйти
          </button>
        </div>
      </div>
    </>
  );
}
