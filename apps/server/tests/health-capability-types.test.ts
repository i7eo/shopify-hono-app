import type {
  ModuleHealthDiskCheckResult,
  ModuleHealthMemoryCheckResult,
} from "@/app/runtime/capabilities";
import type {
  ProcessDiskUsageCheckResult,
  ProcessMemoryUsageCheckResult,
} from "@unimolecule/utils/node";

type Assert<T extends true> = T;

type IsAssignable<Source, Target> = Source extends Target ? true : false;

type SupportedDiskHealthResult = Exclude<
  ModuleHealthDiskCheckResult,
  { status: "unsupported" }
>;
type SupportedMemoryHealthResult = Exclude<
  ModuleHealthMemoryCheckResult,
  { status: "unsupported" }
>;

export type _DiskHealthReusesProcessDiskUsageCheckResult = Assert<
  IsAssignable<
    SupportedDiskHealthResult,
    ProcessDiskUsageCheckResult & { runtime: string }
  >
>;

export type _MemoryHealthReusesProcessMemoryUsageCheckResult = Assert<
  IsAssignable<
    SupportedMemoryHealthResult,
    ProcessMemoryUsageCheckResult & { runtime: string }
  >
>;

export type _DiskHealthKeepsUnsupportedRuntimeBranch = Assert<
  IsAssignable<
    { runtime: string; status: "unsupported" },
    ModuleHealthDiskCheckResult
  >
>;

export type _MemoryHealthKeepsUnsupportedRuntimeBranch = Assert<
  IsAssignable<
    { runtime: string; status: "unsupported" },
    ModuleHealthMemoryCheckResult
  >
>;
