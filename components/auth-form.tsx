'use client';
import Link from 'next/link';
import { useState } from 'react';
import { ArrowRight, Camera, Heart } from 'lucide-react';
import { ActionForm } from './action-form';
import { Field } from './ui';
export function AuthForm({
  register = false,
  categories = [],
  initialRole = 'CUSTOMER',
}: {
  register?: boolean;
  categories?: { id: string; name: string }[];
  initialRole?: string;
}) {
  const [role, setRole] = useState(initialRole);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  return (
    <>
      <ActionForm endpoint={`/api/auth/${register ? 'register' : 'login'}`} className="auth-form">
        <input type="hidden" name="role" value={role} />
        {register && (
          <>
            <div className="role-picker">
              <button
                type="button"
                className={role === 'CUSTOMER' ? 'selected' : ''}
                onClick={() => setRole('CUSTOMER')}
              >
                <Heart size={19} />
                I’m planning an event
              </button>
              <button
                type="button"
                className={role === 'PROVIDER' ? 'selected' : ''}
                onClick={() => setRole('PROVIDER')}
              >
                <Camera size={19} />I offer a service
              </button>
            </div>
            <Field label={role === 'PROVIDER' ? 'Owner / contact name' : 'Full name'}>
              <input
                name="name"
                required
                minLength={2}
                autoComplete="name"
                placeholder="Your full name"
              />
            </Field>
          </>
        )}
        <Field label="Email address">
          <input
            name="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
          />
        </Field>
        <Field label="Password" hint={register ? 'At least 10 characters.' : undefined}>
          <input
            name="password"
            type="password"
            required
            minLength={register ? 10 : 1}
            maxLength={128}
            autoComplete={register ? 'new-password' : 'current-password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={register ? 'Create a strong password' : 'Enter your password'}
          />
        </Field>
        {register ? (
          <>
            <Field label="Confirm password">
              <input
                name="confirmPassword"
                type="password"
                required
                minLength={10}
                autoComplete="new-password"
              />
            </Field>
            <Field label={`Phone${role === 'CUSTOMER' ? ' (optional)' : ''}`}>
              <input name="phone" type="tel" required={role === 'PROVIDER'} autoComplete="tel" />
            </Field>
            {role === 'PROVIDER' ? (
              <>
                <Field label="Business name">
                  <input name="businessName" required minLength={2} />
                </Field>
                <Field label="Primary service">
                  <select name="categoryId" required>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Tell us about your business">
                  <textarea name="description" required minLength={10} rows={3} />
                </Field>
              </>
            ) : (
              <Field label="Referral code (optional)">
                <input name="referralCode" placeholder="A little celebration shared" />
              </Field>
            )}
          </>
        ) : (
          <label className="check-label">
            <input type="checkbox" name="remember" />
            Remember me for 30 days
          </label>
        )}
        <button type="submit" className="btn full">
          {register ? 'Create your account' : 'Welcome back'}
          <ArrowRight size={17} />
        </button>
      </ActionForm>
      <p className="auth-switch">
        {register ? 'Already part of the celebration?' : 'New around here?'}{' '}
        <Link href={register ? '/login' : '/register'}>
          {register ? 'Log in' : 'Create an account'}
        </Link>
      </p>
      {!register && (
        <div className="demo-logins">
          <span className="eyebrow">EXPLORE THE LOCAL DEMO</span>
          <div className="button-row">
            {['customer', 'provider', 'admin'].map((r) => (
              <button
                className="btn small secondary"
                key={r}
                onClick={() => {
                  setEmail(`${r}@demo.local`);
                  setPassword('DemoPass!2026');
                }}
                type="button"
              >
                {r[0].toUpperCase() + r.slice(1)}
              </button>
            ))}
          </div>
          <small>Choose a role to fill its development credentials, then sign in.</small>
        </div>
      )}
    </>
  );
}
