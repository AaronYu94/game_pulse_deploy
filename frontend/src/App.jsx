import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext.jsx';
import LoginPage   from './pages/LoginPage.jsx';
import HomePage    from './pages/HomePage.jsx';
import GamePage    from './pages/GamePage.jsx';
import ForumPage   from './pages/ForumPage.jsx';
import ProfilePage from './pages/ProfilePage.jsx';
import ShopPage    from './pages/ShopPage.jsx';
import NewsPage    from './pages/NewsPage.jsx';

function ProtectedRoute({ children }) {
  const { isLoggedIn } = useAuth();
  const location = useLocation();
  const redirect = `${location.pathname}${location.search}`;

  return isLoggedIn
    ? children
    : <Navigate to={`/login?redirect=${encodeURIComponent(redirect)}`} replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<HomePage />} />
        <Route path="/game" element={<GamePage />} />
        <Route path="/forum" element={<ForumPage />} />
        <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
        <Route path="/shop" element={<ProtectedRoute><ShopPage /></ProtectedRoute>} />
        <Route path="/news" element={<NewsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
