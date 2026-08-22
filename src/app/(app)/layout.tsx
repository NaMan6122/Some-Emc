import { AppShell } from "@/components/shell/AppShell";

// spec-009-v1: every authenticated page renders inside the app shell.
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
