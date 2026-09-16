import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Redirect, useLocation } from "wouter";
import { Loader2, Eye, EyeOff, RefreshCw, Turtle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

/* ── SVG Captcha ──────────────────────────────────────────── */
const CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
function randomChar() { return CHARS[Math.floor(Math.random() * CHARS.length)]; }
function randomInt(min: number, max: number) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function generateCaptchaCode(len = 5) { return Array.from({ length: len }, randomChar).join(""); }

function CaptchaImage({ code, tick, width = 200, height = 52 }: { code: string; tick: number; width?: number; height?: number }) {
  const chars = code.split("");
  const cellW = width / chars.length;
  const noises = Array.from({ length: 6 }, (_, i) => ({
    x1: randomInt(0, width), y1: randomInt(0, height),
    x2: randomInt(0, width), y2: randomInt(0, height),
    key: i,
  }));
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ userSelect: "none", display: "block" }}>
      <rect width={width} height={height} fill="#f8f8f6" rx="4" />
      {noises.map(n => (
        <line key={n.key} x1={n.x1} y1={n.y1} x2={n.x2} y2={n.y2}
          stroke={`hsl(${randomInt(20,50)},60%,50%)`} strokeWidth="1.2" opacity="0.5" />
      ))}
      {chars.map((ch, i) => {
        const x = cellW * i + cellW / 2 + randomInt(-3, 3);
        const y = height / 2 + randomInt(-4, 4);
        const rotate = randomInt(-22, 22);
        const size = randomInt(20, 28);
        const color = `hsl(${randomInt(20, 45)},80%,${randomInt(25, 45)}%)`;
        return (
          <text key={i} x={x} y={y} dominantBaseline="middle" textAnchor="middle"
            fontSize={size} fill={color} fontWeight="bold" fontFamily="Georgia, serif"
            transform={`rotate(${rotate},${x},${y})`} style={{ letterSpacing: 2 }}
          >{ch}</text>
        );
      })}
      {Array.from({ length: 40 }, (_, i) => (
        <circle key={i} cx={randomInt(0, width)} cy={randomInt(0, height)}
          r={randomInt(1, 2)} fill={`hsl(${randomInt(0, 360)},40%,50%)`} opacity="0.35" />
      ))}
    </svg>
  );
}

function useCaptcha() {
  const [code, setCode] = useState(() => generateCaptchaCode());
  const [tick, setTick] = useState(0);
  const refresh = useCallback(() => setCode(generateCaptchaCode()), []);
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 200);
    return () => clearInterval(id);
  }, []);
  return { code, tick, refresh };
}

/* ── Shared components ──────────────────────────────────────── */
function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="block text-sm font-medium text-white mb-1.5">
      {children} <span className="text-[#22d3ee]">*</span>
    </label>
  );
}

function FieldInput(props: React.InputHTMLAttributes<HTMLInputElement> & { "data-testid"?: string }) {
  return (
    <input
      {...props}
      className={`w-full h-10 bg-[#151515] border border-white/20 rounded-lg text-sm text-white px-3.5 outline-none focus:border-[#22d3ee] transition-colors placeholder:text-white/35 disabled:opacity-60 ${props.className ?? ""}`}
    />
  );
}

