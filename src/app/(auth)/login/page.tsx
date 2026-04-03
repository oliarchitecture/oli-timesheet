"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, Loader2 } from "lucide-react";

type Tab = "login" | "register";

export default function LoginPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("login");

  // Login state
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);

  // Register state
  const [name, setName] = useState("");
  const [registerEmail, setRegisterEmail] = useState("");
  const [registerPassword, setRegisterPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);
  const [registerError, setRegisterError] = useState("");
  const [registerSuccess, setRegisterSuccess] = useState(false);
  const [registerLoading, setRegisterLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoginError("");
    setLoginLoading(true);

    try {
      const result = await signIn("credentials", {
        email: loginEmail,
        password: loginPassword,
        redirect: false,
      });

      if (result?.error) {
        setLoginError("Invalid email or password. Please try again.");
      } else {
        router.push("/dashboard");
        router.refresh();
      }
    } catch {
      setLoginError("Something went wrong. Please try again.");
    } finally {
      setLoginLoading(false);
    }
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setRegisterError("");

    if (registerPassword !== confirmPassword) {
      setRegisterError("Passwords do not match.");
      return;
    }

    if (registerPassword.length < 8) {
      setRegisterError("Password must be at least 8 characters.");
      return;
    }

    setRegisterLoading(true);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email: registerEmail, password: registerPassword }),
      });

      const data = await res.json();

      if (!res.ok) {
        setRegisterError(data.error || "Something went wrong. Please try again.");
      } else {
        setRegisterSuccess(true);
      }
    } catch {
      setRegisterError("Something went wrong. Please try again.");
    } finally {
      setRegisterLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-neutral-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo / Brand */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="OLI Architecture" style={{ width: 180, height: "auto" }} />
          </div>
          <p className="text-sm text-neutral-500 mt-1">Employee Portal</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-xl border border-neutral-200 shadow-sm">
          {/* Tabs */}
          <div className="flex border-b border-neutral-200">
            <button
              className={`flex-1 py-3 text-sm font-medium transition-colors ${
                tab === "login"
                  ? "text-primary-600 border-b-2 border-primary-500 -mb-px"
                  : "text-neutral-500 hover:text-neutral-700"
              }`}
              onClick={() => { setTab("login"); setLoginError(""); }}
            >
              Log In
            </button>
            <button
              className={`flex-1 py-3 text-sm font-medium transition-colors ${
                tab === "register"
                  ? "text-primary-600 border-b-2 border-primary-500 -mb-px"
                  : "text-neutral-500 hover:text-neutral-700"
              }`}
              onClick={() => { setTab("register"); setRegisterError(""); setRegisterSuccess(false); }}
            >
              Create Account
            </button>
          </div>

          <div className="p-8">
            {/* Login Form */}
            {tab === "login" && (
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@oliarch.com"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    required
                    autoComplete="email"
                    autoFocus
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password">Password</Label>
                    <button
                      type="button"
                      className="text-xs text-primary-600 hover:text-primary-700 hover:underline"
                      onClick={() => alert("Please contact your administrator to reset your password.")}
                    >
                      Forgot Password?
                    </button>
                  </div>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showLoginPassword ? "text" : "password"}
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      required
                      autoComplete="current-password"
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowLoginPassword(!showLoginPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
                    >
                      {showLoginPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {loginError && (
                  <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
                    {loginError}
                  </p>
                )}

                <Button type="submit" className="w-full" disabled={loginLoading}>
                  {loginLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                  {loginLoading ? "Logging in..." : "Log In"}
                </Button>
              </form>
            )}

            {/* Register Form */}
            {tab === "register" && (
              <>
                {registerSuccess ? (
                  <div className="text-center space-y-4">
                    <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-green-100 text-green-600 text-xl mb-2">
                      ✓
                    </div>
                    <h3 className="font-semibold text-neutral-800">Account Created!</h3>
                    <p className="text-sm text-neutral-500">
                      Your account has been created successfully. You can now log in.
                    </p>
                    <Button className="w-full" onClick={() => { setTab("login"); setRegisterSuccess(false); }}>
                      Go to Log In
                    </Button>
                  </div>
                ) : (
                  <form onSubmit={handleRegister} className="space-y-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="name">Full Name</Label>
                      <Input
                        id="name"
                        type="text"
                        placeholder="Your full name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        required
                        autoFocus
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="register-email">Email</Label>
                      <Input
                        id="register-email"
                        type="email"
                        placeholder="you@oliarch.com"
                        value={registerEmail}
                        onChange={(e) => setRegisterEmail(e.target.value)}
                        required
                        autoComplete="email"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="register-password">Password</Label>
                      <div className="relative">
                        <Input
                          id="register-password"
                          type={showRegisterPassword ? "text" : "password"}
                          placeholder="Min. 8 characters"
                          value={registerPassword}
                          onChange={(e) => setRegisterPassword(e.target.value)}
                          required
                          autoComplete="new-password"
                          className="pr-10"
                        />
                        <button
                          type="button"
                          onClick={() => setShowRegisterPassword(!showRegisterPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
                        >
                          {showRegisterPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="confirm-password">Confirm Password</Label>
                      <Input
                        id="confirm-password"
                        type="password"
                        placeholder="Re-enter your password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        required
                        autoComplete="new-password"
                      />
                    </div>

                    {registerError && (
                      <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
                        {registerError}
                      </p>
                    )}

                    <Button type="submit" className="w-full" disabled={registerLoading}>
                      {registerLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                      {registerLoading ? "Creating account..." : "Create Account"}
                    </Button>
                  </form>
                )}
              </>
            )}
          </div>
        </div>

        <p className="text-center text-xs text-neutral-400 mt-6">
          © 2026 OLI Architecture. All rights reserved.
        </p>
      </div>
    </div>
  );
}
