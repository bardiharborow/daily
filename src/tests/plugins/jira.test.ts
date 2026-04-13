import { beforeEach, describe, expect, it, vi } from "vitest";
import { Jira } from "../../plugins/jira";

function makeJiraStub() {
  return {
    searchIssues: vi.fn().mockResolvedValue({ issues: [] }),
  };
}

type JiraStub = ReturnType<typeof makeJiraStub>;

const SINCE = new Date("2026-03-27T10:00:00.000Z");

function makeIssue(
  overrides: Partial<{
    key: string;
    summary: string;
    statusName: string;
    parentKey: string;
    parentSummary: string;
  }> = {},
) {
  return {
    key: overrides.key ?? "PROJ-1",
    fields: {
      summary: overrides.summary ?? "Fix the thing",
      status: { name: overrides.statusName ?? "In Progress" },
      ...(overrides.parentKey !== undefined && {
        parent: {
          key: overrides.parentKey,
          fields: { summary: overrides.parentSummary },
        },
      }),
    },
  };
}

describe("Jira.fetchUpdates", () => {
  let stub: JiraStub;
  let plugin: Jira;

  beforeEach(() => {
    stub = makeJiraStub();
    plugin = new Jira(
      "https://example.atlassian.net",
      "user@example.com",
      "token",
      stub,
    );
  });

  it("returns an empty map when no issues are found", async () => {
    const result = await plugin.fetchUpdatesByCategory(SINCE);

    expect(result.size).toBe(0);
  });

  it("groups issues under their parent epic summary", async () => {
    stub.searchIssues.mockResolvedValue({
      issues: [
        makeIssue({
          key: "PROJ-1",
          summary: "Task A",
          statusName: "In Progress",
          parentKey: "EPIC-1",
          parentSummary: "My Epic",
        }),
        makeIssue({
          key: "PROJ-2",
          summary: "Task B",
          statusName: "Done",
          parentKey: "EPIC-1",
          parentSummary: "My Epic",
        }),
      ],
    });

    const result = await plugin.fetchUpdatesByCategory(SINCE);

    expect(result.get("EPIC-1: My Epic")).toEqual([
      "PROJ-1: Task A – `In Progress` – 🔄",
      "PROJ-2: Task B – `Done` – ✅",
    ]);
    expect(result.size).toBe(1);
  });

  it("places issues without a parent under 'Other'", async () => {
    stub.searchIssues.mockResolvedValue({
      issues: [
        makeIssue({
          key: "PROJ-1",
          summary: "Orphan task",
          statusName: "In Progress",
        }),
      ],
    });

    const result = await plugin.fetchUpdatesByCategory(SINCE);

    expect(result.get("Other")).toEqual([
      "PROJ-1: Orphan task – `In Progress` – 🔄",
    ]);
    expect(result.size).toBe(1);
  });

  it("creates a separate key per epic", async () => {
    stub.searchIssues.mockResolvedValue({
      issues: [
        makeIssue({
          key: "PROJ-1",
          parentKey: "EPIC-1",
          parentSummary: "Epic Alpha",
        }),
        makeIssue({
          key: "PROJ-2",
          parentKey: "EPIC-2",
          parentSummary: "Epic Beta",
        }),
      ],
    });

    const result = await plugin.fetchUpdatesByCategory(SINCE);

    expect(result.has("EPIC-1: Epic Alpha")).toBe(true);
    expect(result.has("EPIC-2: Epic Beta")).toBe(true);
    expect(result.size).toBe(2);
  });

  it("formats an 'In Progress' issue with 🔄", async () => {
    stub.searchIssues.mockResolvedValue({
      issues: [
        makeIssue({
          key: "PROJ-1",
          summary: "Task A",
          statusName: "In Progress",
        }),
      ],
    });

    const result = await plugin.fetchUpdatesByCategory(SINCE);

    expect(result.get("Other")).toEqual([
      "PROJ-1: Task A – `In Progress` – 🔄",
    ]);
  });

  it("formats an 'In Review' issue with 🔄", async () => {
    stub.searchIssues.mockResolvedValue({
      issues: [
        makeIssue({
          key: "PROJ-1",
          summary: "Task A",
          statusName: "In Review",
        }),
      ],
    });

    const result = await plugin.fetchUpdatesByCategory(SINCE);

    expect(result.get("Other")).toEqual(["PROJ-1: Task A – `In Review` – 🔄"]);
  });

  it("formats a 'QA' issue with ✅", async () => {
    stub.searchIssues.mockResolvedValue({
      issues: [
        makeIssue({ key: "PROJ-1", summary: "Task A", statusName: "QA" }),
      ],
    });

    const result = await plugin.fetchUpdatesByCategory(SINCE);

    expect(result.get("Other")).toEqual(["PROJ-1: Task A – `QA` – ✅"]);
  });

  it("formats a 'Done' issue with ✅", async () => {
    stub.searchIssues.mockResolvedValue({
      issues: [
        makeIssue({ key: "PROJ-1", summary: "Task A", statusName: "Done" }),
      ],
    });

    const result = await plugin.fetchUpdatesByCategory(SINCE);

    expect(result.get("Other")).toEqual(["PROJ-1: Task A – `Done` – ✅"]);
  });

  it("defaults an unknown status to ❓", async () => {
    stub.searchIssues.mockResolvedValue({
      issues: [
        makeIssue({ key: "PROJ-1", summary: "Task A", statusName: "Blocked" }),
      ],
    });

    const result = await plugin.fetchUpdatesByCategory(SINCE);

    expect(result.get("Other")).toEqual(["PROJ-1: Task A – `Blocked` – ❓"]);
  });

  it("trims issue titles", async () => {
    stub.searchIssues.mockResolvedValue({
      issues: [
        makeIssue({
          key: "PROJ-1",
          summary: " Task A ",
          statusName: "In Progress",
          parentKey: "EPIC-1",
          parentSummary: "My Epic",
        }),
      ],
    });

    const result = await plugin.fetchUpdatesByCategory(SINCE);

    expect(result.get("EPIC-1: My Epic")).toEqual([
      "PROJ-1: Task A – `In Progress` – 🔄",
    ]);
    expect(result.size).toBe(1);
  });
});
