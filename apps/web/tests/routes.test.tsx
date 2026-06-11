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
  });

  afterEach(() => {
    cleanup();
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
      { href: "/product-export", label: "Product export" },
      { href: "/product-description", label: "Product description" },
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

  it("loads and renders the product export resource index", async () => {
    const { Route } = await import("../src/routes/product-export");
    const Component = Route.options.component as React.ComponentType;

    render(<Component />);

    expect(
      document.querySelector(
        's-spinner[accessibilitylabel="Loading products"]',
      ),
    ).toBeTruthy();
    await waitFor(() => {
      expect(screen.getByText("Cotton tee")).toBeTruthy();
    });
    expect(screen.getByText("Shop")).toBeTruthy();
    expect(document.querySelector("#shop-info")?.textContent).toContain(
      "shop.myshopify.com",
    );
    expect(fetchShopInfoMock).toHaveBeenCalledOnce();
    expect(fetchProductsMock).toHaveBeenCalledOnce();
  });

  it("renders generic error states on product export", async () => {
    fetchShopInfoMock.mockRejectedValueOnce(new Error("Server unavailable"));
    const { Route } = await import("../src/routes/product-export");
    const Component = Route.options.component as React.ComponentType;

    render(<Component />);

    await waitFor(() => {
      expect(screen.getByText("Server unavailable")).toBeTruthy();
    });
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
  return document.querySelector(`s-section[heading="${heading}"]`);
}

function readAppNavLinks() {
  return Array.from(document.querySelectorAll("s-app-nav s-link")).map(
    (link) => ({
      href: link.getAttribute("href"),
      label: link.textContent?.trim(),
    }),
  );
}
