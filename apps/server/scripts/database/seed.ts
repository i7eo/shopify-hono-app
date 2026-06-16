import { files, users } from "@shamt/database";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

const SEED_SHOP_DOMAIN = "seed-shop.myshopify.com";
const SEED_FILE_ID = "seed-file-00000000-0000-4000-8000-000000000001";

async function main() {
  const databaseUrl = getDatabaseUrl();
  const pool = new Pool({ connectionString: databaseUrl });
  const db = drizzle({
    client: pool,
    schema: {
      files,
      users,
    },
  });

  try {
    const [existingUser] = await db
      .select({
        email: users.email,
        id: users.id,
        name: users.name,
      })
      .from(users)
      .where(eq(users.email, "seed@example.com"))
      .limit(1);
    const user =
      existingUser ??
      (
        await db
          .insert(users)
          .values({
            email: "seed@example.com",
            name: "Seed User",
          })
          .returning({
            email: users.email,
            id: users.id,
            name: users.name,
          })
      )[0];

    const now = new Date();
    const [file] = await db
      .insert(files)
      .values({
        bucketKey: `${SEED_SHOP_DOMAIN}/2026/06/${SEED_FILE_ID}/seed.csv`,
        bucketProvider: "memory",
        byteSize: 128,
        contentType: "text/csv",
        createdAt: now,
        expiresAt: new Date(now.getTime() + 1000 * 60 * 60 * 24),
        id: SEED_FILE_ID,
        originalName: "seed-2026-06-16-030000.csv",
        safeName: "seed.csv",
        shopDomain: SEED_SHOP_DOMAIN,
        status: "available",
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: files.id,
        set: {
          bucketProvider: "memory",
          byteSize: 128,
          contentType: "text/csv",
          expiresAt: new Date(now.getTime() + 1000 * 60 * 60 * 24),
          originalName: "seed-2026-06-16-030000.csv",
          safeName: "seed.csv",
          status: "available",
          updatedAt: now,
        },
      })
      .returning({
        bucketProvider: files.bucketProvider,
        id: files.id,
        shopDomain: files.shopDomain,
        status: files.status,
      });

    console.info(
      JSON.stringify(
        {
          file,
          ok: true,
          user,
        },
        null,
        2,
      ),
    );
  } finally {
    await pool.end();
  }
}

function getDatabaseUrl(): string {
  const databaseUrl = process.env.APP_DATABASE_URL ?? process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("APP_DATABASE_URL or DATABASE_URL is required");
  }

  return databaseUrl;
}

main();
