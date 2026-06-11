import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PostNotFoundError } from "../src/apis/posts";

const routerInvalidateMock = vi.hoisted(() => vi.fn());
const queryBoundaryResetMock = vi.hoisted(() => vi.fn());
const fetchProductsMock = vi.hoisted(() => vi.fn());
const fetchShopInfoMock = vi.hoisted(() => vi.fn());
const useSuspenseQueryMock = vi.hoisted(() => vi.fn());
const routeParams = vi.hoisted(() => ({ postId: "1" }));

vi.mock("@tanstack/react-query", () => ({
  queryOptions: (options: unknown) => options,
  useQueryErrorResetBoundary: () => ({ reset: queryBoundaryResetMock }),
  useSuspenseQuery: useSuspenseQueryMock,
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
    useParams: () => routeParams,
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
    ErrorComponent: ({ error }: { error: Error }) => (
      <div data-error>{error.message}</div>
    ),
    Link: ({
      children,
      to,
      params,
      className,
    }: {
      children: React.ReactNode;
      to: string;
      params?: { postId?: string };
      className?: string;
    }) => (
      <a
        className={className}
        href={params?.postId ? `${to}:${params.postId}` : to}
      >
        {children}
      </a>
    ),
    Outlet: () => <main data-testid="outlet" />,
    useRouter: () => ({ invalidate: routerInvalidateMock }),
  };
});

vi.mock("@/apis/shopify", () => ({
  fetchProducts: fetchProductsMock,
  fetchShopInfo: fetchShopInfoMock,
  ShopifyAuthRedirectError: class ShopifyAuthRedirectError extends Error {
    override name = "ShopifyAuthRedirectError";
  },
}));

