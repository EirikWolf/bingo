import { useState } from 'react';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { signInWithGoogle, signInWithEmail, registerWithEmail, signInAnon, resetPassword } from '@/services/auth';

type Mode = 'login' | 'register';

export default function LoginPage() {
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleGoogle() {
    setLoading(true);
    try {
      await signInWithGoogle();
    } catch (error) {
      console.error('Google sign-in error:', error);
      toast.error('Kunne ikke logge inn med Google');
    } finally {
      setLoading(false);
    }
  }

  async function handleAnonymous() {
    setLoading(true);
    try {
      await signInAnon();
    } catch (error) {
      console.error('Anonymous sign-in error:', error);
      toast.error('Kunne ikke logge inn anonymt');
    } finally {
      setLoading(false);
    }
  }

  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password) return;
    if (mode === 'register' && !displayName) return;

    setLoading(true);
    try {
      if (mode === 'login') {
        await signInWithEmail(email, password);
      } else {
        await registerWithEmail(email, password, displayName);
      }
    } catch (error) {
      console.error('Email auth error:', error);
      const msg = mode === 'login'
        ? 'Feil e-post eller passord'
        : 'Kunne ikke opprette konto';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-bingo-50 to-white p-4">
      <div className="mb-8 text-center">
        <h1 className="text-4xl font-extrabold text-bingo-800">BingoPortalen</h1>
        <p className="mt-2 text-gray-500">Digitalt bingosystem for foreninger</p>
      </div>

      <Card className="w-full max-w-sm" padding="lg">
        <Button
          onClick={handleGoogle}
          loading={loading}
          className="w-full"
          size="lg"
        >
          <svg className="mr-2 h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
            <path fill="#fff" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
            <path fill="#fff" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="#fff" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
            <path fill="#fff" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
          </svg>
          Logg inn med Google
        </Button>

        <div className="my-4 flex items-center gap-3">
          <div className="h-px flex-1 bg-gray-200" />
          <span className="text-xs text-gray-400">eller</span>
          <div className="h-px flex-1 bg-gray-200" />
        </div>

        <form onSubmit={handleEmailSubmit} className="space-y-3">
          {mode === 'register' && (
            <div>
              <label htmlFor="register-name" className="sr-only">Ditt navn</label>
              <input
                id="register-name"
                type="text"
                placeholder="Ditt navn"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-bingo-500 focus:outline-none focus:ring-2 focus:ring-bingo-500"
                required
                autoComplete="name"
              />
            </div>
          )}
          <div>
            <label htmlFor="login-email" className="sr-only">E-postadresse</label>
            <input
              id="login-email"
              type="email"
              placeholder="E-postadresse"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-bingo-500 focus:outline-none focus:ring-2 focus:ring-bingo-500"
              required
              autoComplete="email"
            />
          </div>
          <div>
            <label htmlFor="login-password" className="sr-only">Passord</label>
            <input
              id="login-password"
              type="password"
              placeholder="Passord"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-bingo-500 focus:outline-none focus:ring-2 focus:ring-bingo-500"
              required
              minLength={6}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            />
          </div>
          <Button type="submit" loading={loading} variant="secondary" className="w-full">
            {mode === 'login' ? 'Logg inn' : 'Opprett konto'}
          </Button>
        </form>

        <div className="mt-3 flex flex-col items-center gap-1">
          {mode === 'login' && (
            <button
              type="button"
              onClick={async () => {
                if (!email) {
                  toast.error('Skriv inn e-postadressen din først');
                  return;
                }
                try {
                  await resetPassword(email);
                  toast.success('E-post for tilbakestilling av passord er sendt!');
                } catch {
                  toast.error('Kunne ikke sende tilbakestillingslenke');
                }
              }}
              className="text-sm text-gray-500 hover:text-bingo-600 hover:underline"
            >
              Glemt passord?
            </button>
          )}
          <button
            type="button"
            onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
            className="text-sm text-bingo-600 hover:underline"
          >
            {mode === 'login' ? 'Har du ikke konto? Registrer deg' : 'Har du allerede konto? Logg inn'}
          </button>
        </div>

        <div className="mt-4 pt-4 border-t border-gray-100">
          <Button
            onClick={handleAnonymous}
            loading={loading}
            variant="ghost"
            size="sm"
            className="w-full"
          >
            Fortsett uten konto
          </Button>
        </div>
      </Card>
    </div>
  );
}
