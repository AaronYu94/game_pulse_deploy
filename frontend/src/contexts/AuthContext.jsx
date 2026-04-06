import { createContext, useContext, useState, useCallback } from 'react';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem('score_token'));
  const [user,  setUser]  = useState(() => {
    try { return JSON.parse(localStorage.getItem('score_user')); } catch { return null; }
  });

  const login = useCallback((newToken, newUser) => {
    localStorage.setItem('score_token', newToken);
    localStorage.setItem('score_user', JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('score_token');
    localStorage.removeItem('score_user');
    setToken(null);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ token, user, isLoggedIn: !!token, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
