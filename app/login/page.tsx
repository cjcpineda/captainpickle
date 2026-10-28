"use client";

import { useActionState } from "react";
import { login } from "../actions.ts";

export default function LoginPage() {
  const [error, action, pending] = useActionState(login, null);
  return (
    <main className="login">
      <form action={action} className="card card-body">
        <h1>
          Captain <span>Pickle</span>
        </h1>
        <p>Captains only. Sign in to see your schedule and talk lineups with your AI strategist.</p>
        {error && <p className="error">{error}</p>}
        <div className="field">
          <label htmlFor="email">Email</label>
          <input id="email" name="email" type="email" autoComplete="email" required />
        </div>
        <div className="field">
          <label htmlFor="password">Password</label>
          <input id="password" name="password" type="password" autoComplete="current-password" required />
        </div>
        <button className="button wide" disabled={pending}>
          {pending ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </main>
  );
}
