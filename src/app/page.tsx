"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { FormEvent, useLayoutEffect, useRef, useState } from "react";
import { useLogin } from "@/hooks/useLogin";
import { dmSans, notoMalayalam, sora } from "@/lib/auth-fonts";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";


type Language = "en" | "ml";

/** Support WhatsApp number (+91 7994436444), opened from the "Chat with us" link. */
const WHATSAPP_URL = "https://wa.me/917994436444";

const COPY = {
  en: {
    headline: ["Namaskaram!", "Welcome to Ogera."],
    lede: "Every lead — from WhatsApp, calls, Instagram or walk-ins — saved in one clean list. Get a reminder for every follow-up, at every stage. Never forget a customer again.",
    pills: ["Every lead source", "Every follow-up", "Every stage"],
    copyright: "© 2026 Ogera Ventures Pvt. Ltd. · Made in Kerala",
    logoAlt: "Ogera logo",
    title: "Welcome back!",
    emailLabel: "Email address",
    passwordLabel: "Password",
    passwordPlaceholder: "Enter your password",
    showPassword: "Show password",
    hidePassword: "Hide password",
    offline: "You’re offline. Reconnect to sign in.",
    missingFields: "Enter your email and password to continue.",
    login: "Login",
    signingIn: "Signing in...",
    redirecting: "Redirecting...",
    tryAgain: "Try again",
    forgotPrefix: "Forgot password?",
    resetLink: "Reset here",
    helpPrefix: "Need help?",
    whatsappLink: "Chat with us on WhatsApp",
  },
  ml: {
    headline: ["നമസ്കാരം!", "ഒഗേരയിലേക്ക് സ്വാഗതം."],
    lede: "വാട്സ്ആപ്പ്, കോളുകൾ, ഇൻസ്റ്റാഗ്രാം, നേരിട്ടുള്ള സന്ദർശനങ്ങൾ — എല്ലാ ലീഡുകളും ഒറ്റ വൃത്തിയുള്ള പട്ടികയിൽ. ഓരോ ഫോളോ-അപ്പിനും, ഓരോ ഘട്ടത്തിലും ഓർമ്മപ്പെടുത്തൽ. ഒരു ഉപഭോക്താവിനെയും ഇനി മറക്കരുത്.",
    pills: ["എല്ലാ ലീഡ് ഉറവിടങ്ങളും", "എല്ലാ ഫോളോ-അപ്പും", "എല്ലാ ഘട്ടവും"],
    copyright: "© 2026 ഒഗേര വെഞ്ചേഴ്സ് പ്രൈവറ്റ് ലിമിറ്റഡ് · കേരളത്തിൽ നിർമ്മിച്ചത്",
    logoAlt: "ഒഗേര ലോഗോ",
    title: "സ്വാഗതം!",
    emailLabel: "ഇമെയിൽ വിലാസം",
    passwordLabel: "പാസ്‌വേഡ്",
    passwordPlaceholder: "പാസ്‌വേഡ് നൽകുക",
    showPassword: "പാസ്‌വേഡ് കാണിക്കുക",
    hidePassword: "പാസ്‌വേഡ് മറയ്ക്കുക",
    offline: "നിങ്ങൾ ഓഫ്‌ലൈനിലാണ്. സൈൻ ഇൻ ചെയ്യാൻ വീണ്ടും കണക്ട് ചെയ്യുക.",
    missingFields: "തുടരാൻ ഇമെയിലും പാസ്‌വേഡും നൽകുക.",
    login: "ലോഗിൻ",
    signingIn: "സൈൻ ഇൻ ചെയ്യുന്നു...",
    redirecting: "തിരിച്ചുവിടുന്നു...",
    tryAgain: "വീണ്ടും ശ്രമിക്കുക",
    forgotPrefix: "പാസ്‌വേഡ് മറന്നോ?",
    resetLink: "ഇവിടെ പുനഃസജ്ജമാക്കുക",
    helpPrefix: "സഹായം വേണോ?",
    whatsappLink: "വാട്സ്ആപ്പിൽ ഞങ്ങളുമായി സംസാരിക്കുക",
  },
} satisfies Record<Language, unknown>;

