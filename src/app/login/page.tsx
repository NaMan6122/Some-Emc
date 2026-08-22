import { LoginForm } from "./LoginForm";

// spec-003-v2: minimal login screen styled from design.md tokens.
export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-50 px-4">
      <div className="w-full max-w-sm rounded-xl border border-zinc-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">ProCare</h1>
        <p className="mt-1 mb-6 text-sm text-zinc-500">Sign in to continue</p>
        <LoginForm />
      </div>
    </main>
  );
}
