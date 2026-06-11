import { z } from "zod";
import { client, HttpRequestError } from "@/utils/client";

const postSchema = z.object({
  id: z.coerce.string(),
  title: z.string(),
  body: z.string(),
});

const postsSchema = z.array(postSchema);

export type PostType = z.infer<typeof postSchema>;

export class PostNotFoundError extends Error {
  override name = "PostNotFoundError";
}

/**
 * Fetches one demo post and validates the response shape.
 */
export const fetchPost = async (postId: string) => {
  console.info(`Fetching post with id ${postId}...`);
  await new Promise((r) => setTimeout(r, 500));
  const post = await client
    .get(`https://jsonplaceholder.typicode.com/posts/${postId}`, {
      responseSchema: postSchema,
    })
    .catch((error) => {
      if (error instanceof HttpRequestError && error.status === 404) {
        throw new PostNotFoundError(`Post with id "${postId}" not found!`);
      }
      throw error;
    });

  return post;
};

/**
 * Fetches demo posts and returns the small subset used by the sample route.
 */
export const fetchPosts = async () => {
  console.info("Fetching posts...");
  await new Promise((r) => setTimeout(r, 500));
  const posts = await client.get("https://jsonplaceholder.typicode.com/posts", {
    responseSchema: postsSchema,
  });

  return posts.slice(0, 10);
};