export default function Home() {
  const router = useRouter();
  const isOnline = useOnlineStatus();
  const { state, submit, reset } = useLogin();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [language, setLanguage] = useState<Language>("en");
  const [validationMessage, setValidationMessage] = useState("");

  const brandRef = useRef<HTMLElement>(null);
  const sideRef = useRef<HTMLElement>(null);

  // Line the left column's top with the right card's top ("Ogera CRM" row), so both start at the same height.
  useLayoutEffect(() => {
    const brand = brandRef.current;
    const side = sideRef.current;
    if (!brand || !side) return;
    const sync = () => {
      const topbar = side.querySelector<HTMLElement>(".login-topbar");
      if (!topbar || window.matchMedia("(max-width: 900px)").matches) {
        brand.style.removeProperty("--brand-top");
        return;
      }
      const offset = topbar.getBoundingClientRect().top - brand.getBoundingClientRect().top;
      brand.style.setProperty("--brand-top", `${offset}px`);
    };
    sync();
    const observer = new ResizeObserver(sync);
    observer.observe(side);
    observer.observe(brand);
    const card = side.querySelector(".login-card");
    if (card) observer.observe(card);
    window.addEventListener("resize", sync);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", sync);
    };
  }, []);

  const t = COPY[language];
  const isSubmitting = state.status === "loading" || state.status === "success";
  const apiError = state.status === "error" ? state.error : null;
  const message = validationMessage || apiError?.message || "";

  function clearErrors() {
    setValidationMessage("");
    if (state.status === "error") reset();
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) return;
    if (!email.trim() || !password) {
      setValidationMessage(t.missingFields);
      return;
    }
    setValidationMessage("");
    if (await submit(email, password)) router.push("/dashboard");
  }

  return (
    <main
      className={`login-page ${sora.variable} ${dmSans.variable} ${notoMalayalam.variable}${language === "ml" ? " is-ml" : ""}`}
      lang={language}
      aria-labelledby="login-title"
    >
      <section className="login-brand" ref={brandRef}>
        <svg className="login-art" aria-hidden="true" viewBox="0 0 800 900" preserveAspectRatio="xMinYMid slice" fill="none" stroke="#FFFFFF" strokeOpacity="0.1" strokeWidth="1.2">
          <path d="M-120 900 C 40 520, 220 260, 330 80" />
          <path d="M-80 900 C 90 540, 290 300, 400 120" />
          <path d="M-40 900 C 140 560, 360 340, 470 160" />
          <path d="M0 900 C 190 580, 430 380, 540 200" />
          <path d="M40 900 C 240 600, 500 420, 610 240" />
          <path d="M80 900 C 290 620, 570 460, 680 280" />
        </svg>

        <div className="login-brand-inner">
          <div className="login-logo-chip">
            <Image src="/images/ogera-login-logo.png" alt={t.logoAlt} width={108} height={82} priority />
          </div>

          <div className="login-headline-block">
            <h1 className="login-headline">
              {t.headline[0]}
              <br />
              {t.headline[1]}
            </h1>
            <p lang="ml" className="login-malayalam">ഒരു ലീഡും ഇനി മിസ്സാകില്ല.</p>
            <p className="login-lede">{t.lede}</p>
          </div>

        </div>

        <div className="login-brand-bottom">
          <div className="login-pills">
            {t.pills.map((label) => (
              <div className="login-pill" key={label}>
                <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5" /></svg>
                {label}
              </div>
            ))}
          </div>

          <p className="login-copyright">{t.copyright}</p>
        </div>
      </section>

      <section className="login-side" ref={sideRef}>
        <div className="login-card">
          <div className="login-topbar">
            <div className="login-brandname">Ogera CRM</div>
            <div className="login-lang" role="group" aria-label="Language">
              <button type="button" onClick={() => setLanguage("en")} aria-pressed={language === "en"}>English</button>
              <button type="button" lang="ml" onClick={() => setLanguage("ml")} aria-pressed={language === "ml"}>മലയാളം</button>
            </div>
          </div>

          <form className="login-form" onSubmit={handleSubmit} noValidate>
            <h2 id="login-title" className="login-form-title">{t.title}</h2>

            <div className="login-field">
              <label htmlFor="email">{t.emailLabel}</label>
              <input
                id="email"
                name="email"
                className="login-input"
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="you@shop.com"
                value={email}
                onChange={(event) => { setEmail(event.target.value); clearErrors(); }}
                aria-describedby={message ? "login-message" : undefined}
              />
            </div>

            <div className="login-field">
              <label htmlFor="password">{t.passwordLabel}</label>
              <div className="login-input-row">
                <input
                  id="password"
                  name="password"
                  className="login-input has-toggle"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder={t.passwordPlaceholder}
                  value={password}
                  onChange={(event) => { setPassword(event.target.value); clearErrors(); }}
                  aria-describedby={message ? "login-message" : undefined}
                />
                <button className="login-eye" type="button" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? t.hidePassword : t.showPassword}>
                  <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    {showPassword ? (
                      <>
                        <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
                        <circle cx="12" cy="12" r="3" />
                      </>
                    ) : (
                      <>
                        <path d="M3 3 21 21" />
                        <path d="M10.6 6.6A10.4 10.4 0 0 1 12 6.5c6.2 0 9.5 5.5 9.5 5.5a18.5 18.5 0 0 1-3 3.55M6.25 6.25A18.6 18.6 0 0 0 2.5 12S5.8 17.5 12 17.5c1.26 0 2.37-.23 3.34-.6" />
                        <path d="M9.75 9.75a3.1 3.1 0 0 0 4.5 4.5" />
                      </>
                    )}
                  </svg>
                </button>
              </div>
            </div>

            {!isOnline && (
              <p className="login-message login-message-warn" role="status">
                {t.offline}
              </p>
            )}

            {message && <p id="login-message" className="login-message" role="alert">{message}</p>}

            <button className="login-submit" type="submit" disabled={isSubmitting || !isOnline} aria-busy={state.status === "loading"}>
              {state.status === "loading" ? t.signingIn : state.status === "success" ? t.redirecting : apiError?.retryable ? t.tryAgain : t.login}
            </button>

            <div className="login-links">
              <p>{t.forgotPrefix} <Link href="/forgot-password">{t.resetLink}</Link></p>
              <p>{t.helpPrefix} <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer">{t.whatsappLink}</a></p>
            </div>
          </form>
        </div>
      </section>
    </main>
  );
}
