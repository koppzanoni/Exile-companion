import { Activity, Archive, BookOpen, Database, Gem, Menu, Settings, Stethoscope, Swords, TrendingUp, Users, X } from 'lucide-react';
import { useState } from 'react';
import { NavLink, Route, Routes } from 'react-router-dom';
import { AnalyzerPage } from './pages/AnalyzerPage';
import { SavedPage } from './pages/SavedPage';
import { SettingsPage } from './pages/SettingsPage';
import { DocsPage } from './pages/DocsPage';
import { BuildPage } from './pages/BuildPage';
import { BuildDoctorPage } from './pages/BuildDoctorPage';
import { CharactersPage } from './pages/CharactersPage';
import { LevelingPage } from './pages/LevelingPage';
import { KnowledgePage } from './pages/KnowledgePage';

const nav = [
  ['/', Activity, 'Analyzer'], ['/characters', Users, 'Characters'], ['/build', Swords, 'My Build'], ['/build-doctor', Stethoscope, 'Build Doctor'], ['/leveling', TrendingUp, 'Leveling'], ['/saved', Archive, 'Saved checks'], ['/knowledge', Database, 'Data'], ['/settings', Settings, 'Settings'], ['/docs', BookOpen, 'Docs'],
] as const;

export default function App() {
  const [open, setOpen] = useState(false);
  return <div className="app-shell">
    <header className="topbar">
      <NavLink to="/" className="brand"><span className="brand-mark"><Gem size={19}/></span><span><strong>RELIC LENS</strong><small>POE 2 MARKET ANALYZER</small></span></NavLink>
      <button className="menu-button" onClick={() => setOpen(!open)} aria-label="Toggle navigation">{open ? <X/> : <Menu/>}</button>
      <nav className={open ? 'nav open' : 'nav'}>{nav.map(([to, Icon, label]) => <NavLink key={to} to={to} onClick={() => setOpen(false)} className={({ isActive }) => isActive ? 'active' : ''}><Icon size={16}/>{label}</NavLink>)}</nav>
      <span className="official-pill"><i/> Official Trade2</span>
    </header>
    <main><Routes><Route path="/" element={<AnalyzerPage/>}/><Route path="/characters" element={<CharactersPage/>}/><Route path="/build" element={<BuildPage/>}/><Route path="/build-doctor" element={<BuildDoctorPage/>}/><Route path="/leveling" element={<LevelingPage/>}/><Route path="/saved" element={<SavedPage/>}/><Route path="/knowledge" element={<KnowledgePage/>}/><Route path="/settings" element={<SettingsPage/>}/><Route path="/docs" element={<DocsPage/>}/></Routes></main>
    <footer><span>RELIC LENS</span><span>Unofficial tool · Prices are evidence, not prophecy.</span></footer>
  </div>;
}
