"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

export function LoginForm() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const result = await signIn("credentials", {
      username,
      password,
      redirect: false,
    });

    setLoading(false);

    if (result?.error) {
      setError("用户名或密码错误");
    } else {
      router.push("/projects");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {error && (
        <div className="error-state">
          {error}
        </div>
      )}
      <div>
        <label htmlFor="username" className="block mb-1" style={{ fontSize: 13, fontWeight: 500 }}>
          用户名
        </label>
        <input
          id="username"
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
          className="w-full px-3 py-2 rounded-md border"
          style={{
            background: "var(--bg)",
            border: "1px solid var(--border)",
            color: "var(--text-primary)",
            borderRadius: "var(--radius-md)",
          }}
          placeholder="输入用户名"
        />
      </div>
      <div>
        <label htmlFor="password" className="block mb-1" style={{ fontSize: 13, fontWeight: 500 }}>
          密码
        </label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          className="w-full px-3 py-2 rounded-md border"
          style={{
            background: "var(--bg)",
            border: "1px solid var(--border)",
            color: "var(--text-primary)",
            borderRadius: "var(--radius-md)",
          }}
          placeholder="输入密码"
        />
      </div>
      <button
        type="submit"
        disabled={loading}
        className="w-full py-2.5 rounded-md font-medium transition-colors disabled:opacity-50"
        style={{
          background: "var(--accent)",
          color: "#FFFFFF",
          borderRadius: "var(--radius-md)",
        }}
      >
        {loading ? "登录中..." : "登录"}
      </button>
    </form>
  );
}
