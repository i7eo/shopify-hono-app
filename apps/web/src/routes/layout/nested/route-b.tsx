import { createFileRoute } from "@tanstack/react-router";
export const Route = createFileRoute("/layout/nested/route-b")({
  component: LayoutBComponent,
});

function LayoutBComponent() {
  return <div>I'm layout B!</div>;
}
