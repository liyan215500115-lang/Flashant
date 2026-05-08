import { LoginForm } from "./LoginForm";

export default function LoginPage() {
  return (
    <main className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg)" }}>
      <div
        className="w-full max-w-sm p-8 rounded-lg shadow-sm"
        style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
      >
        <h1 className="mb-8 text-center" style={{ fontSize: 24 }}>AI 视频工厂</h1>
        <LoginForm />
      </div>
    </main>
  );
}
