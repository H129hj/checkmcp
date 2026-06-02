"use client";
import { useFormState, useFormStatus } from "react-dom";
import Link from "next/link";
import { login, signup, type FormState } from "../app/account/actions";

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button className="btn btn-primary w-full" type="submit" disabled={pending}>
      {pending ? <span className="loading loading-spinner loading-sm" /> : label}
    </button>
  );
}

export default function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const action = mode === "signup" ? signup : login;
  const [state, formAction] = useFormState<FormState, FormData>(action, undefined);
  return (
    <div className="mx-auto max-w-md py-20">
      <div className="font-mono text-xs uppercase tracking-[0.22em] text-primary/80">{mode === "signup" ? "Create account" : "Sign in"}</div>
      <h1 className="mb-6 mt-3 text-3xl font-extrabold">{mode === "signup" ? "Join CheckMCP" : "Welcome back"}</h1>
      <form action={formAction} className="card border border-base-content/10 bg-base-200/60">
        <div className="card-body gap-3">
          <label className="form-control">
            <span className="label-text font-mono text-xs text-base-content/60">EMAIL</span>
            <input name="email" type="email" required autoComplete="email" spellCheck={false} inputMode="email"
              className="input input-bordered bg-base-100 font-mono text-sm" placeholder="toi@exemple.com" />
          </label>
          <label className="form-control">
            <span className="label-text font-mono text-xs text-base-content/60">PASSWORD</span>
            <input name="password" type="password" required minLength={8} autoComplete={mode === "signup" ? "new-password" : "current-password"}
              className="input input-bordered bg-base-100 font-mono text-sm" placeholder="8 characters minimum" />
          </label>
          {state?.error && <div role="alert" aria-live="polite" className="font-mono text-sm text-g-f">{state.error}</div>}
          <Submit label={mode === "signup" ? "Create my account" : "Sign in"} />
        </div>
      </form>
      <p className="mt-4 text-sm text-base-content/60">
        {mode === "signup"
          ? <>Already have an account? <Link href="/login" className="text-primary">Sign in</Link></>
          : <>No account? <Link href="/signup" className="text-primary">Create one</Link></>}
      </p>
    </div>
  );
}