function PasswordInput({ value, onChange, placeholder, disabled, testId }: {
  value: string; onChange: (v: string) => void; placeholder?: string; disabled?: boolean; testId?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <FieldInput
        type={show ? "text" : "password"}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder || "password"}
        disabled={disabled}
        autoComplete="current-password"
        data-testid={testId}
      />
      <button
        type="button"
        onClick={() => setShow(s => !s)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-white/45 hover:text-[#22d3ee] transition-colors"
        tabIndex={-1}
      >
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}

function PrimaryButton({ children, disabled, type = "submit", onClick, className = "" }: {
  children: React.ReactNode; disabled?: boolean; type?: "submit" | "button"; onClick?: () => void; className?: string;
}) {
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={`w-full h-10 bg-[#22d3ee] hover:bg-[#67e8f9] disabled:opacity-50 disabled:cursor-not-allowed text-[#06252a] font-semibold text-sm rounded-lg transition-colors flex items-center justify-center gap-2 ${className}`}
    >
      {children}
    </button>
  );
}

/* ── Login form ─────────────────────────────────────────────── */
function LoginForm({ onSwitchToRegister, onSwitchToForgot }: {
  onSwitchToRegister: () => void;
  onSwitchToForgot: () => void;
}) {
  const { login, isLoggingIn } = useAuth();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [captchaInput, setCaptchaInput] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const { code: captchaCode, tick: captchaTick, refresh: refreshCaptcha } = useCaptcha();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) return;
    if (captchaInput.trim().toLowerCase() !== captchaCode.toLowerCase()) {
      toast({ title: "Verification failed", description: "Code doesn't match — try again", variant: "destructive" });
      refreshCaptcha();
      setCaptchaInput("");
      return;
    }
    try { await login({ email: email.trim().toLowerCase(), password }); } catch {}
  };

  return (
    <section>
      <h1 className="text-[1.55rem] sm:text-[1.7rem] leading-tight font-bold text-white text-center">
        Login to your account
      </h1>
      <p className="mt-2.5 text-center text-sm leading-relaxed text-white/55">
        Enter your email below to login to your account
      </p>
      <form onSubmit={handleSubmit} className="mt-5 space-y-3.5">
        <div>
          <FieldLabel>Email</FieldLabel>
          <FieldInput type="email" value={email} onChange={e => setEmail(e.target.value)}
            placeholder="Enter your email" disabled={isLoggingIn} autoComplete="email" data-testid="input-email" />
        </div>
        <div>
          <FieldLabel>Password</FieldLabel>
          <PasswordInput value={password} onChange={setPassword} placeholder="Enter your password" disabled={isLoggingIn} testId="input-password" />
        </div>

        <div className="flex items-center justify-between gap-3 pt-0.5">
          <label className="flex items-center gap-2 text-sm text-white/85 cursor-pointer">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={e => setRememberMe(e.target.checked)}
              className="h-4 w-4 appearance-none rounded border border-white/25 bg-[#151515] checked:bg-[#22d3ee] checked:border-[#22d3ee] relative checked:after:content-['✓'] checked:after:absolute checked:after:inset-0 checked:after:flex checked:after:items-center checked:after:justify-center checked:after:text-[10px] checked:after:text-black"
              data-testid="checkbox-remember-me"
            />
            Remember me
          </label>
          <button
            type="button"
            onClick={onSwitchToForgot}
            className="text-sm text-white/55 hover:text-[#22d3ee] transition-colors whitespace-nowrap"
          >
            Forgot password
          </button>
        </div>

        <div className="rounded-lg border border-white/25 bg-[#2a2a2a] px-2.5 py-2">
          <div className="flex items-center gap-2">
            <div className="rounded overflow-hidden border border-white/15 shrink-0">
              <CaptchaImage code={captchaCode} tick={captchaTick} width={84} height={32} />
            </div>
            <input
              type="text"
              value={captchaInput}
              onChange={e => setCaptchaInput(e.target.value)}
              placeholder="Verification code"
              disabled={isLoggingIn}
              autoComplete="off"
              className="min-w-0 flex-1 text-xs text-white bg-transparent outline-none placeholder:text-white/45 tracking-widest"
              data-testid="input-captcha"
            />
            <button type="button" onClick={() => { refreshCaptcha(); setCaptchaInput(""); }}
              className="text-white/45 hover:text-[#22d3ee] transition-colors shrink-0" data-testid="btn-refresh-captcha">
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
          </div>
          <p className="mt-1.5 text-[10px] text-white/45">Complete the verification to continue</p>
        </div>

        <PrimaryButton disabled={isLoggingIn || !email.trim() || !password || !captchaInput.trim()} data-testid="btn-login">
          {isLoggingIn ? <Loader2 className="h-4 w-4 animate-spin" /> : "Login"}
        </PrimaryButton>
      </form>

      <div className="mt-5 text-center">
        <p className="text-sm text-white/60">
          Don't have an account?{" "}
          <button onClick={onSwitchToRegister} className="text-white hover:text-[#22d3ee] transition-colors font-medium">Sign up</button>
        </p>
      </div>
    </section>
  );
}

