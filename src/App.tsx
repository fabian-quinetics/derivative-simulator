import './App.css'
import { useTranslation } from 'react-i18next'
import WarrantCalculator from './components/WarrantCalculator'
import logo from './components/logo.png'

function App() {
  const { t, i18n } = useTranslation()
  const BASE_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
    ? 'http://127.0.0.1:8081' 
    : 'https://quinetics.net'
  
  return (
    <div className="app">
      <header className="header">
        <div className="header-row">
          <div className="header-brand">
            <a href={BASE_URL} className="logo-link" target="_blank" rel="noopener noreferrer">
              <img src={logo} alt="QUINETICS" className="logo-img" />
            </a>
            <div className="header-title">
              <h1>{t('header.title')}</h1>
              <p className="subtitle">{t('header.subtitle')} <span className="disclaimer-inline">— ⚠️ {t('header.disclaimerText')}</span></p>
            </div>
          </div>
          <div className="header-buttons">
            <a
              href={BASE_URL}
              className="ai-predictions-btn"
              target="_blank"
              rel="noopener noreferrer"
            >
              {t('header.aiPredictions')}
            </a>
            <button 
              className="lang-toggle"
              onClick={() => i18n.changeLanguage(i18n.language === 'de' ? 'en' : 'de')}
            >
              🌐 {i18n.language.toUpperCase()}
            </button>
          </div>
        </div>
      </header>
      <main>
        <WarrantCalculator />
      </main>
      <footer className="footer">
      </footer>
    </div>
  )
}

export default App
