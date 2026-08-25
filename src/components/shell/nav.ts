import type { Role } from "@prisma/client";

// spec-009-v1: role-aware navigation config (pure — unit tested).

export type NavItem = { label: string; href: string; roles: Role[] | "all" };
export type NavGroup = { group: string; items: NavItem[] };

const ALL: Role[] = ["ADMIN", "MANAGEMENT", "PROCUREMENT", "COMMERCIAL", "FINANCE", "VIEWER"];

export const NAV_GROUPS: NavGroup[] = [
  {
    group: "Analytics",
    items: [
      { label: "Overview", href: "/overview", roles: ALL },
      { label: "Budget vs Actual", href: "/budget", roles: ALL },
      { label: "Payment Certificates", href: "/payment-certificates", roles: ALL },
      { label: "Investment", href: "/investment", roles: ALL },
      { label: "Vendors & LPO Log", href: "/vendors", roles: ALL },
      { label: "Cost Control", href: "/cost-control", roles: ALL },
      { label: "Printable Report", href: "/report", roles: ALL },
    ],
  },
  {
    group: "Governance",
    items: [{ label: "Data Flags", href: "/flags", roles: ALL }],
  },
  {
    group: "Cost Control",
    items: [
      { label: "Labour", href: "/costs?category=LABOUR_INHOUSE", roles: ALL },
      { label: "Supervision", href: "/costs?category=SUPERVISION", roles: ALL },
      { label: "Admin Cost", href: "/costs?category=ADMIN", roles: ALL },
      { label: "DLP", href: "/costs?category=DLP", roles: ALL },
    ],
  },
  {
    group: "Administration",
    items: [
      { label: "Projects", href: "/admin/projects", roles: ["ADMIN"] },
      { label: "Suppliers", href: "/admin/suppliers", roles: ["ADMIN"] },
      { label: "Users", href: "/admin/users", roles: ["ADMIN"] },
      { label: "Audit Log", href: "/audit", roles: ["ADMIN"] },
    ],
  },
];

export function filterNav(role: Role | null): NavGroup[] {
  if (!role) return [];
  return NAV_GROUPS.map((g) => ({
    ...g,
    items: g.items.filter((i) => i.roles === "all" || i.roles.includes(role)),
  })).filter((g) => g.items.length > 0);
}

export function canAccess(role: Role | null, href: string): boolean {
  if (!role) return false;
  return NAV_GROUPS.some((g) =>
    g.items.some((i) => (href === i.href || href.startsWith(i.href + "/")) && (i.roles === "all" || i.roles.includes(role))),
  );
}
