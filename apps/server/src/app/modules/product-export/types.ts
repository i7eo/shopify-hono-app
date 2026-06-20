import type { RuntimeConfig } from "@/infra/env";
import type { PaginatedPage, PaginationInput } from "@/shared/models";
import type {
  SelectProductExport,
  SelectProductExportPart,
} from "@shamt/database/sql-schemas/postgres";

export type ProductExportRecord = SelectProductExport;
export type ProductExportPartRecord = SelectProductExportPart;
export type ProductExportStatus = ProductExportRecord["status"];
export type ProductExportPartStatus = ProductExportPartRecord["status"];

export type ProductExportsPage = PaginatedPage & {
  productExports: ProductExportRecord[];
};

export type ProductExportListInput = {
  pagination: PaginationInput;
  shopDomain: string;
  status?: ProductExportStatus;
};

export type ListProductExportsInput = {
  cursor?: string;
  limit?: number;
  page?: number;
  shopDomain: string;
  status?: ProductExportStatus;
};

export type ProductExportLookup = {
  id: string;
  shopDomain: string;
};

export type ProductExportPartLookup = {
  exportId: string;
  seq: number;
};

export type ProductExportCreateInput = {
  name: string;
  runtimeEnv: RuntimeConfig;
  shopDomain: string;
};

export type ProductExportPartStats = {
  done: number;
  failed: number;
  pending: number;
  processing: number;
  total: number;
};

export type ProductExportStore = {
  create: (record: ProductExportRecord) => Promise<void>;
  createParts: (parts: ProductExportPartRecord[]) => Promise<void>;
  claimPart: (
    input: ProductExportPartLookup,
  ) => Promise<ProductExportPartRecord | null>;
  delete: (input: ProductExportLookup) => Promise<void>;
  findByBulkOperationId: (
    bulkOperationId: string,
  ) => Promise<ProductExportRecord | null>;
  findById: (input: ProductExportLookup) => Promise<ProductExportRecord | null>;
  getPartStats: (exportId: string) => Promise<ProductExportPartStats>;
  list: (input: ProductExportListInput) => Promise<ProductExportsPage>;
  listParts: (exportId: string) => Promise<ProductExportPartRecord[]>;
  listPartsByStatus: (input: {
    exportId: string;
    statuses: ProductExportPartStatus[];
  }) => Promise<ProductExportPartRecord[]>;
  listRecoverableExports: (input: {
    cursor?: {
      id: string;
      updatedAt: Date;
    };
    limit: number;
    olderThan: Date;
  }) => Promise<ProductExportRecord[]>;
  markPartDone: (
    input: ProductExportPartLookup & {
      bucketKey: string;
      bucketProvider: string;
      byteSize: number;
      rowCount: number;
    },
  ) => Promise<void>;
  markPartFailed: (
    input: ProductExportPartLookup & {
      errorCode: string;
      errorMessage: string;
    },
  ) => Promise<void>;
  update: (record: ProductExportRecord) => Promise<void>;
};
