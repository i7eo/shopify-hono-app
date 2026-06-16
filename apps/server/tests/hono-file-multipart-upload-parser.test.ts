import { describe, expect, it } from "vitest";
import { HonoFileMultipartUploadParser } from "@/app/modules/file/upload/hono-file-multipart-upload-parser";
import type { Context, HonoRequest } from "hono";

type FileFormDataEntryValue = File | string;

describe("HonoFileMultipartUploadParser", () => {
  it("parses files and files[] fields with Hono native multipart support", async () => {
    const parser = new HonoFileMultipartUploadParser();
    const context = createParserContext([
      ["files", new File(["hello"], "hello.txt", { type: "text/plain" })],
      ["files[]", new File(["world"], "world.txt", { type: "text/plain" })],
    ]);

    const files = await parser.parse(context, {
      fieldNames: ["files", "files[]"],
      maxFiles: 2,
    });

    expect(files).toHaveLength(2);
    expect(files.map((file) => file.originalName)).toEqual([
      "hello.txt",
      "world.txt",
    ]);
    await expect(new Response(files[0]!.body).text()).resolves.toBe("hello");
  });

  it("rejects uploads over maxFiles", async () => {
    const parser = new HonoFileMultipartUploadParser();
    const context = createParserContext([
      ["files", new File(["one"], "one.txt", { type: "text/plain" })],
      ["files", new File(["two"], "two.txt", { type: "text/plain" })],
    ]);

    await expect(
      parser.parse(context, {
        fieldNames: ["files"],
        maxFiles: 1,
      }),
    ).rejects.toMatchObject({
      status: 400,
      message: "Too many files",
    });
  });

  it("rejects requests without files", async () => {
    const parser = new HonoFileMultipartUploadParser();
    const context = createParserContext([["name", "export"]]);

    await expect(
      parser.parse(context, {
        fieldNames: ["files"],
        maxFiles: 1,
      }),
    ).rejects.toMatchObject({
      status: 400,
      message: "At least one file is required",
    });
  });
});

function createParserContext(
  entries: [string, FileFormDataEntryValue][],
): Context {
  const data = new FormData();

  for (const [key, value] of entries) {
    data.append(key, value);
  }

  const request = new Request("https://example.test/api/files", {
    method: "POST",
    body: data,
  });

  const req: Pick<HonoRequest, "parseBody"> = {
    parseBody: (options: { all: true }) =>
      request.formData().then((form) => {
        const body: Record<
          string,
          FileFormDataEntryValue | FileFormDataEntryValue[] | undefined
        > = {};

        for (const key of new Set(form.keys())) {
          const values = form.getAll(key);
          body[key] = options.all
            ? (values as FileFormDataEntryValue[])
            : (values.at(0) as FileFormDataEntryValue | undefined);
        }

        return body;
      }),
  };
  const context: Pick<Context, "req"> = {
    req: req as HonoRequest,
  };

  return context as Context;
}
