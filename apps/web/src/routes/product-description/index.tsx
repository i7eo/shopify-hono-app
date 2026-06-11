import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/product-description/")({
  component: ProductDescription,
});

const descriptionRows = [
  {
    product: "Classic cotton tee",
    status: "Ready",
    tone: "success",
    updatedAt: "Today",
    words: 142,
  },
  {
    product: "Everyday canvas tote",
    status: "Review",
    tone: "warning",
    updatedAt: "Yesterday",
    words: 118,
  },
  {
    product: "Ceramic travel mug",
    status: "Draft",
    tone: "neutral",
    updatedAt: "Last week",
    words: 96,
  },
] as const;

function ProductDescription() {
  return (
    <s-page heading="Product descriptions">
      <s-button slot="primary-action" variant="primary">
        Generate descriptions
      </s-button>
      <s-button slot="secondary-actions" variant="secondary">
        Import products
      </s-button>

      <s-section heading="Description queue">
        <s-text color="subdued">
          Review generated product copy before publishing it to Shopify.
        </s-text>
      </s-section>

      <s-section padding="none" accessibilityLabel="Product descriptions table">
        <s-table>
          <s-table-header-row>
            <s-table-header listSlot="primary">Product</s-table-header>
            <s-table-header format="numeric">Words</s-table-header>
            <s-table-header>Updated</s-table-header>
            <s-table-header>Status</s-table-header>
          </s-table-header-row>
          <s-table-body>
            {descriptionRows.map((row) => (
              <s-table-row key={row.product}>
                <s-table-cell>
                  <s-link href="#">{row.product}</s-link>
                </s-table-cell>
                <s-table-cell>{row.words}</s-table-cell>
                <s-table-cell>{row.updatedAt}</s-table-cell>
                <s-table-cell>
                  <s-badge tone={row.tone}>{row.status}</s-badge>
                </s-table-cell>
              </s-table-row>
            ))}
          </s-table-body>
        </s-table>
      </s-section>

      <s-section heading="Bulk actions">
        <s-stack direction="inline" gap="small-200">
          <s-button variant="primary">Approve selected</s-button>
          <s-button variant="secondary">Regenerate selected</s-button>
        </s-stack>
      </s-section>
    </s-page>
  );
}
