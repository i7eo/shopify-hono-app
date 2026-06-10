import { createFileRoute } from "@tanstack/react-router";
import { postsQueryOptions } from "@/apis/posts.query";
import { PostsLayout } from "@/layouts/posts";

export const Route = createFileRoute("/posts")({
  loader: ({ context: { queryClient } }) =>
    queryClient.ensureQueryData(postsQueryOptions),
  component: PostsLayout,
});
