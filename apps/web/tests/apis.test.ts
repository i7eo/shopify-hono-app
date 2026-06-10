import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getMock = vi.hoisted(() => vi.fn());
const extendMock = vi.hoisted(() => vi.fn(() => ({ get: getMock })));
const createHttpClientMock = vi.hoisted(() =>
  vi.fn(() => ({
    extend: extendMock,
    get: getMock,
  })),
);

vi.mock("@shamt/oh-my-fetch/client", () => {
  return {
    createHttpClient: createHttpClientMock,
  };
});

vi.mock("@shamt/oh-my-fetch/errors", () => {
  class HttpRequestError extends Error {
    status?: number;

    constructor(message: string, options: { status?: number } = {}) {
      super(message);
      this.name = "HttpRequestError";
      this.status = options.status;
    }
  }

  return {
    HttpRequestError,
    httpClient: {
      get: getMock,
    },
  };
});

describe("http clients", () => {
  beforeEach(() => {
    vi.resetModules();
    createHttpClientMock.mockClear();
    extendMock.mockClear();
  });

  it("creates the base client with shared defaults", async () => {
    const { DEFAULT_REQUEST_TIMEOUT } = await import("../src/utils/public-env");
    const { createClient } = await import("../src/utils/client");

    createHttpClientMock.mockClear();
    createClient();

    expect(createHttpClientMock).toHaveBeenCalledWith({
      timeout: DEFAULT_REQUEST_TIMEOUT,
      retry: { limit: 0 },
    });
  });

  it("creates the API client from a base client and API prefix", async () => {
    const { DEFAULT_APP_API_PREFIX } = await import("../src/utils/public-env");
    const { createApiClient } = await import("../src/utils/client");
    const baseClient = {
      extend: extendMock,
      get: getMock,
    };

    createApiClient(baseClient as never);

    expect(extendMock).toHaveBeenCalledWith({
      prefix: `/${DEFAULT_APP_API_PREFIX}`,
    });
  });
});

describe("posts api", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(console, "info").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("fetches a post after the demo delay", async () => {
    const { fetchPost } = await import("../src/apis/posts");
    getMock.mockResolvedValueOnce({ id: "1", title: "Hello", body: "World" });

    const postPromise = fetchPost("1");
    await vi.advanceTimersByTimeAsync(500);

    await expect(postPromise).resolves.toEqual({
      id: "1",
      title: "Hello",
      body: "World",
    });
    expect(console.info).toHaveBeenCalledWith("Fetching post with id 1...");
    expect(getMock).toHaveBeenCalledWith(
      "https://jsonplaceholder.typicode.com/posts/1",
      expect.objectContaining({
        responseSchema: expect.anything(),
      }),
    );
  });

  it("turns 404 request errors into PostNotFoundError", async () => {
    const { HttpRequestError } = await import("../src/utils/client");
    const { fetchPost, PostNotFoundError } = await import("../src/apis/posts");
    getMock.mockRejectedValueOnce(
      new HttpRequestError("missing", { status: 404 }),
    );

    const postPromise = fetchPost("missing-post");
    const handledPostPromise = postPromise.catch((error) => error);
    await vi.advanceTimersByTimeAsync(500);
    const error = await handledPostPromise;

    expect(error).toBeInstanceOf(PostNotFoundError);
    expect(error.message).toBe('Post with id "missing-post" not found!');
  });

  it("rethrows non-404 request errors", async () => {
    const { HttpRequestError } = await import("../src/utils/client");
    const { fetchPost } = await import("../src/apis/posts");
    const error = new HttpRequestError("server exploded", { status: 500 });
    getMock.mockRejectedValueOnce(error);

    const postPromise = fetchPost("500");
    const handledPostPromise = postPromise.catch((caughtError) => caughtError);
    await vi.advanceTimersByTimeAsync(500);

    await expect(handledPostPromise).resolves.toBe(error);
  });

  it("fetches and trims the posts list", async () => {
    const { fetchPosts } = await import("../src/apis/posts");
    const posts = Array.from({ length: 12 }, (_, index) => ({
      id: String(index + 1),
      title: `Post ${index + 1}`,
      body: `Body ${index + 1}`,
    }));
    getMock.mockResolvedValueOnce(posts);

    const postsPromise = fetchPosts();
    await vi.advanceTimersByTimeAsync(500);

    await expect(postsPromise).resolves.toEqual(posts.slice(0, 10));
    expect(console.info).toHaveBeenCalledWith("Fetching posts...");
    expect(getMock).toHaveBeenCalledWith(
      "https://jsonplaceholder.typicode.com/posts",
      expect.objectContaining({
        responseSchema: expect.anything(),
      }),
    );
  });

  it("names PostNotFoundError instances", async () => {
    const { PostNotFoundError } = await import("../src/apis/posts");

    expect(new PostNotFoundError("Nope").name).toBe("PostNotFoundError");
  });
});

