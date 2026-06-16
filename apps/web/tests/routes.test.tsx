import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const fetchProductsMock = vi.hoisted(() => vi.fn());
const fetchShopInfoMock = vi.hoisted(() => vi.fn());
const uploadFileMock = vi.hoisted(() => vi.fn());

vi.mock("@/utils/public-env", () => ({
  DEFAULT_APP_API_PREFIX: "api",
  DEFAULT_REQUEST_TIMEOUT: 180_000,
  DEFAULT_SHOPIFY_APP_MODES: {
    EMBEDDED: "embedded",
    STANDALONE: "standalone",
  },
  getShopifyAppMode: () => "embedded",
  isEmbeddedShopifyApp: () => false,
  isStandaloneShopifyAppMode: () => true,
}));

vi.mock("@/apis/shopify", () => ({
  fetchProducts: fetchProductsMock,
  fetchShopInfo: fetchShopInfoMock,
  ShopifyAuthRedirectError: class ShopifyAuthRedirectError extends Error {
    static [Symbol.hasInstance](instance: unknown) {
      return (
        instance instanceof Error &&
        instance.name === "ShopifyAuthRedirectError"
      );
    }

    override name = "ShopifyAuthRedirectError";
  },
}));

vi.mock("@/apis/files", () => ({
  uploadFile: uploadFileMock,
}));

vi.mock("sonner", () => ({
  Toaster: () => <div data-testid="toaster" />,
  toast: vi.fn(),
}));

vi.mock("@tanstack/react-query-devtools", () => ({
  ReactQueryDevtools: (props: { buttonPosition: string }) => (
    <div
      data-position={props.buttonPosition}
      data-testid="react-query-devtools"
    />
  ),
}));

vi.mock("@tanstack/react-router-devtools", () => ({
  TanStackRouterDevtools: (props: { position: string }) => (
    <div data-position={props.position} data-testid="router-devtools" />
  ),
}));

vi.mock("@tanstack/react-router", () => {
  const makeRoute = (path: string, config: Record<string, unknown>) => ({
    path,
    options: config,
  });

  return {
    createFileRoute:
      (path: string) =>
      (config: Record<string, unknown> = {}) =>
        makeRoute(path, config),
    createRootRouteWithContext:
      () =>
      (config: Record<string, unknown> = {}) =>
        makeRoute("__root__", config),
    Outlet: () => <main data-testid="outlet" />,
  };
});

