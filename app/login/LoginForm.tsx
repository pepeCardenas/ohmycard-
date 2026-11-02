'use client'

import { useState } from 'react'
import { authClient } from '@/lib/auth-client'

export default function LoginForm() {
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setBusy(true)
    const res =
      mode === 'login'
        ? await authClient.signIn.email({ email, password })
        : await authClient.signUp.email({ email, password, name: name.trim() || email.split('@')[0] })
    setBusy(false)
    if (res.error) {
      const code = res.error.code ?? ''
      setError(
        code.includes('INVALID_EMAIL_OR_PASSWORD')
          ? 'Mail o contraseña incorrectos.'
          : code.includes('USER_ALREADY_EXISTS')
            ? 'Ya hay una cuenta con ese mail. Inicia sesión.'
            : code.includes('PASSWORD_TOO_SHORT')
              ? 'La contraseña tiene que tener al menos 8 caracteres.'
              : (res.error.message ?? 'No se pudo continuar.'),
      )
      return
    }
    window.location.href = '/'
  }

  return (
    <main className="login">
      <img src="/icon.svg" alt="" width={72} height={72} />
      <h1>OhMyCard!!</h1>
      <p className="muted">{mode === 'login' ? 'Inicia sesión para ver tus binders.' : 'Crea tu cuenta.'}</p>

      <form onSubmit={submit}>
        {mode === 'signup' && (
          <input
            className="search-input"
            placeholder="Tu nombre (opcional)"
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        )}
        <input
          className="search-input"
          type="email"
          placeholder="Mail"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          className="search-input"
          type="password"
          placeholder="Contraseña"
          autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
          minLength={8}
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {error && <p className="error-text">{error}</p>}
        <button type="submit" className="primary big-btn" disabled={busy}>
          {busy ? 'Un momento…' : mode === 'login' ? 'Entrar' : 'Crear cuenta'}
        </button>
      </form>

      <button
        className="link"
        onClick={() => {
          setMode(mode === 'login' ? 'signup' : 'login')
          setError(null)
        }}
      >
        {mode === 'login' ? '¿No tienes cuenta? Crear una' : 'Ya tengo cuenta'}
      </button>
    </main>
  )
}
