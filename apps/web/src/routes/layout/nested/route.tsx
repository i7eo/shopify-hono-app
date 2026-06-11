import { createFileRoute } from "@tanstack/react-router";
import { NestedLayoutRouteShell } from "../../../layouts/layout-routes";

export const Route = createFileRoute("/layout/nested")({
  component: NestedLayoutRouteShell,
});
