import { createFileRoute } from "@tanstack/react-router";
export const Route = createFileRoute("/layout/nested/route-a")({
  component: LayoutAComponent,
});

function LayoutAComponent() {
  return <div>I'm layout A!</div>;
}
