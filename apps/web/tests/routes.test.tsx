import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ProductExportStatus } from "@/apis/product-exports";

const fetchProductsMock = vi.hoisted(() => vi.fn());
const fetchShopInfoMock = vi.hoisted(() => vi.fn());
const createProductExportMock = vi.hoisted(() => vi.fn());
const deleteProductExportMock = vi.hoisted(() => vi.fn());
const downloadProductExportFileMock = vi.hoisted(() => vi.fn());
const listProductExportsMock = vi.hoisted(() => vi.fn());

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

vi.mock("@/apis/product-exports", () => ({
  createProductExport: createProductExportMock,
  deleteProductExport: deleteProductExportMock,
  downloadProductExportFile: downloadProductExportFileMock,
  listProductExports: listProductExportsMock,
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
    createProductExportMock.mockReset();
    createProductExportMock.mockResolvedValue({
      data: {
        ...createProductExportRecord({
          id: "export-created",
          name: "All products",
          status: "queued",
        }),
      },
    });
    deleteProductExportMock.mockReset();
    deleteProductExportMock.mockResolvedValue(undefined);
    downloadProductExportFileMock.mockReset();
    downloadProductExportFileMock.mockResolvedValue(undefined);
    listProductExportsMock.mockReset();
    listProductExportsMock.mockResolvedValue(
      createListResponse([
        createProductExportRecord({
          id: "ready-export",
          name: "Summer catalog",
          status: "ready",
        }),
        createProductExportRecord({
          id: "processing-export",
          name: "Price review",
          status: "bulk_operation_running",
        }),
      ]),
    );
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
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("renders the root shell, app nav, devtools fallback, and 404 component", async () => {
    const { Route } = await import("../src/routes/__root");
    const Component = Route.options.component as React.ComponentType;
    const NotFound = Route.options.notFoundComponent as React.ComponentType;

    render(<Component />);

    expect(screen.getByTestId("outlet")).toBeTruthy();
    expect(document.querySelector("s-app-nav")).toBeTruthy();
    expect(readAppNavLinks()).toEqual([
      { href: "/", label: "Home", rel: "home" },
      { href: "/product-export", label: "Product Export", rel: undefined },
      {
        href: "/product-description",
        label: "Product Description",
        rel: undefined,
      },
      { href: "/settings", label: "Settings", rel: undefined },
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
    expect(
      screen.getByText("The page does not exist or has moved."),
    ).toBeTruthy();
    expect(screen.getByText("Go to app home")).toBeTruthy();
  });

  it("renders dedicated error routes under /errors", async () => {
    const routeModules = [
      {
        expectedPath: "/errors/404",
        heading: "Page not found",
        importRoute: () => import("../src/routes/errors/404"),
        message: "The page does not exist or has moved.",
      },
      {
        expectedPath: "/errors/403",
        heading: "Access denied",
        importRoute: () => import("../src/routes/errors/403"),
        message: "Your account does not have access to this page.",
      },
      {
        expectedPath: "/errors/500",
        heading: "Something went wrong",
        importRoute: () => import("../src/routes/errors/500"),
        message: "The server could not complete the request.",
      },
      {
        expectedPath: "/errors/offline",
        heading: "Connection unavailable",
        importRoute: () => import("../src/routes/errors/offline"),
        message: "Check your connection and try again.",
      },
    ];

    for (const routeModule of routeModules) {
      const { Route } = await routeModule.importRoute();
      const Component = Route.options.component as React.ComponentType;

      cleanup();
      render(<Component />);

      expect(Route.path).toBe(routeModule.expectedPath);
      expect(document.querySelector("s-page")?.getAttribute("heading")).toBe(
        routeModule.heading,
      );
      expect(screen.getByText(routeModule.message)).toBeTruthy();
      expect(screen.getByText("Go to app home")).toBeTruthy();
    }
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
      "Product Description",
    );
    expect(await screen.findByText("Summer catalog")).toBeTruthy();
    expect(screen.getByText("Price review")).toBeTruthy();
    expect(screen.getByText("Processing")).toBeTruthy();
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
    expect(screen.getByText("Price review")).toBeTruthy();
    expect(screen.getByText("Running bulk operation")).toBeTruthy();
    expect(
      document.querySelectorAll("s-button[slot='primary-action']"),
    ).toHaveLength(1);
    expect(document.querySelector("s-button")?.getAttribute("href")).toBe(
      "/product-export/new",
    );
    expect(listProductExportsMock).toHaveBeenCalledWith(
      { limit: 20 },
      expect.any(AbortSignal),
    );
    expect(fetchShopInfoMock).not.toHaveBeenCalled();
    expect(fetchProductsMock).not.toHaveBeenCalled();
  });

  it("renders product export empty and error states", async () => {
    listProductExportsMock.mockResolvedValueOnce(createListResponse([]));
    const { Route } = await import("../src/routes/product-export");
    const Component = Route.options.component as React.ComponentType;

    render(<Component />);

    await waitFor(() => {
      expect(sectionHeading("No product exports")).toBeTruthy();
    });

    cleanup();
    listProductExportsMock.mockRejectedValueOnce(new Error("network failed"));
    render(<Component />);

    await waitFor(() => {
      expect(bannerHeading("Unable to load product exports")).toBeTruthy();
    });
    expect(screen.getByText("network failed")).toBeTruthy();
  });

  it("downloads ready product exports and deletes rows from the index", async () => {
    const { Route } = await import("../src/routes/product-export");
    const Component = Route.options.component as React.ComponentType;

    render(<Component />);

    expect(await screen.findByText("Summer catalog")).toBeTruthy();

    const buttons = Array.from(document.querySelectorAll("s-button"));
    const readyDownloadButton = buttons.find(
      (button) =>
        button.getAttribute("accessibilityLabel") === "Download Summer catalog",
    )!;
    const processingDownloadButton = buttons.find(
      (button) =>
        button.getAttribute("accessibilityLabel") === "Download Price review",
    )!;
    const deleteButton = buttons.find(
      (button) =>
        button.getAttribute("accessibilityLabel") === "Delete Price review",
    )!;

    expect(readyDownloadButton).toBeTruthy();
    expect(processingDownloadButton.hasAttribute("disabled")).toBe(true);
    fireEvent.click(readyDownloadButton);
    await waitFor(() => {
      expect(downloadProductExportFileMock).toHaveBeenCalledWith(
        expect.objectContaining({ id: "ready-export" }),
        expect.any(AbortSignal),
      );
    });

    fireEvent.click(deleteButton);
    await waitFor(() => {
      expect(deleteProductExportMock).toHaveBeenCalledWith(
        "processing-export",
        expect.any(AbortSignal),
      );
    });
    expect(listProductExportsMock).toHaveBeenCalledTimes(2);
  });

  it("polls product exports while rows are not terminal", async () => {
    listProductExportsMock
      .mockResolvedValueOnce(
        createListResponse([
          createProductExportRecord({
            id: "processing-export",
            name: "Price review",
            status: "bulk_operation_running",
          }),
        ]),
      )
      .mockResolvedValueOnce(
        createListResponse([
          createProductExportRecord({
            id: "processing-export",
            name: "Price review",
            status: "ready",
          }),
        ]),
      );
    const nativeSetInterval = globalThis.setInterval;
    let pollHandler: TimerHandler | undefined;
    vi.spyOn(globalThis, "setInterval").mockImplementation(
      (handler: TimerHandler, timeout?: number, ...args: unknown[]) => {
        if (timeout === 1000 * 60 * 5) {
          pollHandler = handler;
          return 1 as unknown as ReturnType<typeof setInterval>;
        }

        return nativeSetInterval(handler, timeout, ...args) as ReturnType<
          typeof setInterval
        >;
      },
    );
    const { Route } = await import("../src/routes/product-export");
    const Component = Route.options.component as React.ComponentType;

    render(<Component />);

    expect(await screen.findByText("Price review")).toBeTruthy();
    if (typeof pollHandler === "function") pollHandler();
    await waitFor(() => {
      expect(listProductExportsMock).toHaveBeenCalledTimes(2);
    });
  });

  it("renders and submits the new product export form", async () => {
    const { Route } = await import("../src/routes/product-export/new");
    const Component = Route.options.component as React.ComponentType;

    render(<Component />);

    expect(document.querySelector("s-page")?.getAttribute("heading")).toBe(
      "Create product export",
    );
    expect(document.querySelector('s-text-field[name="name"]')).toBeTruthy();
    expect(document.querySelector("s-drop-zone")).toBeNull();
    expect(screen.getByText("Save")).toBeTruthy();

    const form = document.querySelector("form")!;
    const formData = new FormData();
    formData.set("name", "All products");
    const formDataSpy = vi
      .spyOn(globalThis, "FormData")
      .mockImplementation(function FormDataMock() {
        return formData;
      } as unknown as typeof FormData);

    fireEvent.submit(form);

    await waitFor(() => {
      expect(createProductExportMock).toHaveBeenCalledWith(
        { name: "All products" },
        expect.any(AbortSignal),
      );
    });
    expect(globalThis.shopify.loading).toHaveBeenNthCalledWith(1, true);
    expect(globalThis.shopify.loading).toHaveBeenLastCalledWith(false);
    expect(globalThis.shopify.toast.show).toHaveBeenCalledWith(
      "Product export created.",
      undefined,
    );
    expect(globalThis.location.pathname).toBe("/product-export");

    formDataSpy.mockRestore();
  });

  it("requires a product export name before submitting", async () => {
    const { Route } = await import("../src/routes/product-export/new");
    const Component = Route.options.component as React.ComponentType;

    render(<Component />);

    const form = document.querySelector("form")!;
    const formData = new FormData();
    formData.set("name", " ");
    const formDataSpy = vi
      .spyOn(globalThis, "FormData")
      .mockImplementation(function FormDataMock() {
        return formData;
      } as unknown as typeof FormData);

    fireEvent.submit(form);

    expect(createProductExportMock).not.toHaveBeenCalled();
    expect(await screen.findByText("Enter an export name.")).toBeTruthy();

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
  return findElementByAttribute("s-section", "heading", heading);
}

function bannerHeading(heading: string) {
  return findElementByAttribute("s-banner", "heading", heading);
}

function readAppNavLinks() {
  return Array.from(document.querySelectorAll("s-app-nav s-link")).map(
    (link) => ({
      href: link.getAttribute("href"),
      label: link.textContent?.trim(),
      rel: link.getAttribute("rel") ?? undefined,
    }),
  );
}

function findElementByAttribute(
  selector: string,
  attribute: string,
  value: string,
) {
  return Array.from(document.querySelectorAll(selector)).find(
    (element) => element.getAttribute(attribute) === value,
  );
}

function createListResponse(
  result: ReturnType<typeof createProductExportRecord>[],
) {
  return {
    data: {
      pagination: {
        hasNext: false,
        limit: 20,
        mode: "cursor",
      },
      result,
    },
  };
}

function createProductExportRecord(overrides: {
  id: string;
  name: string;
  status: ProductExportStatus;
}) {
  return {
    bucketKey:
      overrides.status === "ready"
        ? `test-shop.myshopify.com/product-exports/${overrides.id}/products.csv`
        : null,
    bucketProvider: overrides.status === "ready" ? "memory" : null,
    completedAt:
      overrides.status === "ready" ? "2026-06-18T12:05:00.000Z" : null,
    createdAt: "2026-06-18T12:00:00.000Z",
    deletedAt: null,
    errorCode: null,
    errorMessage: null,
    fileSize: overrides.status === "ready" ? 1024 : null,
    id: overrides.id,
    name: overrides.name,
    objectCount: overrides.status === "ready" ? 12 : null,
    partialDataUrl: null,
    resultUrl: null,
    shopDomain: "test-shop.myshopify.com",
    shopifyBulkOperationId: null,
    shopifyBulkOperationStatus: null,
    shopifySessionId: null,
    status: overrides.status,
    updatedAt: "2026-06-18T12:01:00.000Z",
  };
}
