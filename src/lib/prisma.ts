import "server-only";
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "@/generated/prisma/client";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL tanımlı değil.");

// Prisma 7 artık bağlantıyı schema'daki url'den değil, açıkça verilen bir "driver
// adapter"dan alıyor — Vercel Postgres Neon tabanlı olduğu için @prisma/adapter-neon
// (WebSocket/HTTP tabanlı, serverless ortamlarda bağlantı havuzu tükenmesi sorunu
// yaşamıyor) kullanılıyor, ham `pg` sürücüsü değil.
const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL });

// Next.js dev modunda hot-reload her dosya değişikliğinde modülü yeniden çalıştırır —
// globalThis'e önbelleklemeden her seferinde yeni bir PrismaClient (ve yeni bir DB
// bağlantı havuzu) açılır, bağlantı limitini hızla tüketir. Standart Prisma+Next.js pratiği.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
