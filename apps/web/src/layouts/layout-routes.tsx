import { Link, Outlet } from "@tanstack/react-router";

export function LayoutRouteShell() {
  return (
    <div className="p-2">
      <div className="border-b">I'm a layout</div>
      <div>
        <Outlet />
      </div>
    </div>
  );
}

export function NestedLayoutRouteShell() {
  return (
    <div>
      <div>I'm a nested layout</div>
      <div className="flex gap-2 border-b">
        <Link
          to="/layout/nested/route-a"
          activeProps={{
            className: "font-bold",
          }}
        >
          Go to route A
        </Link>
        <Link
          to="/layout/nested/route-b"
          activeProps={{
            className: "font-bold",
          }}
        >
          Go to route B
        </Link>
      </div>
      <div>
        <Outlet />
      </div>
    </div>
  );
}