describe("route components", () => {
  beforeEach(() => {
    routeParams.postId = "1";
    fetchProductsMock.mockReset();
    fetchShopInfoMock.mockReset();
    fetchProductsMock.mockResolvedValue({ data: { products: { edges: [] } } });
    fetchShopInfoMock.mockResolvedValue({
      data: { shop: { myshopifyDomain: "shop.myshopify.com", name: "Shop" } },
    });
    useSuspenseQueryMock.mockReset();
    queryBoundaryResetMock.mockClear();
    routerInvalidateMock.mockClear();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders the root route shell and not-found component", async () => {
    const { Route } = await import("../src/routes/__root");
    const Component = Route.options.component as React.ComponentType;
    const NotFound = Route.options.notFoundComponent as React.ComponentType;

    const { unmount } = render(<Component />);

    expect(screen.getByRole("link", { name: "Home" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Posts" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Layout Routes" })).toBeTruthy();
    expect(
      screen.getByRole("link", { name: "This Route Does Not Exist" }),
    ).toBeTruthy();
    expect(
      (await screen.findByTestId("react-query-devtools")).dataset.position,
    ).toBe("bottom-left");
    expect(
      (await screen.findByTestId("router-devtools")).dataset.position,
    ).toBe("bottom-right");
    unmount();

    render(<NotFound />);

    expect(
      screen.getByText(
        "This is the notFoundComponent configured on root route",
      ),
    ).toBeTruthy();
    expect(screen.getByRole("link", { name: "Start Over" })).toBeTruthy();
  });

  it("renders simple page routes", async () => {
    const home = await import("../src/routes/index");
    const postsIndex = await import("../src/routes/posts/index");
    const routeA = await import("../src/routes/layout/nested/route-a");
    const routeB = await import("../src/routes/layout/nested/route-b");

    const { unmount } = render(
      React.createElement(home.Route.options.component as React.ComponentType),
    );
    expect(document.querySelector("s-page")?.getAttribute("heading")).toBe(
      "My Shopify App",
    );
    unmount();

    render(
      React.createElement(
        postsIndex.Route.options.component as React.ComponentType,
      ),
    );
    expect(screen.getByText("Select a post.")).toBeTruthy();
    unmount();

    render(
      React.createElement(
        routeA.Route.options.component as React.ComponentType,
      ),
    );
    expect(screen.getByText("I'm layout A!")).toBeTruthy();
    unmount();

    render(
      React.createElement(
        routeB.Route.options.component as React.ComponentType,
      ),
    );
    expect(screen.getByText("I'm layout B!")).toBeTruthy();
  });

  it("renders layout shells", async () => {
    const { LayoutRouteShell, NestedLayoutRouteShell } =
      await import("../src/layouts/layout-routes");

    const { unmount } = render(<LayoutRouteShell />);
    expect(screen.getByText("I'm a layout")).toBeTruthy();
    expect(screen.getByTestId("outlet")).toBeTruthy();
    unmount();

    render(<NestedLayoutRouteShell />);

    expect(screen.getByText("I'm a nested layout")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Go to route A" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Go to route B" })).toBeTruthy();
  });

  it("wires layout route modules to their shell components", async () => {
    const layout = await import("../src/routes/layout/route");
    const nested = await import("../src/routes/layout/nested/route");

    expect(layout.Route.path).toBe("/layout");
    expect(nested.Route.path).toBe("/layout/nested");

    const { unmount } = render(
      React.createElement(
        layout.Route.options.component as React.ComponentType,
      ),
    );
    expect(screen.getByText("I'm a layout")).toBeTruthy();
    unmount();

    render(
      React.createElement(
        nested.Route.options.component as React.ComponentType,
      ),
    );
    expect(screen.getByText("I'm a nested layout")).toBeTruthy();
  });

  it("loads and renders the posts layout", async () => {
    const { PostsLayout } = await import("../src/layouts/posts");
    useSuspenseQueryMock.mockReturnValueOnce({
      data: [
        {
          id: "1",
          title: "A title that is definitely longer than twenty",
          body: "",
        },
        { id: "2", title: "Short title", body: "" },
      ],
    });

    render(<PostsLayout />);

    const firstPostLink = screen.getByRole("link", {
      name: "A title that is defi",
    });

    expect(screen.getByText("Short title")).toBeTruthy();
    expect(screen.getByText("Non-existent Post")).toBeTruthy();
    expect(firstPostLink.getAttribute("href")).toBe("/posts/$postId:1");
    expect(screen.getByTestId("outlet")).toBeTruthy();
  });

  it("uses React Query loaders for posts routes", async () => {
    const postsRoute = await import("../src/routes/posts/route");
    const postRoute = await import("../src/routes/posts/$postId");
    const ensureQueryData = vi.fn((options) => options);
    const context = { queryClient: { ensureQueryData } };

    //@ts-ignore
    const postsResult = postsRoute.Route.options.loader({
      context,
    });
    //@ts-ignore
    const postResult = postRoute.Route.options.loader({
      context,
      params: { postId: "abc" },
    });

    expect(postsResult.queryKey).toEqual(["posts"]);
    expect(postResult.queryKey).toEqual(["posts", { postId: "abc" }]);
    expect(ensureQueryData).toHaveBeenCalledTimes(2);
  });

  it("renders a post detail", async () => {
    const { Route } = await import("../src/routes/posts/$postId");
    routeParams.postId = "42";
    useSuspenseQueryMock.mockReturnValueOnce({
      data: { id: "42", title: "Meaningful title", body: "The answer body" },
    });
    const Component = Route.options.component as React.ComponentType;

    render(<Component />);

    expect(
      screen.getByRole("heading", { name: "Meaningful title" }),
    ).toBeTruthy();
    expect(screen.getByText("The answer body")).toBeTruthy();
    expect(useSuspenseQueryMock).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: ["posts", { postId: "42" }] }),
    );
  });

  it("renders a friendly post-not-found error", async () => {
    const { Route } = await import("../src/routes/posts/$postId");
    const ErrorComponent = Route.options.errorComponent as React.ComponentType<{
      error: Error;
    }>;

    render(<ErrorComponent error={new PostNotFoundError("Gone")} />);

    expect(screen.getByText("Gone")).toBeTruthy();
    expect(queryBoundaryResetMock).not.toHaveBeenCalled();
  });

  it("renders retry UI for other post errors", async () => {
    const { Route } = await import("../src/routes/posts/$postId");
    const ErrorComponent = Route.options.errorComponent as React.ComponentType<{
      error: Error;
    }>;

    render(<ErrorComponent error={new Error("Temporary failure")} />);
    fireEvent.click(screen.getByRole("button", { name: "retry" }));

    expect(screen.getByText("Temporary failure")).toBeTruthy();
    expect(queryBoundaryResetMock).toHaveBeenCalledTimes(1);
    expect(routerInvalidateMock).toHaveBeenCalledTimes(1);
  });
});
