import { useState, useEffect, useCallback } from 'react';
import WelcomePage from './pages/WelcomePage';
import HomePage from './pages/HomePage';
import CheckinPage from './pages/CheckinPage';
import GalaxyPage from './pages/GalaxyPage';
import AIChatPage from './pages/AIChatPage';
import ReportPage from './pages/ReportPage';
import type { AppPage } from './types/observer';

export default function App() {
  const [page, setPage] = useState<AppPage>('welcome');

  return (
    <div className="app-root">
      {page === 'welcome' && <WelcomePage onEnter={() => setPage('home')} />}
      {page === 'home' && <HomePage onNavigate={setPage} />}
      {page === 'checkin' && <CheckinPage onBack={() => setPage('home')} />}
      {page === 'galaxy' && <GalaxyPage onBack={() => setPage('home')} />}
      {page === 'ai' && <AIChatPage onBack={() => setPage('home')} />}
      {page === 'report' && <ReportPage onBack={() => setPage('home')} />}
    </div>
  );
}