describe("posts query options", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(console, "info").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("describes the posts query", async () => {
    const { postsQueryOptions } = await import("../src/apis/posts.query");
    const posts = [{ id: "1", title: "One", body: "Body" }];
    getMock.mockResolvedValueOnce(posts);

    expect(postsQueryOptions.queryKey).toEqual(["posts"]);
    expect(typeof postsQueryOptions.queryFn).toBe("function");

    //@ts-ignore
    const postsPromise = postsQueryOptions.queryFn();
    await vi.advanceTimersByTimeAsync(500);

    await expect(postsPromise).resolves.toEqual(posts);
  });

  it("describes a single post query", async () => {
    const { postQueryOptions } = await import("../src/apis/posts.query");
    const post = { id: "42", title: "Answer", body: "Body" };
    getMock.mockResolvedValueOnce(post);

    const options = postQueryOptions("42");

    expect(options.queryKey).toEqual(["posts", { postId: "42" }]);
    expect(typeof options.queryFn).toBe("function");

    //@ts-ignore
    const postPromise = options.queryFn();
    await vi.advanceTimersByTimeAsync(500);

    await expect(postPromise).resolves.toEqual(post);
  });
});

describe("shopify api auth redirects", () => {
  beforeEach(() => {
    vi.resetModules();
    getMock.mockReset();
    createHttpClientMock.mockClear();
    extendMock.mockClear();
    vi.doMock("@/utils/public-env", () => ({
      DEFAULT_APP_API_PREFIX: "api",
      DEFAULT_REQUEST_TIMEOUT: 180_000,
      isEmbeddedShopifyApp: () => false,
      isStandaloneShopifyAppMode: () => true,
    }));
    vi.spyOn(globalThis, "open").mockImplementation(() => null);
    globalThis.history.pushState({}, "", "/?shop=shop.myshopify.com");
  });

  afterEach(() => {
    vi.doUnmock("@/utils/public-env");
  });

  it("throttles repeated auth redirects for the same shop", async () => {
    const { HttpRequestError } = await import("../src/utils/client");
    const { fetchShopInfo, ShopifyAuthRedirectError } =
      await import("../src/apis/shopify");
    getMock.mockRejectedValue(
      new HttpRequestError("unauthorized", { status: 401 }),
    );

    await expect(
      fetchShopInfo(new AbortController().signal),
    ).rejects.toBeInstanceOf(ShopifyAuthRedirectError);
    await expect(
      fetchShopInfo(new AbortController().signal),
    ).rejects.toBeInstanceOf(ShopifyAuthRedirectError);

    expect(globalThis.open).toHaveBeenCalledOnce();

    globalThis.history.pushState({}, "", "/?shop=next.myshopify.com");

    await expect(
      fetchShopInfo(new AbortController().signal),
    ).rejects.toBeInstanceOf(ShopifyAuthRedirectError);

    expect(globalThis.open).toHaveBeenCalledTimes(2);
  });

  it("resets auth redirect throttling after a successful API request", async () => {
    const { HttpRequestError } = await import("../src/utils/client");
    const { fetchProducts, fetchShopInfo, ShopifyAuthRedirectError } =
      await import("../src/apis/shopify");
    const error = new HttpRequestError("unauthorized", { status: 401 });
    getMock.mockRejectedValueOnce(error);
    getMock.mockResolvedValueOnce({ data: { products: { edges: [] } } });
    getMock.mockRejectedValueOnce(error);

    await expect(
      fetchShopInfo(new AbortController().signal),
    ).rejects.toBeInstanceOf(ShopifyAuthRedirectError);
    await expect(fetchProducts(new AbortController().signal)).resolves.toEqual({
      data: { products: { edges: [] } },
    });
    await expect(
      fetchShopInfo(new AbortController().signal),
    ).rejects.toBeInstanceOf(ShopifyAuthRedirectError);

    expect(globalThis.open).toHaveBeenCalledTimes(2);
  });
});
