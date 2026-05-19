const BASE_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';
const WS_BASE = BASE_URL.replace(/^https/, 'wss').replace(/^http/, 'ws');

const _listeners = new Set();
let _ws = null;
let _reconnectTimer = null;
let _reconnectDelay = 2000;
let _active = false;

export function connect() {
  _active = true;
  _reconnectDelay = 2000;
  _doConnect();
}

function _doConnect() {
  if (!_active) return;
  const token = localStorage.getItem('token');
  if (!token) return;
  if (_ws && (_ws.readyState === WebSocket.CONNECTING || _ws.readyState === WebSocket.OPEN)) return;

  _ws = new WebSocket(`${WS_BASE}/ws?token=${encodeURIComponent(token)}`);

  _ws.onopen = () => {
    _reconnectDelay = 2000;
  };

  _ws.onmessage = (e) => {
    try {
      const msg = JSON.parse(e.data);
      _listeners.forEach(fn => fn(msg));
    } catch {}
  };

  _ws.onclose = () => {
    _ws = null;
    if (_active) {
      _reconnectTimer = setTimeout(_doConnect, _reconnectDelay);
      _reconnectDelay = Math.min(_reconnectDelay * 2, 30000);
    }
  };

  _ws.onerror = () => {
    _ws?.close();
  };
}

export function disconnect() {
  _active = false;
  clearTimeout(_reconnectTimer);
  if (_ws) {
    _ws.onclose = null;
    _ws.close();
    _ws = null;
  }
}

export function subscribe(fn) {
  _listeners.add(fn);
  return () => _listeners.delete(fn);
}
