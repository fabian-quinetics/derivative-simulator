import './App.css'
import WarrantCalculator from './components/WarrantCalculator'

function App() {
  return (
    <div className="app">
      <header className="header">
        <h1>Derivate Visualisierer</h1>
        <p className="subtitle">Analysieren Sie Call & Put Optionsscheine interaktiv</p>
      </header>
      <main>
        <WarrantCalculator />
      </main>
      <footer className="footer">
        <p>MVP - Derivate Simulator für Retail-Kunden</p>
      </footer>
    </div>
  )
}

export default App
