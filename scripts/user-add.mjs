#!/usr/bin/env node
// spec-003-v2: admin user creation script.
// Usage: npm run user:add -- <email> <name> <ROLE> [password]
// If password omitted, a random one is generated and printed ONCE.

import { randomBytes } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { hash } from "@node-rs/argon2";

const ROLES = ["ADMIN", "MANAGEMENT", "PROCUREMENT", "COMMERCIAL", "FINANCE", "VIEWER"];

const [email, name, role, password] = process.argv.slice(2);

if (!email || !name || !role) {
  console.error("Usage: npm run user:add -- <email> <name> <ROLE> [password]");
  process.exit(1);
}
if (!ROLES.includes(role)) {
  console.error(`Invalid role "${role}". Valid roles: ${ROLES.join(", ")}`);
  process.exit(1);
}
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  console.error("Invalid email address.");
  process.exit(1);
}

const pw = password ?? randomBytes(12).toString("base64url");
if (pw.length < 10) {
  console.error("Password must be at least 10 characters.");
  process.exit(1);
}

const prisma = new PrismaClient();
try {
  const passwordHash = await hash(pw);
  const user = await prisma.user.upsert({
    where: { email: email.trim().toLowerCase() },
    update: { name, role, passwordHash },
    create: { email: email.trim().toLowerCase(), name, role, passwordHash },
  });
  console.log(`User upserted: #${user.id} ${user.email} (${user.role})`);
  if (!password) {
    console.log(`Generated password (store it now — shown only once): ${pw}`);
  }
} finally {
  await prisma.$disconnect();
}
