"use client";

import useSWR from "swr";

export type SessionUser = { id: number; email: string; name: string; role: "ADMIN" | "MANAGEMENT" | "PROCUREMENT" | "COMMERCIAL" | "FINANCE" | "VIEWER" };

const fetcher = (url: string) => fetch(url).then((r) => (r.ok ? r.json() : null));

export function useSession(): { session: SessionUser | null; isLoading: boolean } {
  const { data, isLoading } = useSWR<{ id: number; email: string; name: string; role: SessionUser["role"] }>(
    "/api/v1/auth/me",
    fetcher,
    { revalidateOnFocus: false },
  );
  return { session: data ?? null, isLoading };
}

export type Project = {
  id: number;
  code: string;
  name: string;
  status: string;
};

export function useProjects() {
  const { data, isLoading } = useSWR<{ items: Project[] }>("/api/v1/projects", fetcher);
  return { projects: data?.items ?? [], isLoading };
}

/** Project context persisted in the URL (?project=CODE), defaulting to first ACTIVE project. */
export function useProjectContext(): {
  code: string | null;
  setCode: (c: string) => void;
  projects: Project[];
} {
  const { projects } = useProjects();
  const params = new URLSearchParams(typeof window === "undefined" ? "" : window.location.search);
  const fromUrl = params.get("project");
  const fallback = projects.find((p) => p.status === "ACTIVE") ?? projects[0];
  const code = fromUrl ?? fallback?.code ?? null;

  return {
    code,
    projects,
    setCode: (c) => {
      const url = new URL(window.location.href);
      url.searchParams.set("project", c);
      window.history.replaceState(null, "", url.toString());
      // Revalidate dependent hooks on next render tick.
      window.dispatchEvent(new PopStateEvent("popstate"));
    },
  };
}
