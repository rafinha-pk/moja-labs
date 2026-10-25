import { useState, type FormEvent, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useAction } from '../../api/useAction';
import { useAuth } from '../../auth/AuthContext';
import { Button } from '../../components/Button';
import { ErrorAlert, fieldError } from '../../components/ErrorAlert';
import { TextField } from '../../components/Field';
import { pt } from '../../i18n/pt';

function AuthFrame({
  title,
  children,
  footer,
}: {
  title: string;
  children: ReactNode;
  footer: ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4">
      <h1 className="text-2xl font-semibold">{title}</h1>
      <div className="w-full max-w-sm rounded-md border border-line bg-subtle p-4">
        {children}
      </div>
      <p className="w-full max-w-sm rounded-md border border-line px-4 py-3 text-center text-sm">
        {footer}
      </p>
    </div>
  );
}

export function LoginPage() {
  const { login } = useAuth();
  const { run, pending, error } = useAction();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const submit = (event: FormEvent) => {
    event.preventDefault();
    void run(() => login(email, password));
  };

  return (
    <AuthFrame
      title={pt.auth.loginTitle}
      footer={
        <>
          {pt.auth.noAccount} <Link to="/register">{pt.auth.signUp}</Link>
        </>
      }
    >
      <form onSubmit={submit} className="flex flex-col gap-4">
        <ErrorAlert error={error} />
        <TextField
          id="email"
          label={pt.auth.email}
          type="email"
          autoComplete="email"
          autoFocus
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          error={fieldError(error, 'email')}
        />
        <TextField
          id="password"
          label={pt.auth.password}
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
        <Button type="submit" variant="primary" disabled={pending}>
          {pt.auth.signIn}
        </Button>
      </form>
    </AuthFrame>
  );
}

export function RegisterPage() {
  const { register } = useAuth();
  const { run, pending, error } = useAction();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const submit = (event: FormEvent) => {
    event.preventDefault();
    void run(() => register(email, name, password));
  };

  return (
    <AuthFrame
      title={pt.auth.registerTitle}
      footer={
        <>
          {pt.auth.hasAccount} <Link to="/login">{pt.auth.signIn}</Link>
        </>
      }
    >
      <form onSubmit={submit} className="flex flex-col gap-4">
        <ErrorAlert error={error} />
        <TextField
          id="name"
          label={pt.auth.name}
          autoComplete="name"
          autoFocus
          required
          maxLength={100}
          value={name}
          onChange={(event) => setName(event.target.value)}
          error={fieldError(error, 'name')}
        />
        <TextField
          id="email"
          label={pt.auth.email}
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          error={fieldError(error, 'email')}
        />
        <TextField
          id="password"
          label={pt.auth.password}
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          maxLength={128}
          hint={pt.auth.passwordHint}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          error={fieldError(error, 'password')}
        />
        <Button type="submit" variant="primary" disabled={pending}>
          {pt.auth.signUp}
        </Button>
      </form>
    </AuthFrame>
  );
}
