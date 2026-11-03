import { useState } from "react";
import { useAuth } from "../auth.jsx";
import { useAction } from "../lib/hooks.js";
import { Field, Icon, Panel } from "./ui.jsx";

// Shows a name form in place when the person has no identity yet; otherwise renders children.
export default function IdentityGate({ title = "Enter your name to continue", children }) {
  const { user, ready, signUp } = useAuth();
  const [name, setName] = useState("");
  const { busy, error, run } = useAction();
  if (!ready) return null;
  if (user) return children;
  return (
    <Panel title={title} icon="user-circle" className="mx-auto max-w-md">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          run(() => signUp(name));
        }}
        className="space-y-3"
      >
        <Field label="Your name" htmlFor="gate-name" error={error?.message} hint="Shown next to your contributions. This demo has no password or email.">
          <input id="gate-name" className={`input ${error ? "input-error" : ""}`} value={name} onChange={(e) => setName(e.target.value)} maxLength={40} autoComplete="given-name" required />
        </Field>
        <button className="btn btn-primary" disabled={busy || name.trim().length < 2}>
          {busy ? "One moment" : "Continue"}
          <Icon name="arrow-right" />
        </button>
      </form>
    </Panel>
  );
}
