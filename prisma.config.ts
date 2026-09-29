// Proje genelinde .env değil .env.local kullanılıyor (Next.js'in kendi konvansiyonu,
// bkz. CLAUDE.md) — Prisma CLI'nin varsayılan dotenv yüklemesi bunu geçersiz kılıyor.
import { config } from "dotenv";
import { defineConfig } from "prisma/config";

config({ path: ".env.local" });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // Neon'un pooler (PgBouncer) ucu migration/DDL için sorun çıkarabiliyor —
    // Prisma CLI (migrate/studio) her zaman DIRECT (havuzsuz) bağlantıyı kullanmalı.
    // Uygulamanın kendisi (src/lib/prisma.ts) hâlâ havuzlu DATABASE_URL'i kullanıyor.
    url: process.env["DATABASE_URL_UNPOOLED"],
  },
});
