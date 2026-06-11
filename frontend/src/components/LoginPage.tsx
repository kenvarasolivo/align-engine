import { useState } from "react";
import type { FormEvent } from "react";
import { useAuth } from "../contexts/AuthContext";

type AuthMode = "signin" | "signup";

export default function LoginPage() {
  const { signIn, signUp, continueAsGuest } = useAuth();

  const [authMode, setAuthMode] = useState<AuthMode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    setError(null);
    setNotice(null);

    try {
      if (authMode === "signin") {
        const message = await signIn(email, password);
        if (message) setError(message);
      } else {
        const { error: message, needsConfirmation } = await signUp(email, password);
        if (message) {
          setError(message);
        } else if (needsConfirmation) {
          setNotice("Almost there — check your inbox and confirm your email, then sign in.");
          setAuthMode("signin");
        }
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface px-4">
      <div className="w-full max-w-sm">
        {/* Brand */}
        <div className="text-center mb-8 select-none">
          <h1 className="text-3xl font-extrabold tracking-tight text-obsidian">ALIGN</h1>
          <p className="mt-2 text-sm text-charcoal/60">
            Sign in to keep your analyses, resumes and saved jobs.
          </p>
        </div>

        <div className="bg-white rounded-2xl border-[1px] border-hairline shadow-sm p-6">
          {/* Sign in / Sign up toggle */}
          <div className="flex items-center p-0.5 mb-6 rounded-lg border-[1px] border-hairline bg-surface">
            {(
              [
                { value: "signin", label: "Sign in" },
                { value: "signup", label: "Create account" },
              ] as { value: AuthMode; label: string }[]
            ).map(({ value, label }) => (
              <button
                key={value}
                type="button"
                onClick={() => {
                  setAuthMode(value);
                  setError(null);
                  setNotice(null);
                }}
                className={`flex-1 px-3 py-1.5 text-sm font-medium rounded-md transition-all duration-200 ${
                  authMode === value ? "bg-white text-cobalt shadow-sm" : "text-charcoal/70 hover:text-obsidian"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-[11px] font-semibold uppercase tracking-widest text-charcoal/50 mb-1.5">
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="w-full h-10 px-3 text-sm rounded-lg border-[1px] border-hairline bg-white outline-none transition-all duration-200 focus:border-cobalt/60 focus:ring-2 focus:ring-cobalt/10"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-[11px] font-semibold uppercase tracking-widest text-charcoal/50 mb-1.5">
                Password
              </label>
              <input
                id="password"
                type="password"
                required
                minLength={6}
                autoComplete={authMode === "signin" ? "current-password" : "new-password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full h-10 px-3 text-sm rounded-lg border-[1px] border-hairline bg-white outline-none transition-all duration-200 focus:border-cobalt/60 focus:ring-2 focus:ring-cobalt/10"
              />
            </div>

            {error && (
              <p className="text-xs leading-snug text-red-600" role="alert">
                {error}
              </p>
            )}
            {notice && <p className="text-xs leading-snug text-cobalt">{notice}</p>}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full h-10 inline-flex items-center justify-center rounded-lg bg-cobalt text-white text-sm font-semibold transition-all duration-200 hover:bg-cobalt-hover active:scale-[0.99] disabled:opacity-40"
            >
              {isSubmitting ? "Please wait…" : authMode === "signin" ? "Sign in" : "Create account"}
            </button>
          </form>
        </div>

        {/* Guest path */}
        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={continueAsGuest}
            className="text-sm font-medium text-charcoal/60 hover:text-cobalt transition-colors duration-200"
          >
            Continue as guest →
          </button>
          <p className="mt-1.5 text-xs text-charcoal/40">
            Guest sessions work fully, but nothing is saved.
          </p>
        </div>
      </div>
    </div>
  );
}
