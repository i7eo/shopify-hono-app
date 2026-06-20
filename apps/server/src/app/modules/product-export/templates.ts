import { PRODUCT_EXPORT_TEMPLATE_CODE_VALUES } from "@shamt/database/models/postgres";

export const PRODUCT_EXPORT_TEMPLATE_CODES =
  PRODUCT_EXPORT_TEMPLATE_CODE_VALUES;

export type ProductExportTemplateCode =
  (typeof PRODUCT_EXPORT_TEMPLATE_CODE_VALUES)[number];

export type ProductExportTemplate = {
  code: ProductExportTemplateCode;
  fields: string[];
  label: string;
};

export const PRODUCT_EXPORT_TEMPLATES = [
  {
    code: "basic",
    fields: [
      "id",
      "title",
      "handle",
      "status",
      "vendor",
      "productType",
      "createdAt",
      "updatedAt",
    ],
    label: "Basic",
  },
] as const satisfies ProductExportTemplate[];

export const DEFAULT_PRODUCT_EXPORT_TEMPLATE: ProductExportTemplateCode =
  "basic";

export function listProductExportTemplates(): ProductExportTemplate[] {
  return PRODUCT_EXPORT_TEMPLATES.map((template) => ({
    code: template.code,
    fields: [...template.fields],
    label: template.label,
  }));
}

export function isProductExportTemplateCode(
  value: string,
): value is ProductExportTemplateCode {
  return PRODUCT_EXPORT_TEMPLATE_CODES.includes(
    value as ProductExportTemplateCode,
  );
}
