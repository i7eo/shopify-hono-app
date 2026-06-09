import type {
  HttpRequestConfig,
  InferSchemaOutput,
  RequestBehavior,
  ValidationSchema,
} from "../utils/types";
import type { Options } from "ky";

export type HeaderSource = Options["headers"];
export type KyHooks = NonNullable<Options["hooks"]>;
export type ParseJson = NonNullable<Options["parseJson"]>;

export type ResolvedRequestBehavior = Required<RequestBehavior>;

export type ResponseConfig<TSchema extends ValidationSchema> = Omit<
  HttpRequestConfig<unknown, InferSchemaOutput<TSchema>>,
  "body" | "method"
> & {
  responseSchema: TSchema;
};

export type BodyResponseConfig<TBody, TSchema extends ValidationSchema> = Omit<
  HttpRequestConfig<TBody, InferSchemaOutput<TSchema>>,
  "body" | "method"
> & {
  responseSchema: TSchema;
};
