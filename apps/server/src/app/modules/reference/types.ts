import type { PaginatedPage, PaginationInput } from "@/shared/models";
import type { SelectReference } from "@shamt/database/sql-schemas/postgres";

export type ReferenceRecord = SelectReference;

export type ReferencesPage = PaginatedPage & {
  references: ReferenceRecord[];
};

export type ReferenceNamespaceLookup = {
  namespace: string;
  shopDomain: string;
};

export type ReferenceLookup = ReferenceNamespaceLookup & {
  id: string;
};

export type ReferenceCodeLookup = ReferenceNamespaceLookup & {
  code: string;
};

export type ReferenceCreateInput = ReferenceNamespaceLookup & {
  code: string;
  enabled?: boolean;
  label: string;
  sortOrder?: number;
};

export type ReferenceUpdateInput = ReferenceLookup & {
  code?: string;
  enabled?: boolean;
  label?: string;
  sortOrder?: number;
};

export type ReferenceListInput = ReferenceNamespaceLookup & {
  enabled?: boolean;
  pagination: PaginationInput;
};

export type ListReferencesInput = ReferenceNamespaceLookup & {
  cursor?: string;
  enabled?: boolean;
  limit?: number;
  page?: number;
};

export interface ReferenceRepository {
  create: (record: ReferenceRecord) => Promise<void>;
  delete: (input: ReferenceLookup) => Promise<void>;
  findByCode: (input: ReferenceCodeLookup) => Promise<ReferenceRecord | null>;
  findByCodeIncludingDeleted: (
    input: ReferenceCodeLookup,
  ) => Promise<ReferenceRecord | null>;
  findById: (input: ReferenceLookup) => Promise<ReferenceRecord | null>;
  list: (input: ReferenceListInput) => Promise<ReferencesPage>;
  update: (record: ReferenceRecord) => Promise<void>;
}
