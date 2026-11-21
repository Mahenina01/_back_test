import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, ShieldCheck, Eye, EyeOff, ArrowRight, CheckCircle2, Mail, LockKeyhole, UserRound } from 'lucide-react';
import ChickIcon from '../components/ChickIcon';
import { useAuth } from '../hooks/useAuth';

const USE_MOCKS = import.meta.env.DEV && import.meta.env.VITE_USE_MOCKS === 'true';

export default function Login() {
  const [mode, setMode] = useState('login');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    if (mode === 'register' && password !== confirmPassword) {
      setError('Les deux mots de passe ne correspondent pas.');
      return;
    }
    setLoading(true);
    try {
      const result = mode === 'register'
        ? await register(fullName, email, password)
        : await login(email, password);
      if (result.success) navigate('/dashboard');
      else setError(result.message || (mode === 'register' ? 'Inscription impossible' : 'Identifiants invalides'));
    } catch {
      setError('Une erreur est survenue. Vérifiez votre connexion puis réessayez.');
    } finally {
      setLoading(false);
    }
  };

  const inputClass = 'auth-input w-full rounded-xl border border-slate-200 bg-white px-4 py-3 pl-11 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10';

  return (
    <main className="auth-screen">
      <section className="auth-visual" aria-label="Smart Incubator">
        <div className="auth-brand">
          <span className="auth-brand-icon"><ChickIcon className="h-7 w-7" /></span>
          <span><b>Smart Incubator</b><small>Supervision intelligente</small></span>
        </div>
        <div className="auth-message">
          <span className="auth-eyebrow">VOTRE ÉLEVAGE, MAÎTRISÉ</span>
          <h1>Des éclosions plus sereines, chaque jour.</h1>
          <p>Surveillez vos couveuses, suivez vos incubations et recevez les bonnes alertes au bon moment.</p>
        </div>
        <div className="auth-benefits"><span><b>24/7</b>Surveillance continue</span><span><b>En direct</b>Données actualisées</span></div>
        <div className="auth-orb auth-orb-one" /><div className="auth-orb auth-orb-two" />
      </section>

      <section className="auth-panel">
        <div className="auth-mobile-brand">
          <span className="auth-brand-icon"><ChickIcon className="h-6 w-6" /></span>
          <span><b>Smart Incubator</b><small>Supervision intelligente</small></span>
        </div>
        <div className="auth-form-wrap">
          <div className="auth-heading-icon"><ShieldCheck className="h-5 w-5" /></div>
          <p className="auth-kicker">ESPACE SÉCURISÉ</p>
          <h2>{mode === 'login' ? 'Bon retour parmi nous.' : 'Créez votre espace.'}</h2>
          <p className="auth-intro">{mode === 'login' ? 'Connectez-vous pour retrouver le suivi de vos couveuses.' : 'Inscrivez-vous pour gérer vos couveuses en temps réel.'}</p>
          {USE_MOCKS && (
            <p className="mt-4 rounded-xl bg-amber-50 px-4 py-3 text-xs leading-relaxed text-amber-900">
              Mode démonstration : ce compte sera enregistré uniquement dans ce navigateur et n’est pas synchronisé avec Netlify.
            </p>
          )}

          <form onSubmit={handleSubmit} className="auth-form">
            {mode === 'register' && <div className="auth-field"><label htmlFor="fullName">Nom complet</label><div className="auth-control"><UserRound className="auth-field-icon" /><input id="fullName" className={inputClass} value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Votre nom complet" autoComplete="name" minLength={2} required /></div></div>}
            <div className="auth-field"><label htmlFor="email">Adresse e-mail</label><div className="auth-control"><Mail className="auth-field-icon" /><input id="email" type="email" className={inputClass} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="vous@exemple.com" autoComplete="email" required /></div></div>
            <div className="auth-field"><label htmlFor="password">Mot de passe</label><div className="auth-control"><LockKeyhole className="auth-field-icon" /><input id="password" type={showPassword ? 'text' : 'password'} className={`${inputClass} pr-12`} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="6 caractères minimum" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} minLength={6} required /><button className="auth-eye" type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></div></div>
            {mode === 'register' && <div className="auth-field"><label htmlFor="confirmPassword">Confirmer le mot de passe</label><div className="auth-control"><LockKeyhole className="auth-field-icon" /><input id="confirmPassword" type="password" className={inputClass} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Répétez le mot de passe" autoComplete="new-password" minLength={6} required /></div></div>}
            {error && <div className="auth-error" role="alert"><AlertCircle size={17} />{error}</div>}
            <button type="submit" disabled={loading} className="auth-submit">{loading ? (mode === 'login' ? 'Connexion…' : 'Création du compte…') : (mode === 'login' ? 'Se connecter' : 'Créer mon compte')} {!loading && <ArrowRight size={17} />}</button>
          </form>
          <button type="button" onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); }} className="auth-switch">{mode === 'login' ? 'Pas encore de compte ? Créer un compte' : 'Déjà inscrit ? Se connecter'}</button>
          <div className="auth-assurance"><CheckCircle2 size={17} /><span>Vos données restent protégées et accessibles à tout moment.</span></div>
        </div>
        <p className="auth-footer">© Smart Incubator · Gestion intelligente de l’incubation</p>
      </section>
    </main>
  );
}
