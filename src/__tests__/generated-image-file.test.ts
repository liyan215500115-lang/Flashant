import { beforeEach, describe, expect, it, vi } from "vitest";

const { openStoredObject } = vi.hoisted(() => ({
  openStoredObject: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(async () => ({ user: { id: "user_1" } })),
}));
vi.mock("@/lib/db", () => ({
  db: {
    generatedImage: {
      findUnique: vi.fn(),
    },
  },
}));
vi.mock("@/lib/s3", () => ({ openStoredObject }));

import { GET } from "@/app/api/generated-images/[id]/file/route";
import { db } from "@/lib/db";

function requestImage(id = "img_old") {
  return GET(new Request(`http://localhost/api/generated-images/${id}/file`), {
    params: Promise.resolve({ id }),
  });
}

function byteStream(bytes: number[]) {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(Uint8Array.from(bytes));
      controller.close();
    },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/generated-images/[id]/file", () => {
  it("streams the stored bytes with a matching content length", async () => {
    vi.mocked(db.generatedImage.findUnique).mockResolvedValue({
      id: "img_old",
      s3Key: "generated/lifestyle.png",
      project: { userId: "user_1" },
    } as never);
    openStoredObject.mockResolvedValue({
      stream: byteStream([1, 2, 3, 4]),
      contentType: "image/png",
      contentLength: 4,
    });

    const res = await requestImage();
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("image/png");
    expect(res.headers.get("content-length")).toBe("4");
    expect(Array.from(new Uint8Array(await res.arrayBuffer()))).toEqual([1, 2, 3, 4]);
    expect(res.headers.get("location")).toBeNull();
  });

  it("returns 409 for a provider URL and does not open storage", async () => {
    vi.mocked(db.generatedImage.findUnique).mockResolvedValue({
      id: "img_old",
      s3Key: "https://replicate.delivery/old.png",
      project: { userId: "user_1" },
    } as never);

    const res = await requestImage();
    expect(res.status).toBe(409);
    expect(openStoredObject).not.toHaveBeenCalled();
    const json = await res.json();
    expect(json.error).toBe("Image is not in storage");
  });

  it("returns 502 when the object read fails instead of rejecting the request", async () => {
    vi.mocked(db.generatedImage.findUnique).mockResolvedValue({
      id: "img_old",
      s3Key: "generated/lifestyle.png",
      project: { userId: "user_1" },
    } as never);
    openStoredObject.mockRejectedValue(new Error("socket hang up"));

    const res = await requestImage();
    expect(res.status).toBe(502);
    expect(res.headers.get("content-type")).toContain("application/json");
    const json = await res.json();
    expect(json.error).toBe("Image could not be read");
  });

  it("returns 404 when the image has no project instead of throwing", async () => {
    vi.mocked(db.generatedImage.findUnique).mockResolvedValue({
      id: "img_old",
      s3Key: "generated/lifestyle.png",
      project: null,
    } as never);

    await expect(requestImage()).resolves.toBeInstanceOf(Response);
    const res = await requestImage();
    expect(res.status).toBe(404);
    expect(openStoredObject).not.toHaveBeenCalled();
  });
});
