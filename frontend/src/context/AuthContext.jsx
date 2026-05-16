import { createContext, useContext, useEffect, useState } from 'react';
import { getMe } from '../api/auth';

const Ctx = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!localStorage.getItem('token')) { setLoading(false); return; }
    getMe()
      .then(r => setUser(r.data))
      .catch(() => localStorage.removeItem('token'))
      .finally(() => setLoading(false));
  }, []);

  return <Ctx.Provider value={{ user, setUser, loading }}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);
