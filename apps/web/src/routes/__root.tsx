import {
  createRootRouteWithContext,
  Link,
  Outlet,
} from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import type { QueryClient } from "@tanstack/react-query";

const Devtools = import.meta.env.DEV
  ? lazy(async () => {
      const [{ ReactQueryDevtools }, { TanStackRouterDevtools }] =
        await Promise.all([
          import("@tanstack/react-query-devtools"),
          import("@tanstack/react-router-devtools"),
        ]);

      return {
        default: () => (
          <>
            <ReactQueryDevtools buttonPosition="bottom-left" />
            <TanStackRouterDevtools position="bottom-right" />
          </>
        ),
      };
    })
  : undefined;

export const Route = createRootRouteWithContext<{
  queryClient: QueryClient;
}>()({
  component: RootComponent,
  notFoundComponent: () => {
    return (
      <div>
        <p>This is the notFoundComponent configured on root route</p>
        <Link to="/">Start Over</Link>
      </div>
    );
  },
});

function RootComponent() {
  return (
    <>
      <div className="flex gap-2 p-2 text-lg">
        <Link
          to="/"
          activeProps={{
            className: "font-bold",
          }}
          activeOptions={{ exact: true }}
        >
          Home
        </Link>{" "}
        <Link
          to="/posts"
          activeProps={{
            className: "font-bold",
          }}
        >
          Posts
        </Link>{" "}
        <Link
          to="/layout/nested/route-a"
          activeProps={{
            className: "font-bold",
          }}
        >
          Layout Routes
        </Link>{" "}
        <Link
          // @ts-expect-error
          to="/this-route-does-not-exist"
          activeProps={{
            className: "font-bold",
          }}
        >
          This Route Does Not Exist
        </Link>
      </div>
      <hr />
      <Outlet />
      {Devtools ? (
        <Suspense fallback={null}>
          <Devtools />
        </Suspense>
      ) : null}
    </>
  );
}
