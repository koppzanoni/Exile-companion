import { Check, Download, RefreshCw, Save, Trash2 } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { api } from '../api';
import {LanguageSelector} from '../components/LanguageSelector';
import {useI18n} from '../i18n';

export function SettingsPage() {
  const{t}=useI18n();
  const [rate, setRate] = useState(65);
  const [league, setLeague] = useState('Runes of Aldur');
  const [risk, setRisk] = useState<'Low'|'Medium'|'High'>('Medium');
  const [warnings, setWarnings] = useState(true);
  const [conservative, setConservative] = useState(true);
  const [mode, setMode] = useState<'Beginner'|'Advanced'>('Beginner');
  const [saved, setSaved] = useState(false);
  const [deletePassword,setDeletePassword]=useState('');const [deleteConfirmation,setDeleteConfirmation]=useState('');const [accountMessage,setAccountMessage]=useState('');
  const [geminiUsage,setGeminiUsage]=useState<Awaited<ReturnType<typeof api.geminiUsage>>|null>(null);
  const [sessions,setSessions]=useState<Awaited<ReturnType<typeof api.authSessions>>['sessions']>([]);const[currentPassword,setCurrentPassword]=useState('');const[newPassword,setNewPassword]=useState('');

  useEffect(() => { api.settings().then(s => {
    setRate(s.divineToExalted); setLeague(s.defaultLeague); setRisk(s.craftingRiskTolerance || 'Medium');
    setWarnings(s.showCurrencyWarnings ?? true); setConservative(s.conservativeCraftingRecommendations ?? true);
    setMode(s.interfaceMode || 'Beginner');
  });api.geminiUsage().then(result=>{if(result?.daily&&Array.isArray(result.recent))setGeminiUsage(result);}).catch(()=>{});api.authSessions().then(result=>setSessions(result.sessions||[])).catch(()=>{}); }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    await api.saveSettings({ divineToExalted: rate, defaultLeague: league, craftingRiskTolerance: risk, showCurrencyWarnings: warnings, conservativeCraftingRecommendations: conservative, interfaceMode: mode });
    setSaved(true); setTimeout(() => setSaved(false), 2500);
  }
  async function exportAccount(){const data=await api.accountExport();const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));const anchor=document.createElement('a');anchor.href=url;anchor.download='exile-companion-account.json';anchor.click();URL.revokeObjectURL(url);setAccountMessage('Account export created.');}
  async function deleteAccount(){try{await api.deleteAccount(deletePassword,deleteConfirmation);localStorage.removeItem('session-csrf');window.location.reload();}catch(error){setAccountMessage(error instanceof Error?error.message:'Account deletion failed.');}}
  async function changePassword(){try{await api.changePassword(currentPassword,newPassword);setCurrentPassword('');setNewPassword('');setAccountMessage('Password changed and other sessions revoked.');setSessions((await api.authSessions()).sessions);}catch(error){setAccountMessage(error instanceof Error?error.message:'Could not change password.');}}

  return <div className="page standard-page"><header className="page-header"><span className="eyebrow">{t('settings.eyebrow').toUpperCase()}</span><h1>{t('settings.title')}</h1><p>{t('settings.subtitle')}</p></header><form className="settings-card card" onSubmit={submit}>
    <div className="setting-row"><div><h2>{t('language.label')}</h2><p>English / Português (Brasil)</p></div><LanguageSelector/></div>
    <div className="setting-row"><div><h2>{t('settings.interface')}</h2><p>{t('settings.interfaceHelp')}</p></div><select aria-label={t('settings.interface')} value={mode} onChange={e => setMode(e.target.value as 'Beginner'|'Advanced')}><option value="Beginner">{t('settings.beginner')}</option><option value="Advanced">{t('settings.advanced')}</option></select></div>
    <div className="setting-row"><div><h2>{t('settings.defaultLeague')}</h2><p>{t('settings.defaultLeagueHelp')}</p></div><select aria-label={t('settings.defaultLeague')} value={league} onChange={e => setLeague(e.target.value)}><option>Runes of Aldur</option><option>Standard</option><option>Hardcore</option></select></div>
    <div className="setting-row"><div><h2>{t('settings.divineRate')}</h2><p>{t('settings.divineRateHelp')}</p></div><div className="setting-rate"><span>1 Divine</span><b>=</b><input aria-label={t('settings.divineRate')} type="number" min="0.1" step="0.1" value={rate} onChange={e => setRate(Number(e.target.value))}/><span>Exalted</span></div></div>
    <div className="setting-row"><div><h2>{t('settings.risk')}</h2><p>{t('settings.riskHelp')}</p></div><select aria-label={t('settings.risk')} value={risk} onChange={e => setRisk(e.target.value as typeof risk)}><option value="Low">{t('settings.low')}</option><option value="Medium">{t('settings.medium')}</option><option value="High">{t('settings.high')}</option></select></div>
    <div className="setting-row toggle-setting"><div><h2>{t('settings.warnings')}</h2><p>{t('settings.warningsHelp')}</p></div><label><input aria-label={t('settings.warnings')} type="checkbox" checked={warnings} onChange={e => setWarnings(e.target.checked)}/>{t('settings.enabled')}</label></div>
    <div className="setting-row toggle-setting"><div><h2>{t('settings.conservative')}</h2><p>{t('settings.conservativeHelp')}</p></div><label><input aria-label={t('settings.conservative')} type="checkbox" checked={conservative} onChange={e => setConservative(e.target.checked)}/>{t('settings.enabled')}</label></div>
    {geminiUsage&&<div className="setting-row"><div><h2>Gemini usage today</h2><p>Cost appears only when current provider pricing is configured.</p></div><div><strong>{geminiUsage.daily.requests} requests</strong><small>{geminiUsage.daily.estimatedTokens} estimated tokens · {geminiUsage.pricingConfigured?`$${Number(geminiUsage.daily.estimatedCostUsd).toFixed(4)}`:'cost pricing disabled'} · {geminiUsage.daily.blocked} blocked</small></div></div>}
    {sessions.length>0&&<div className="setting-row"><div><h2>Active sessions</h2><p>{sessions.length} active · changing your password closes every other session.</p></div><div className="account-delete"><input type="password" aria-label="Current password" placeholder="Current password" value={currentPassword} onChange={event=>setCurrentPassword(event.target.value)}/><input type="password" aria-label="New password" placeholder="New password (12+ characters)" value={newPassword} onChange={event=>setNewPassword(event.target.value)}/><button type="button" disabled={currentPassword.length<10||newPassword.length<12} onClick={changePassword}>Change password</button></div></div>}
    <div className="settings-note"><RefreshCw/><p>{t('settings.future')}</p></div><button className="primary-button">{saved ? <Check/> : <Save/>}{saved?t('settings.saved'):t('settings.save')}</button>
  </form><section className="settings-card card"><div className="setting-row"><div><h2>{t('settings.data')}</h2><p>{t('settings.dataHelp')}</p></div><button type="button" onClick={exportAccount}><Download/>{t('settings.export')}</button></div><div className="setting-row"><div><h2>{t('settings.delete')}</h2><p>{t('settings.deleteHelp')}</p></div><div className="account-delete"><input type="password" aria-label="Password for account deletion" placeholder="Password" value={deletePassword} onChange={event=>setDeletePassword(event.target.value)}/><input aria-label="Account deletion confirmation" placeholder="DELETE MY ACCOUNT" value={deleteConfirmation} onChange={event=>setDeleteConfirmation(event.target.value)}/><button className="danger-button" type="button" disabled={deletePassword.length<10||deleteConfirmation!=='DELETE MY ACCOUNT'} onClick={deleteAccount}><Trash2/>{t('settings.deletePermanent')}</button></div></div>{accountMessage&&<div aria-live="polite" className="settings-note">{accountMessage}</div>}</section></div>;
}
