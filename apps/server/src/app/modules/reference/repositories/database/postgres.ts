import { postgresReferences } from "@shamt/database/models/postgres";
import { and, asc, eq, gt, isNull, or, sql } from "drizzle-orm";
import {
  getPageOffset,
  getReferenceListCursor,
  toReferencesPage,
} from "./shared";
import type {
  ReferenceCodeLookup,
  ReferenceListInput,
  ReferenceLookup,
  ReferenceRecord,
  ReferenceRepository,
} from "../../types";
import type { PostgresDatabase } from "@/infra/database";

export async function createPostgresReference(
  database: PostgresDatabase,
  record: ReferenceRecord,
): Promise<void> {
  await database.db
    .insert(postgresReferences)
    .values(record)
    .onConflictDoNothing({
      target: [
        postgresReferences.shopDomain,
        postgresReferences.namespace,
        postgresReferences.code,
      ],
    });
}

export async function findPostgresReferenceById(
  database: PostgresDatabase,
  input: ReferenceLookup,
): Promise<ReferenceRecord | null> {
  const [record] = await database.db
    .select()
    .from(postgresReferences)
    .where(
      and(
        eq(postgresReferences.id, input.id),
        eq(postgresReferences.shopDomain, input.shopDomain),
        eq(postgresReferences.namespace, input.namespace),
        isNull(postgresReferences.deletedAt),
      ),
    )
    .limit(1);

  return record ?? null;
}

export async function findPostgresReferenceByCode(
  database: PostgresDatabase,
  input: ReferenceCodeLookup,
): Promise<ReferenceRecord | null> {
  const [record] = await database.db
    .select()
    .from(postgresReferences)
    .where(
      and(
        eq(postgresReferences.shopDomain, input.shopDomain),
        eq(postgresReferences.namespace, input.namespace),
        eq(postgresReferences.code, input.code),
        isNull(postgresReferences.deletedAt),
      ),
    )
    .limit(1);

  return record ?? null;
}

export async function findPostgresReferenceByCodeIncludingDeleted(
  database: PostgresDatabase,
  input: ReferenceCodeLookup,
): Promise<ReferenceRecord | null> {
  const [record] = await database.db
    .select()
    .from(postgresReferences)
    .where(
      and(
        eq(postgresReferences.shopDomain, input.shopDomain),
        eq(postgresReferences.namespace, input.namespace),
        eq(postgresReferences.code, input.code),
      ),
    )
    .limit(1);

  return record ?? null;
}

export async function listPostgresReferences(
  database: PostgresDatabase,
  input: ReferenceListInput,
): Promise<ReturnType<typeof toReferencesPage>> {
  const cursor = getReferenceListCursor(input);
  const where = getPostgresReferenceListWhere(input, cursor);
  const query = database.db
    .select()
    .from(postgresReferences)
    .where(where)
    .orderBy(
      asc(postgresReferences.sortOrder),
      asc(postgresReferences.code),
      asc(postgresReferences.id),
    )
    .limit(input.pagination.limit + 1);

  const rows =
    input.pagination.mode === "page"
      ? await query.offset(getPageOffset(input.pagination))
      : await query;
  const total =
    input.pagination.mode === "page"
      ? await countPostgresReferences(database, where)
      : undefined;

  return toReferencesPage(rows, input, total);
}

export async function updatePostgresReference(
  database: PostgresDatabase,
  record: ReferenceRecord,
): Promise<void> {
  await database.db
    .update(postgresReferences)
    .set(record)
    .where(
      and(
        eq(postgresReferences.id, record.id),
        eq(postgresReferences.shopDomain, record.shopDomain),
        eq(postgresReferences.namespace, record.namespace),
      ),
    );
}

export async function deletePostgresReference(
  database: PostgresDatabase,
  input: ReferenceLookup,
): Promise<void> {
  const now = new Date();

  await database.db
    .update(postgresReferences)
    .set({
      deletedAt: now,
      updatedAt: now,
    })
    .where(
      and(
        eq(postgresReferences.id, input.id),
        eq(postgresReferences.shopDomain, input.shopDomain),
        eq(postgresReferences.namespace, input.namespace),
        isNull(postgresReferences.deletedAt),
      ),
    );
}

function getPostgresReferenceListWhere(
  input: ReferenceListInput,
  cursor: ReturnType<typeof getReferenceListCursor>,
) {
  const conditions = [
    eq(postgresReferences.shopDomain, input.shopDomain),
    eq(postgresReferences.namespace, input.namespace),
    isNull(postgresReferences.deletedAt),
  ];

  if (input.enabled !== undefined) {
    conditions.push(eq(postgresReferences.enabled, input.enabled));
  }

  if (cursor) {
    conditions.push(
      or(
        gt(postgresReferences.sortOrder, cursor.sortOrder),
        and(
          eq(postgresReferences.sortOrder, cursor.sortOrder),
          gt(postgresReferences.code, cursor.code),
        ),
        and(
          eq(postgresReferences.sortOrder, cursor.sortOrder),
          eq(postgresReferences.code, cursor.code),
          gt(postgresReferences.id, cursor.id),
        ),
      )!,
    );
  }

  return and(...conditions);
}

async function countPostgresReferences(
  database: PostgresDatabase,
  where: ReturnType<typeof getPostgresReferenceListWhere>,
): Promise<number> {
  const [row] = await database.db
    .select({ total: sql<number>`count(*)` })
    .from(postgresReferences)
    .where(where);

  return Number(row?.total ?? 0);
}

export const postgresReferenceRepository = {
  create: createPostgresReference,
  delete: deletePostgresReference,
  findByCode: findPostgresReferenceByCode,
  findByCodeIncludingDeleted: findPostgresReferenceByCodeIncludingDeleted,
  findById: findPostgresReferenceById,
  list: listPostgresReferences,
  update: updatePostgresReference,
} satisfies Record<keyof ReferenceRepository, unknown>;
