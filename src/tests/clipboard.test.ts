import { EventEmitter } from "node:events";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const spawnMock = vi.hoisted(() => vi.fn());

vi.mock("node:child_process", () => ({
  spawn: spawnMock,
}));

import { copyToClipboard } from "../clipboard";

function makeChildStub() {
  const child = new EventEmitter() as EventEmitter & {
    stdin: { end: ReturnType<typeof vi.fn> };
  };
  child.stdin = { end: vi.fn() };
  return child;
}

describe("copyToClipboard", () => {
  const originalPlatform = process.platform;

  beforeEach(() => {
    spawnMock.mockReset();
  });

  afterEach(() => {
    Object.defineProperty(process, "platform", { value: originalPlatform });
  });

  it("is a no-op on non-darwin platforms", async () => {
    Object.defineProperty(process, "platform", { value: "linux" });

    await expect(copyToClipboard("hello")).resolves.toBeUndefined();
    expect(spawnMock).not.toHaveBeenCalled();
  });

  it("pipes text to pbcopy on darwin and resolves on clean exit", async () => {
    Object.defineProperty(process, "platform", { value: "darwin" });
    const child = makeChildStub();
    spawnMock.mockReturnValue(child);

    const promise = copyToClipboard("hello");
    child.emit("close", 0);
    await expect(promise).resolves.toBeUndefined();

    expect(spawnMock).toHaveBeenCalledWith("pbcopy");
    expect(child.stdin.end).toHaveBeenCalledWith("hello");
  });

  it("rejects when pbcopy exits with a non-zero code", async () => {
    Object.defineProperty(process, "platform", { value: "darwin" });
    const child = makeChildStub();
    spawnMock.mockReturnValue(child);

    const promise = copyToClipboard("hello");
    child.emit("close", 1);
    await expect(promise).rejects.toThrow("pbcopy exited with code 1");
  });

  it("rejects when pbcopy fails to spawn", async () => {
    Object.defineProperty(process, "platform", { value: "darwin" });
    const child = makeChildStub();
    spawnMock.mockReturnValue(child);

    const promise = copyToClipboard("hello");
    child.emit("error", new Error("ENOENT"));
    await expect(promise).rejects.toThrow("ENOENT");
  });
});
