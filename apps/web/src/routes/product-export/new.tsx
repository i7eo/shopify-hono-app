import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState, type SubmitEvent } from "react";
import { createProductExport } from "@/apis/product-exports";

export const Route = createFileRoute("/product-export/new")({
  component: NewProductExport,
});

function NewProductExport() {
  const abortControllerRef = useRef<AbortController | undefined>(undefined);
  const [errorMessage, setErrorMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = getFormTextValue(event.currentTarget, "name");

    if (!name) {
      setErrorMessage("Enter an export name.");
      return;
    }

    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setErrorMessage("");
    setIsSaving(true);
    setLoading(true);

    try {
      await createProductExport({ name }, controller.signal);
      showToast("Product export created.");
      globalThis.history.pushState({}, "", "/product-export");
    } catch (error) {
      if (!controller.signal.aborted) {
        setErrorMessage(getErrorMessage(error));
        showToast(getErrorMessage(error), { isError: true });
      }
    } finally {
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = undefined;
      }
      setIsSaving(false);
      setLoading(false);
    }
  }

  return (
    <form data-save-bar onSubmit={handleSubmit}>
      <s-page heading="Create product export">
        <s-link slot="breadcrumb-actions" href="/product-export">
          Product export
        </s-link>

        <s-button
          disabled={isSaving}
          id="save-btn"
          loading={isSaving}
          slot="primary-action"
          type="submit"
          variant="primary"
        >
          Save
        </s-button>

        {errorMessage ? (
          <s-section>
            <s-banner heading="Unable to create product export" tone="critical">
              <s-text>{errorMessage}</s-text>
            </s-banner>
          </s-section>
        ) : null}

        <s-section>
          <s-text-field
            label="Export name"
            labelAccessibilityVisibility="visible"
            name="name"
            placeholder="All products"
            required
          ></s-text-field>
        </s-section>
      </s-page>
    </form>
  );
}

function getFormTextValue(form: HTMLFormElement, key: string) {
  const value = new FormData(form).get(key);
  return typeof value === "string" ? value.trim() : "";
}

function setLoading(isLoading: boolean) {
  globalThis.shopify?.loading(isLoading);
}

function showToast(
  message: string,
  options?: Parameters<(typeof globalThis.shopify)["toast"]["show"]>[1],
) {
  globalThis.shopify?.toast.show(message, options);
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
