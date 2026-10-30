import { formatChatCompletionHttpError } from "@/llm/apiErrorMessage";

describe("formatChatCompletionHttpError", () => {
  it("extracts nested error.message from JSON", () => {
    const msg = formatChatCompletionHttpError(
      401,
      JSON.stringify({ error: { message: "Invalid API Key", type: "invalid_request_error" } }),
    );

    expect(msg).toContain("401");
    expect(msg).toContain("Invalid API Key");
  });

  it("falls back to generic message when body is not parseable and too long to show raw", () => {
    const msg = formatChatCompletionHttpError(500, "x".repeat(600));

    expect(msg).toContain("500");
    expect(msg).toContain("请检查 API Key");
  });

  it("uses top-level message when present", () => {
    const msg = formatChatCompletionHttpError(400, JSON.stringify({ message: "bad request" }));

    expect(msg).toContain("400");
    expect(msg).toContain("bad request");
  });
});
