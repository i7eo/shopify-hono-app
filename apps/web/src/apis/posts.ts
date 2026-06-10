import { httpClient, HttpRequestError } from "@shamt/oh-my-fetch";

export type PostType = {
  id: string;
  title: string;
  body: string;
};

export class PostNotFoundError extends Error {
  override name = "PostNotFoundError";
}

export const fetchPost = async (postId: string) => {
  console.info(`Fetching post with id ${postId}...`);
  await new Promise((r) => setTimeout(r, 500));
  const post = await httpClient
    .get<PostType>(`https://jsonplaceholder.typicode.com/posts/${postId}`)
    .catch((error) => {
      if (error instanceof HttpRequestError && error.status === 404) {
        throw new PostNotFoundError(`Post with id "${postId}" not found!`);
      }
      throw error;
    });

  return post;
};

export const fetchPosts = async () => {
  console.info("Fetching posts...");
  await new Promise((r) => setTimeout(r, 500));
  const posts = await httpClient.get<Array<PostType>>(
    "https://jsonplaceholder.typicode.com/posts",
  );

  return posts.slice(0, 10);
};