/* ── Register form ──────────────────────────────────────────── */
function RegisterForm({ onSwitchToLogin }: { onSwitchToLogin: () => void }) {
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) { toast({ title: "Passwords don't match", variant: "destructive" }); return; }
    if (password.length < 12) { toast({ title: "Password too short", description: "At least 12 characters", variant: "destructive" }); return; }
    setSubmitting(true);
    try {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast({ title: "Registration failed", description: err.message || "Try again", variant: "destructive" });
        return;
      }
      setDone(true);
    } catch {
      toast({ title: "Registration failed", description: "Try again", variant: "destructive" });
    } finally { setSubmitting(false); }
  };

  if (done) {
    return (
      <section>
        <h1 className="text-[1.55rem] sm:text-[1.7rem] leading-tight font-bold text-white text-center">Account created</h1>
        <div className="text-center space-y-3 py-3">
          <div className="text-3xl text-[#22d3ee]">✓</div>
          <p className="text-sm font-bold text-white">Account created!</p>
          <p className="text-sm text-white/50 leading-relaxed">Sign in with your email and password.</p>
          <PrimaryButton type="button" onClick={onSwitchToLogin} data-testid="btn-go-login">Sign In</PrimaryButton>
        </div>
      </section>
    );
  }

  return (
    <section>
      <h1 className="text-[1.55rem] sm:text-[1.7rem] leading-tight font-bold text-white text-center">
        Create your account
      </h1>
      <p className="mt-2.5 text-center text-sm leading-relaxed text-white/55">
        Enter your email below to create your account
      </p>
      <form onSubmit={handleCreate} className="mt-5 space-y-3.5">
        <div>
          <FieldLabel>Email</FieldLabel>
          <FieldInput type="email" value={email} onChange={e => setEmail(e.target.value)}
            placeholder="Enter your email" disabled={submitting} autoComplete="email" data-testid="input-reg-email" />
        </div>
        <div>
          <FieldLabel>Password</FieldLabel>
          <PasswordInput value={password} onChange={setPassword} placeholder="Enter your password" disabled={submitting} testId="input-reg-password" />
        </div>
        <div>
          <FieldLabel>Confirm Password</FieldLabel>
          <PasswordInput value={confirm} onChange={setConfirm} placeholder="Confirm your password" disabled={submitting} testId="input-reg-confirm" />
        </div>

        <PrimaryButton disabled={submitting || !email.trim() || !password || !confirm} data-testid="btn-register">
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Signup"}
        </PrimaryButton>
      </form>

      <div className="mt-5 text-center">
        <p className="text-sm text-white/60">
          Already have an account?{" "}
          <button onClick={onSwitchToLogin} className="text-white hover:text-[#22d3ee] transition-colors font-medium">Login</button>
        </p>
      </div>
    </section>
  );
}

