import { requireCapability } from "@/app/runtime/capabilities";
import { createRuntimeResourceContextFromHono } from "@/app/runtime/resources";
import { conflictError, notFoundError } from "@/shared/exceptions";
import { toPaginationInput } from "@/shared/models";
import { REFERENCE_GENDER_DEFAULTS, REFERENCE_NAMESPACES } from "./constants";
import { createDatabaseReferenceStoreFromPromise } from "./stores/database";
import type {
  ListReferencesInput,
  ReferenceCreateInput,
  ReferenceListInput,
  ReferenceLookup,
  ReferenceNamespaceLookup,
  ReferenceRecord,
  ReferenceStore,
  ReferenceUpdateInput,
} from "./types";
import type { AppEnv } from "@/typings";
import type { Context } from "hono";

/**
 * Lists active references for one shop and namespace.
 */
export async function listReferences(
  c: Context<AppEnv>,
  input: ListReferencesInput,
) {
  const listInput: ReferenceListInput = {
    enabled: input.enabled,
    namespace: input.namespace,
    pagination: toPaginationInput(
      {
        cursor: input.cursor,
        limit: input.limit,
        page: input.page,
      },
      50,
    ),
    shopDomain: input.shopDomain,
  };

  await ensureReferenceNamespaceDefaults(c, listInput);
  return await getReferenceStore(c).list(listInput);
}

/**
 * Creates one reference for a shop-scoped namespace.
 */
export async function createReference(
  c: Context<AppEnv>,
  input: ReferenceCreateInput,
): Promise<ReferenceRecord> {
  const store = getReferenceStore(c);
  const existing = await store.findByCodeIncludingDeleted(input);

  if (existing && !existing.deletedAt) {
    throw conflictError("Reference already exists", {
      details: {
        code: input.code,
        namespace: input.namespace,
        shopDomain: input.shopDomain,
      },
      expose: true,
    });
  }

  const now = new Date();
  const record: ReferenceRecord = {
    code: input.code,
    createdAt: existing?.createdAt ?? now,
    deletedAt: null,
    enabled: input.enabled ?? true,
    id: existing?.id ?? crypto.randomUUID(),
    label: input.label,
    namespace: input.namespace,
    shopDomain: input.shopDomain,
    sortOrder: input.sortOrder ?? 100,
    system: false,
    updatedAt: now,
  };

  if (existing) {
    await store.update(record);
    return record;
  }

  await store.create(record);
  return record;
}

/**
 * Loads one reference and raises a public 404 when it is missing.
 */
export async function getReference(
  c: Context<AppEnv>,
  input: ReferenceLookup,
): Promise<ReferenceRecord> {
  await ensureReferenceNamespaceDefaults(c, input);

  const record = await getReferenceStore(c).findById(input);

  if (!record) {
    throw notFoundError("Reference not found", {
      details: input,
      expose: true,
    });
  }

  return record;
}

/**
 * Updates mutable fields for one reference.
 */
export async function updateReference(
  c: Context<AppEnv>,
  input: ReferenceUpdateInput,
): Promise<ReferenceRecord> {
  const store = getReferenceStore(c);
  const current = await getReference(c, input);
  const nextCode = input.code ?? current.code;

  if (nextCode !== current.code) {
    const duplicate = await store.findByCode({
      code: nextCode,
      namespace: input.namespace,
      shopDomain: input.shopDomain,
    });

    if (duplicate && duplicate.id !== current.id) {
      throw conflictError("Reference already exists", {
        details: {
          code: nextCode,
          namespace: input.namespace,
          shopDomain: input.shopDomain,
        },
        expose: true,
      });
    }
  }

  const updated: ReferenceRecord = {
    ...current,
    code: nextCode,
    enabled: input.enabled ?? current.enabled,
    label: input.label ?? current.label,
    sortOrder: input.sortOrder ?? current.sortOrder,
    updatedAt: new Date(),
  };

  await store.update(updated);
  return updated;
}

/**
 * Soft-deletes one reference.
 */
export async function deleteReference(
  c: Context<AppEnv>,
  input: ReferenceLookup,
): Promise<void> {
  await getReference(c, input);
  await getReferenceStore(c).delete(input);
}

/**
 * Resolves the reference store from the active runtime capability.
 */
export function getReferenceStore(c: Context<AppEnv>): ReferenceStore {
  const database = c.get("resources").resolve(
    "database",
    () =>
      requireCapability("databaseFactory")(
        createRuntimeResourceContextFromHono(c),
      ),
    (db) => db.dispose(),
  );

  return createDatabaseReferenceStoreFromPromise(database);
}

async function ensureReferenceNamespaceDefaults(
  c: Context<AppEnv>,
  input: ReferenceNamespaceLookup,
): Promise<void> {
  if (input.namespace !== REFERENCE_NAMESPACES.GENDER) return;

  const store = getReferenceStore(c);
  const now = new Date();

  await Promise.all(
    REFERENCE_GENDER_DEFAULTS.map(async (reference) => {
      const existing = await store.findByCodeIncludingDeleted({
        code: reference.code,
        namespace: input.namespace,
        shopDomain: input.shopDomain,
      });

      if (existing && !existing.deletedAt) return;

      if (existing) {
        await store.update({
          ...existing,
          deletedAt: null,
          enabled: true,
          label: existing.label,
          sortOrder: existing.sortOrder,
          system: true,
          updatedAt: now,
        });
        return;
      }

      await store.create({
        code: reference.code,
        createdAt: now,
        deletedAt: null,
        enabled: true,
        id: crypto.randomUUID(),
        label: reference.label,
        namespace: input.namespace,
        shopDomain: input.shopDomain,
        sortOrder: reference.sortOrder,
        system: true,
        updatedAt: now,
      });
    }),
  );
}
