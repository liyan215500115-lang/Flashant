import { afterEach, describe, expect, it, vi } from "vitest";
import { STYLE_PROMPTS } from "@/lib/ai/style-prompts";
import {
  creemApiBaseUrl,
  creemModerationMode,
  promptsForModeration,
  reduceToUserText,
  screenGenerationPrompts,
} from "@/lib/creem/moderation";
import { sharedStaticPromptFragments } from "@/lib/creem/static-fragments";
import {
  DEEPFAKE_PROHIBITION,
  NSFW_PROHIBITION,
  SUPPORT_EMAIL,
} from "@/lib/legal/copy";
import { isPublicLegalPath } from "@/lib/legal/paths";

const fragments = sharedStaticPromptFragments();
const white = STYLE_PROMPTS.find((style) => style.key === "white");

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("Creem moderation routing", () => {
  it("uses the sandbox host for a creem_test_ key", () => {
    expect(creemApiBaseUrl({ CREEM_API_KEY: "creem_test_abc" })).toBe("https://test-api.creem.io");
  });

  it("uses the live host for a live key prefix", () => {
    expect(creemApiBaseUrl({ CREEM_API_KEY: "creem_live_example" })).toBe("https://api.creem.io");
  });

  it("lets CREEM_TEST_MODE override the key prefix", () => {
    expect(creemApiBaseUrl({ CREEM_API_KEY: "creem_live_example", CREEM_TEST_MODE: "true" })).toBe(
      "https://test-api.creem.io",
    );
    expect(creemApiBaseUrl({ CREEM_API_KEY: "creem_test_abc", CREEM_TEST_MODE: "false" })).toBe(
      "https://api.creem.io",
    );
  });

  it("defaults to enforce and treats off as an explicit skip", () => {
    expect(creemModerationMode({})).toBe("enforce");
    expect(creemModerationMode({ CREEM_MODERATION: "enforce" })).toBe("enforce");
    expect(creemModerationMode({ CREEM_MODERATION: "off" })).toBe("off");
  });
});

describe("user-controlled prompt selection", () => {
  it("drops unmodified static style templates and keeps typed text", () => {
    expect(white).toBeTruthy();
    expect(promptsForModeration({ prompt: white!.promptFlux }, fragments)).toEqual([]);
    const mixed = `${white!.promptFlux} nude explicit scene`;
    const screened = promptsForModeration({ prompt: mixed }, fragments);
    expect(screened).toEqual(["nude explicit scene"]);
    expect(screened.join(" ")).not.toContain("pure white");
  });

  it("does not screen a detail prompt that is only the type key", () => {
    expect(
      promptsForModeration(
        { detailTypes: [{ key: "lifestyle", prompt: "lifestyle" }], prompt: "  " },
        fragments,
      ),
    ).toEqual([]);
  });

  it("screens typed detail text without the surrounding scene template", () => {
    const screened = promptsForModeration(
      {
        baseStyle: white!.prompt,
        detailTypes: [{ key: "lifestyle", prompt: "handmade ceramic cup" }],
      },
      fragments,
    );
    expect(screened).toEqual(["handmade ceramic cup"]);
    expect(screened.join("\n")).not.toContain("Kinfolk");
  });

  it("reduceToUserText leaves ordinary product copy intact", () => {
    expect(reduceToUserText("a red mug on an oak desk", fragments)).toBe("a red mug on an oak desk");
  });
});

describe("screenGenerationPrompts", () => {
  const env = { CREEM_API_KEY: "creem_test_unit", CREEM_MODERATION: "enforce" };

  it("allows only an allow decision", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ decision: "allow" }));
    const result = await screenGenerationPrompts({
      userId: "user_1",
      prompts: ["a red mug"],
      env,
      fetchImpl,
    });
    expect(result).toEqual({ allowed: true, decision: "allow" });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe("https://test-api.creem.io/v1/moderation/prompt");
    expect(JSON.parse(init.body).prompt).toBe("a red mug");
    expect(init.headers["x-api-key"]).toBe("creem_test_unit");
  });

  it("blocks deny and flag", async () => {
    for (const decision of ["deny", "flag"] as const) {
      const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ decision }));
      const result = await screenGenerationPrompts({
        userId: "user_1",
        prompts: ["bad prompt"],
        env,
        fetchImpl,
      });
      expect(result.allowed).toBe(false);
      expect(result.decision).toBe(decision);
    }
  });

  it("stops on the first blocked prompt and does not continue", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ decision: "allow" }))
      .mockResolvedValueOnce(jsonResponse({ decision: "flag" }));
    const result = await screenGenerationPrompts({
      userId: "user_1",
      prompts: ["ok mug", "second prompt"],
      env,
      fetchImpl,
    });
    expect(result).toEqual({ allowed: false, decision: "flag" });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("fails closed on timeout, HTTP errors, and unknown decisions", async () => {
    const timeout = vi.fn().mockRejectedValue(new DOMException("The operation was aborted", "TimeoutError"));
    const http = vi.fn().mockResolvedValue(jsonResponse({ error: "upstream" }, 503));
    const unknown = vi.fn().mockResolvedValue(jsonResponse({ decision: "maybe" }));
    for (const fetchImpl of [timeout, http, unknown]) {
      const result = await screenGenerationPrompts({
        userId: "user_1",
        prompts: ["a red mug"],
        env,
        fetchImpl,
      });
      expect(result).toEqual({ allowed: false, decision: "error" });
    }
  });

  it("fails closed when enforce is on and the key is missing", async () => {
    const fetchImpl = vi.fn();
    const result = await screenGenerationPrompts({
      userId: "user_1",
      prompts: ["a red mug"],
      env: { CREEM_MODERATION: "enforce" },
      fetchImpl,
    });
    expect(result).toEqual({ allowed: false, decision: "error" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("skips the API when there is no user text or moderation is off", async () => {
    const fetchImpl = vi.fn();
    const empty = await screenGenerationPrompts({
      userId: "user_1",
      prompts: [],
      env: {},
      fetchImpl,
    });
    const off = await screenGenerationPrompts({
      userId: "user_1",
      prompts: ["a red mug"],
      env: { CREEM_MODERATION: "off" },
      fetchImpl,
    });
    expect(empty).toEqual({ allowed: true, decision: "skipped" });
    expect(off).toEqual({ allowed: true, decision: "skipped" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe("public legal copy", () => {
  it("names the support email and the required prohibitions", () => {
    expect(SUPPORT_EMAIL).toBe("liyan215500115@gmail.com");
    expect(NSFW_PROHIBITION).toContain("NSFW");
    expect(NSFW_PROHIBITION).toContain("explicit");
    expect(NSFW_PROHIBITION).toContain("sexually suggestive");
    expect(NSFW_PROHIBITION).toContain("harmful");
    expect(DEEPFAKE_PROHIBITION).toContain("deepfake");
    expect(DEEPFAKE_PROHIBITION).toContain("face-swap");
  });

  it("treats the legal pages as public, including the /aup alias", () => {
    expect(isPublicLegalPath("/privacy")).toBe(true);
    expect(isPublicLegalPath("/terms/")).toBe(true);
    expect(isPublicLegalPath("/acceptable-use")).toBe(true);
    expect(isPublicLegalPath("/contact")).toBe(true);
    expect(isPublicLegalPath("/aup")).toBe(true);
    expect(isPublicLegalPath("/studio")).toBe(false);
  });
});
