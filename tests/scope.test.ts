import { describe, expect, it } from "vitest";
import { classifyScope } from "../src/scope.js";

describe("classifyScope", () => {
  it("treats empty allow as within", () => {
    expect(classifyScope("docs/a.md", [])).toBe("within");
  });

  it("matches first allow pattern", () => {
    expect(classifyScope("src/a.ts", ["src/**", "tests/**"])).toBe("within");
    expect(classifyScope("tests/x.ts", ["src/**", "tests/**"])).toBe("within");
    expect(classifyScope("docs/a.md", ["src/**", "tests/**"])).toBe("outside");
  });

  it("marks unsafe paths indeterminate", () => {
    expect(classifyScope("../escape.ts", ["src/**"])).toBe("indeterminate");
    expect(classifyScope("/abs.ts", ["src/**"])).toBe("indeterminate");
  });
});
