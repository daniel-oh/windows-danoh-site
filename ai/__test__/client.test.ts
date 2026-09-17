/**
 * @jest-environment node
 */
import { getBestModel, getCheapestModel, requestTuning } from "@/ai/client";

describe("model selection", () => {
  it("uses current, undated model ids", () => {
    expect(getBestModel("anthropic")).toBe("claude-sonnet-5");
    expect(getCheapestModel("anthropic")).toBe("claude-haiku-4-5");
    for (const id of [getBestModel("anthropic"), getCheapestModel("anthropic")]) {
      expect(id).not.toMatch(/-\d{8}$/); // no date suffix
    }
  });
});

// The two models accept DIFFERENT request fields. Sending Sonnet's to Haiku,
// or a sampling parameter to Sonnet, is a 400 in production.
describe("requestTuning", () => {
  it("best model: adaptive thinking, effort by task", () => {
    expect(requestTuning("claude-sonnet-5", "generate")).toEqual({
      thinking: { type: "adaptive" },
      output_config: { effort: "medium" },
    });
    expect(requestTuning("claude-sonnet-5", "converse")).toEqual({
      thinking: { type: "adaptive" },
      output_config: { effort: "low" },
    });
  });

  it("cheap model: no thinking or effort fields at all (Haiku 4.5 rejects effort)", () => {
    expect(requestTuning("claude-haiku-4-5", "generate")).toEqual({});
    expect(requestTuning("claude-haiku-4-5", "converse")).toEqual({});
  });

  it("never emits a sampling parameter or a thinking budget", () => {
    for (const model of ["claude-sonnet-5", "claude-haiku-4-5"]) {
      for (const task of ["generate", "converse"] as const) {
        const json = JSON.stringify(requestTuning(model, task));
        expect(json).not.toMatch(/temperature|top_p|top_k|budget_tokens/);
      }
    }
  });
});
