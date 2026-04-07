import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
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
  return isLoggedIn ? children : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<ProtectedRoute><HomePage /></ProtectedRoute>} />
        <Route path="/game" element={<ProtectedRoute><GamePage /></ProtectedRoute>} />
        <Route path="/forum"   element={<ProtectedRoute><ForumPage /></ProtectedRoute>} />
        <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
        <Route path="/shop"    element={<ProtectedRoute><ShopPage /></ProtectedRoute>} />
        <Route path="/news"    element={<ProtectedRoute><NewsPage /></ProtectedRoute>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
