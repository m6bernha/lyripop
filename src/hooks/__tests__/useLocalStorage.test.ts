import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useLocalStorage } from "../useLocalStorage";

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("useLocalStorage", () => {
  it("returns the default value when nothing is stored", () => {
    const { result } = renderHook(() => useLocalStorage("k", 42));
    expect(result.current[0]).toBe(42);
  });

  it("hydrates from a previously-stored JSON value", () => {
    localStorage.setItem("k", JSON.stringify(7));
    const { result } = renderHook(() => useLocalStorage("k", 42));
    expect(result.current[0]).toBe(7);
  });

  it("falls back to the default when stored JSON is corrupt", () => {
    localStorage.setItem("k", "{not-valid-json");
    const { result } = renderHook(() => useLocalStorage("k", 42));
    expect(result.current[0]).toBe(42);
  });

  it("falls back to the default when validate() rejects the stored value", () => {
    localStorage.setItem("k", JSON.stringify("hello"));
    const isNumber = (raw: unknown): raw is number => typeof raw === "number";
    const { result } = renderHook(() => useLocalStorage("k", 42, isNumber));
    expect(result.current[0]).toBe(42);
  });

  it("accepts a stored value that passes validate()", () => {
    localStorage.setItem("k", JSON.stringify(7));
    const isNumber = (raw: unknown): raw is number => typeof raw === "number";
    const { result } = renderHook(() => useLocalStorage("k", 42, isNumber));
    expect(result.current[0]).toBe(7);
  });

  it("persists writes to localStorage", () => {
    const { result } = renderHook(() => useLocalStorage("k", 0));
    act(() => result.current[1](99));
    expect(JSON.parse(localStorage.getItem("k") ?? "null")).toBe(99);
    expect(result.current[0]).toBe(99);
  });

  it("does not crash if localStorage.setItem throws (e.g. quota)", () => {
    const { result } = renderHook(() => useLocalStorage("k", 0));
    const setItemSpy = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(() => {
        throw new Error("QuotaExceededError");
      });
    act(() => result.current[1](1));
    expect(result.current[0]).toBe(1);
    setItemSpy.mockRestore();
  });

  it("supports boolean values", () => {
    const { result } = renderHook(() => useLocalStorage("flag", false));
    expect(result.current[0]).toBe(false);
    act(() => result.current[1](true));
    expect(JSON.parse(localStorage.getItem("flag") ?? "null")).toBe(true);
  });
});
