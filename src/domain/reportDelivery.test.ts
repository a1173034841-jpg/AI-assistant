import { describe, expect, it } from "vitest";
import { shouldRenderScenarioReport } from "./reportDelivery";

describe("report delivery hierarchy", () => {
  it("shows the executive report first and hides scenario report until a scenario is explicitly selected", () => {
    expect(shouldRenderScenarioReport(false)).toBe(false);
    expect(shouldRenderScenarioReport(true)).toBe(true);
  });
});