describe("route components", () => {
  beforeEach(() => {
    fetchProductsMock.mockReset();
    fetchShopInfoMock.mockReset();
    fetchProductsMock.mockResolvedValue({
      data: {
        products: {
          edges: [
            { node: { id: "gid://shopify/Product/1", title: "Cotton tee" } },
          ],
        },
      },
    });
    fetchShopInfoMock.mockResolvedValue({
      data: { shop: { myshopifyDomain: "shop.myshopify.com", name: "Shop" } },
    });
    uploadFileMock.mockReset();
    uploadFileMock.mockResolvedValue({
      data: {
        byteSize: 128,
        contentType: "image/png",
        createdAt: "2026-06-14T00:00:00.000Z",
        expiresAt: "2026-06-15T00:00:00.000Z",
        id: "file-1",
        originalName: "catalog.png",
        safeName: "catalog.png",
        status: "available",
        updatedAt: "2026-06-14T00:00:00.000Z",
      },
    });
    globalThis.shopify = {
      loading: vi.fn(),
      toast: { show: vi.fn() },
    } as unknown as ShopifyGlobal;
    vi.stubGlobal("__PUBLIC_ENV__", {
      APP_FILE_MAX_SIZE: 1024,
      APP_FILE_UPLOAD_MULTIPLE_SIZE: 2,
    });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("renders the root shell, app nav, devtools fallback, and not-found component", async () => {
    const { Route } = await import("../src/routes/__root");
    const Component = Route.options.component as React.ComponentType;
    const NotFound = Route.options.notFoundComponent as React.ComponentType;

    render(<Component />);

    expect(screen.getByTestId("outlet")).toBeTruthy();
    expect(document.querySelector("s-app-nav")).toBeTruthy();
    expect(readAppNavLinks()).toEqual([
      { href: "/", label: "Home" },
      { href: "/product-export", label: "Product Export" },
      { href: "/product-description", label: "Product Description" },
      { href: "/settings", label: "Settings" },
    ]);
    expect(await screen.findByTestId("toaster")).toBeTruthy();
    expect(
      (await screen.findByTestId("react-query-devtools")).dataset.position,
    ).toBe("bottom-left");
    expect(
      (await screen.findByTestId("router-devtools")).dataset.position,
    ).toBe("bottom-right");

    cleanup();
    render(<NotFound />);

    expect(document.querySelector("s-page")?.getAttribute("heading")).toBe(
      "Page not found",
    );
    expect(screen.getByText("Oops! Page Not Found.")).toBeTruthy();
    expect(screen.getByText("Go to app home")).toBeTruthy();
  });

  it("renders the homepage dashboard", async () => {
    const { Route } = await import("../src/routes/index");
    const Component = Route.options.component as React.ComponentType;

    render(<Component />);

    expect(document.querySelector("s-page")?.getAttribute("heading")).toBe(
      "Product content hub",
    );
    expect(sectionHeading("Setup guide")).toBeTruthy();
    expect(sectionHeading("Needs attention")).toBeTruthy();
    expect(screen.getByText("Description review")).toBeTruthy();
  });

  it("renders the product description resource index", async () => {
    const { Route } = await import("../src/routes/product-description");
    const Component = Route.options.component as React.ComponentType;

    render(<Component />);

    expect(document.querySelector("s-page")?.getAttribute("heading")).toBe(
      "Product descriptions",
    );
    expect(screen.getByText("Classic cotton tee")).toBeTruthy();
    expect(screen.getByText("Everyday canvas tote")).toBeTruthy();
    expect(screen.getByText("Approve selected")).toBeTruthy();
  });

  it("renders the product export resource index", async () => {
    const { Route } = await import("../src/routes/product-export");
    const Component = Route.options.component as React.ComponentType;

    render(<Component />);

    expect(document.querySelector("s-page")?.getAttribute("heading")).toBe(
      "Product export",
    );
    expect(
      document.querySelector(
        's-spinner[accessibilitylabel="Loading product export actions"]',
      ),
    ).toBeTruthy();

    expect(await screen.findByText("Summer catalog")).toBeTruthy();
    expect(screen.getByText("price-review.csv")).toBeTruthy();
    expect(screen.getByText("Processing")).toBeTruthy();
    expect(
      document.querySelectorAll("s-button[slot='primary-action']"),
    ).toHaveLength(1);
    expect(document.querySelector("s-button")?.getAttribute("href")).toBe(
      "/product-export/new",
    );
    expect(fetchShopInfoMock).not.toHaveBeenCalled();
    expect(fetchProductsMock).not.toHaveBeenCalled();
  });

  it("renders the new product export details form", async () => {
    const { Route } = await import("../src/routes/product-export/new");
    const Component = Route.options.component as React.ComponentType;

    render(<Component />);

    expect(document.querySelector("s-page")?.getAttribute("heading")).toBe(
      "Create product export",
    );
    expect(document.querySelector('s-text-field[name="name"]')).toBeTruthy();
    expect(document.querySelector('s-drop-zone[name="file"]')).toBeTruthy();
    expect(screen.getByText("Save")).toBeTruthy();
  });

  it("uploads the selected product export images", async () => {
    const { Route } = await import("../src/routes/product-export/new");
    const Component = Route.options.component as React.ComponentType;
    const file = new File(["image"], "catalog.png", {
      type: "image/png",
    });

    render(<Component />);

    const form = document.querySelector("form")!;
    const formData = new FormData();
    formData.set("file", file);
    const formDataSpy = vi
      .spyOn(globalThis, "FormData")
      .mockImplementation(function FormDataMock() {
        return formData;
      } as unknown as typeof FormData);

    fireEvent.submit(form);

    await waitFor(() => {
      expect(uploadFileMock).toHaveBeenCalledWith(
        file,
        expect.any(AbortSignal),
      );
    });
    expect(globalThis.shopify.loading).toHaveBeenNthCalledWith(1, true);
    expect(globalThis.shopify.loading).toHaveBeenLastCalledWith(false);
    expect(globalThis.shopify.toast.show).toHaveBeenCalledWith(
      "Export action images uploaded.",
      undefined,
    );
    expect(screen.getByText("More actions")).toBeTruthy();
    expect(document.querySelector("s-menu")).toBeTruthy();
    expect(screen.getByText("Delete")).toBeTruthy();

    formDataSpy.mockRestore();
  });

  it("renders selected image previews", async () => {
    const { Route } = await import("../src/routes/product-export/new");
    const Component = Route.options.component as React.ComponentType;
    const file = new File(["image"], "catalog-preview.png", {
      type: "image/png",
    });

    render(<Component />);

    const dropZone = document.querySelector("s-drop-zone")!;
    Object.defineProperty(dropZone, "files", {
      configurable: true,
      value: [file],
    });
    fireEvent.change(dropZone);

    expect(await screen.findByText("catalog-preview...")).toBeTruthy();
    expect(screen.getByText("PNG")).toBeTruthy();
    expect(document.querySelector("s-image")).toBeTruthy();
  });

  it("rejects more images than the public upload limit", async () => {
    const { Route } = await import("../src/routes/product-export/new");
    const Component = Route.options.component as React.ComponentType;
    const files = [
      new File(["image"], "one.png", { type: "image/png" }),
      new File(["image"], "two.png", { type: "image/png" }),
      new File(["image"], "three.png", { type: "image/png" }),
    ];

    render(<Component />);

    const form = document.querySelector("form")!;
    const formData = new FormData();
    for (const file of files) formData.append("file", file);
    const formDataSpy = vi
      .spyOn(globalThis, "FormData")
      .mockImplementation(function FormDataMock() {
        return formData;
      } as unknown as typeof FormData);

    fireEvent.submit(form);

    expect(uploadFileMock).not.toHaveBeenCalled();
    expect(globalThis.shopify.toast.show).toHaveBeenCalledWith(
      "Upload up to 2 images at once.",
      { isError: true },
    );

    formDataSpy.mockRestore();
  });

  it("rejects images larger than the public file size limit", async () => {
    const { Route } = await import("../src/routes/product-export/new");
    const Component = Route.options.component as React.ComponentType;
    const file = new File(["x".repeat(1025)], "large.png", {
      type: "image/png",
    });

    render(<Component />);

    const form = document.querySelector("form")!;
    const formData = new FormData();
    formData.set("file", file);
    const formDataSpy = vi
      .spyOn(globalThis, "FormData")
      .mockImplementation(function FormDataMock() {
        return formData;
      } as unknown as typeof FormData);

    fireEvent.submit(form);

    expect(uploadFileMock).not.toHaveBeenCalled();
    expect(globalThis.shopify.toast.show).toHaveBeenCalledWith(
      "large.png is larger than 1.0 KB.",
      { isError: true },
    );

    formDataSpy.mockRestore();
  });

  it("renders and submits the settings form", async () => {
    const { Route } = await import("../src/routes/settings");
    const Component = Route.options.component as React.ComponentType;
    const consoleInfo = vi.spyOn(console, "info").mockImplementation(() => {});

    render(<Component />);
    fireEvent.submit(document.querySelector("form")!);

    expect(document.querySelector("s-page")?.getAttribute("heading")).toBe(
      "Settings",
    );
    expect(sectionHeading("Export defaults")).toBeTruthy();
    expect(sectionHeading("Description generation")).toBeTruthy();
    expect(consoleInfo).toHaveBeenCalledWith(
      "Settings form data",
      expect.any(Object),
    );
  });
});

function sectionHeading(heading: string) {
  return document.querySelector(`s-section[heading="${CSS.escape(heading)}"]`);
}

function readAppNavLinks() {
  return Array.from(document.querySelectorAll("s-app-nav s-link")).map(
    (link) => ({
      href: link.getAttribute("href"),
      label: link.textContent?.trim(),
    }),
  );
}
