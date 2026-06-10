import { createFileRoute } from "@tanstack/react-router";
import { LayoutRouteShell } from "../../layouts/layout-routes";

export const Route = createFileRoute("/layout")({
  component: LayoutRouteShell,
});
