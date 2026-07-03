import { describe, expect, it } from "vitest";
import { parseCsv } from "@/lib/csv";

describe("parseCsv", () => {
  it("parses simple rows with a header", () => {
    expect(parseCsv("a,b,c\n1,2,3")).toEqual([
      ["a", "b", "c"],
      ["1", "2", "3"],
    ]);
  });

  it("handles quoted fields containing commas and newlines", () => {
    expect(parseCsv('name,notes\n"Ana Suárez","le gusta, mucho"')).toEqual([
      ["name", "notes"],
      ["Ana Suárez", "le gusta, mucho"],
    ]);
    expect(parseCsv('a\n"line1\nline2"')).toEqual([["a"], ["line1\nline2"]]);
  });

  it("unescapes doubled quotes", () => {
    expect(parseCsv('a\n"dijo ""hola"""')).toEqual([["a"], ['dijo "hola"']]);
  });

  it("handles CRLF line endings", () => {
    expect(parseCsv("a,b\r\n1,2\r\n")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });

  it("skips blank lines", () => {
    expect(parseCsv("a,b\n\n1,2\n  ,  \n")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });

  it("preserves empty trailing fields on data rows", () => {
    expect(parseCsv("a,b,c\n1,,3")).toEqual([
      ["a", "b", "c"],
      ["1", "", "3"],
    ]);
  });
});
