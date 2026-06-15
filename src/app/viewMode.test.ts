import { describe, expect, test } from "vitest";
import { getAppViewMode } from "./viewMode";

describe("getAppViewMode", () => {
  test("routes portfolio query parameter to the portfolio deck", () => {
    expect(getAppViewMode("?view=portfolio")).toBe("portfolio");
  });

  test("keeps the workbench as the default view", () => {
    expect(getAppViewMode("")).toBe("workbench");
    expect(getAppViewMode("?screen=drilldown")).toBe("workbench");
  });
});
