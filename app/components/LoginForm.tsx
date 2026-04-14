"use client";

import { useState } from "react";
import { useAuth } from "@/app/hooks/useAuth";

export function LoginForm() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setInfo("");
    setLoading(true);

    try {
      if (mode === "signin") {
        const { error } = await signIn(email, password);
        if (error) throw error;
      } else {
        const { error } = await signUp(email, password);
        if (error) throw error;
        setInfo("確認メールを送信しました。メールのリンクをクリックしてアカウントを有効化してください。");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("Invalid login credentials")) {
        setError("メールアドレスまたはパスワードが正しくありません。");
      } else if (msg.includes("User already registered")) {
        setError("このメールアドレスはすでに登録済みです。");
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF8FC] flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-[#634B99] rounded-2xl mb-4 shadow-lg">
            <svg width="44" height="44" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
              <path d="M 28,20 L 72,20 C 78,50 62,65 54,65 L 54,80 L 62,80 L 62,84 L 38,84 L 38,80 L 46,80 L 46,65 C 38,65 22,50 28,20 Z"
                fill="white" opacity="0.92" />
              <path d="M 30,35 L 70,35 C 74,50 60,63 54,65 L 46,65 C 40,63 26,50 30,35 Z"
                fill="#C9A96E" opacity="0.85" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-[#1E0F38]">Wine Cellar</h1>
          <p className="text-[#8E75B8] text-sm mt-1">マイワインコレクション</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-[#E8E2F4] p-6">
          {/* Tab */}
          <div className="flex rounded-xl bg-[#E8E2F4] p-1 mb-5">
            {(["signin", "signup"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => { setMode(m); setError(""); setInfo(""); }}
                className={`flex-1 py-1.5 rounded-lg text-sm font-medium transition ${
                  mode === m
                    ? "bg-white text-[#1E0F38] shadow-sm"
                    : "text-[#8E75B8] hover:text-[#634B99]"
                }`}
              >
                {m === "signin" ? "ログイン" : "新規登録"}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[#634B99] mb-1.5 uppercase tracking-wide">
                メールアドレス
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl border-2 border-[#E8E2F4] px-3 py-2.5 text-sm text-[#1E0F38] placeholder:text-[#CABFE3] focus:outline-none focus:border-[#8E75B8] transition-colors"
                placeholder="example@email.com"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#634B99] mb-1.5 uppercase tracking-wide">
                パスワード
              </label>
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl border-2 border-[#E8E2F4] px-3 py-2.5 text-sm text-[#1E0F38] placeholder:text-[#CABFE3] focus:outline-none focus:border-[#8E75B8] transition-colors"
                placeholder={mode === "signup" ? "6文字以上" : "••••••••"}
              />
            </div>

            {error && (
              <p className="text-sm text-red-600 bg-red-50 rounded-xl px-3 py-2">
                {error}
              </p>
            )}
            {info && (
              <p className="text-sm text-emerald-700 bg-emerald-50 rounded-xl px-3 py-2">
                {info}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-2xl bg-[#634B99] text-white text-sm font-semibold shadow-[0_4px_16px_rgba(99,75,153,0.3)] hover:bg-[#1E0F38] transition disabled:opacity-50"
            >
              {loading ? "処理中..." : mode === "signin" ? "ログイン" : "アカウントを作成"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
