import api from './client';

function urlBase64ToUint8Array(base64) {
  const pad = '='.repeat((4 - base64.length % 4) % 4);
  const b64 = (base64 + pad).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64);
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
}

export async function getPushStatus() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    return 'unsupported';
  }
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    return sub ? 'subscribed' : 'unsubscribed';
  } catch {
    return 'unsupported';
  }
}

export async function subscribeToPush() {
  if (!('serviceWorker' in navigator)) {
    return { error: 'Service Worker не поддерживается в этом браузере' };
  }
  if (!('PushManager' in window)) {
    return { error: 'Push-уведомления не поддерживаются в этом браузере' };
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    return { error: 'Разрешение на уведомления не получено. Разрешите уведомления в адресной строке браузера.' };
  }

  try {
    const registration = await navigator.serviceWorker.ready;

    const existing = await registration.pushManager.getSubscription();
    if (existing) {
      await existing.unsubscribe();
    }

    const response = await fetch('http://127.0.0.1:8000/push/vapid-public-key');
    const { public_key } = await response.json();

    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(public_key),
    });

    console.log('[PUSH] endpoint:', subscription.endpoint);
    console.log('[PUSH] браузер:', navigator.userAgent);
    console.log('[PUSH] subscription keys:', JSON.stringify(subscription.toJSON?.() ?? subscription));

    await api.post('/push/subscribe', { subscription_json: JSON.stringify(subscription) });
    localStorage.setItem('push_confirmed_v2', '1');
    return { success: true };
  } catch (e) {
    return { error: e.message || 'Не удалось создать подписку' };
  }
}

export async function getPushServerStatus() {
  try {
    const resp = await api.get('/push/status');
    return resp.data.subscribed;   // true | false
  } catch {
    return null;                   // нет токена / сеть недоступна — не меняем UI
  }
}

export async function sendTestPush() {
  return api.post('/push/test');
}