/* ── Password recovery page ─────────────────────────────────── */
function ForgotPasswordForm({ onSwitchToLogin }: { onSwitchToLogin: () => void }) {
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!email.trim()) return;
    setSubmitted(true);
    toast({
      title: "Recovery request noted",
      description: "Contact support using the link below to reset your password.",
    });
  };

  return (
    <section>
      <h1 className="text-[1.55rem] sm:text-[1.7rem] leading-tight font-bold text-white text-center">
        Forgot your password?
      </h1>
      <p className="mt-2.5 text-center text-sm leading-relaxed text-white/55">
        Enter your account email and we’ll help you regain access.
      </p>

      {!submitted ? (
        <form onSubmit={handleSubmit} className="mt-5 space-y-3.5">
          <div>
            <FieldLabel>Email</FieldLabel>
            <FieldInput
              type="email"
              value={email}
              onChange={event => setEmail(event.target.value)}
              placeholder="Enter your email"
              autoComplete="email"
              required
              data-testid="input-forgot-email"
            />
          </div>
          <PrimaryButton disabled={!email.trim()} data-testid="btn-forgot-password">
            Request password help
          </PrimaryButton>
        </form>
      ) : (
        <div className="mt-5 rounded-lg border border-[#22d3ee]/25 bg-[#22d3ee]/5 p-3.5 text-center">
          <p className="text-sm font-medium text-white">Request received</p>
          <p className="mt-1.5 text-xs leading-relaxed text-white/55">
            Contact support on Telegram and include <span className="text-[#22d3ee]">{email.trim()}</span> so your password can be reset.
          </p>
          <a
            href="https://t.me/+3-lMkt-idutkOTIx"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex h-9 items-center justify-center rounded-lg bg-[#22d3ee] px-4 text-sm font-semibold text-[#06252a] hover:bg-[#67e8f9] transition-colors"
            data-testid="link-forgot-support"
          >
            Contact support
          </a>
        </div>
      )}

      <div className="mt-5 text-center">
        <button onClick={onSwitchToLogin} className="text-sm text-white/60 hover:text-[#22d3ee] transition-colors">
          ← Back to login
        </button>
      </div>
    </section>
  );
}

/* ── Footer ─────────────────────────────────────────────────── */
function AuthFooter() {
  return (
    <footer className="w-full max-w-[360px] mx-auto px-5 pt-7 pb-5 text-center">
      <div className="flex items-center justify-center gap-2 text-[11px] text-white/25">
        <span>Privacy Policy</span>
        <span>•</span>
        <span>Terms of Service</span>
        <span>•</span>
        <span>Status</span>
      </div>
      <p className="mt-2 text-[10px] text-white/15">© 2026 TurtleCC. All rights reserved</p>
    </footer>
  );
}

/* ── Main page ──────────────────────────────────────────────── */
export default function AuthPage() {
  const { user } = useAuth();
  const [location, setLocation] = useLocation();
  const [tab, setTab] = useState<"login" | "register" | "forgot">(
    location === "/forgot-password" ? "forgot" : "login",
  );

  if (user) return <Redirect to="/" />;

  return (
    <div className="min-h-[100dvh] flex flex-col bg-[#080808] text-white">
      <main className="flex-1 w-full max-w-[360px] mx-auto px-5 pt-8 sm:pt-10">
        <div className="flex flex-col items-center mb-6" aria-label="TurtleCC">
          <div className="flex h-10 w-10 items-center justify-center rounded-full border border-[#22d3ee]/50 bg-[#121212] shadow-[0_0_22px_rgba(34,211,238,0.16)]">
            <Turtle className="h-5 w-5 text-[#22d3ee]" strokeWidth={1.6} />
          </div>
          <div className="mt-2 text-base font-semibold tracking-tight text-white">TurtleCC</div>
        </div>
        {tab === "login"
          ? (
            <LoginForm
              onSwitchToRegister={() => setTab("register")}
              onSwitchToForgot={() => { setTab("forgot"); setLocation("/forgot-password"); }}
            />
          )
          : tab === "register"
            ? <RegisterForm onSwitchToLogin={() => { setTab("login"); setLocation("/auth"); }} />
            : <ForgotPasswordForm onSwitchToLogin={() => { setTab("login"); setLocation("/auth"); }} />
        }
      </main>
      <AuthFooter />
    </div>
  );
}
