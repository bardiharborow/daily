import { beforeEach, describe, expect, it, vi } from "vitest";
import type { OctokitLike } from "../../plugins/github";
import { GitHub } from "../../plugins/github";

function makeOctokitStub() {
  return {
    rest: {
      users: {
        getAuthenticated: vi
          .fn<OctokitLike["rest"]["users"]["getAuthenticated"]>()
          .mockResolvedValue({
            data: { login: "username" },
          }),
      },
      search: {
        issuesAndPullRequests: vi
          .fn<OctokitLike["rest"]["search"]["issuesAndPullRequests"]>()
          .mockResolvedValue({
            data: { items: [] },
          }),
      },
      pulls: {
        listReviews: vi
          .fn<OctokitLike["rest"]["pulls"]["listReviews"]>()
          .mockResolvedValue({
            data: [],
          }),
      },
    },
  };
}

type OctokitStub = ReturnType<typeof makeOctokitStub>;

function makePr(
  overrides: Partial<{
    title: string;
    number: number;
    repository_url: string;
  }> = {},
) {
  return {
    title: "Fix the thing",
    number: 42,
    repository_url: "https://api.github.com/repos/organization/repository",
    ...overrides,
  };
}

function makeReview(
  login: string,
  state: string,
  submitted_at = "2024-01-01T12:00:00.000Z",
) {
  return { user: { login }, state, submitted_at };
}

describe("GitHub.fetchUpdates", () => {
  let stub: OctokitStub;
  let plugin: GitHub;

  beforeEach(() => {
    stub = makeOctokitStub();
    plugin = new GitHub("token", "organization", stub);
  });

  it("returns a map with key 'Code Review'", async () => {
    const result = await plugin.fetchUpdatesByCategory(
      new Date("2024-01-01T00:00:00.000Z"),
    );

    expect(result.has("Code Review")).toBe(true);
  });

  it("returns an empty array when no PRs are found", async () => {
    const result = await plugin.fetchUpdatesByCategory(
      new Date("2024-01-01T00:00:00.000Z"),
    );

    expect(result.get("Code Review")).toEqual([]);
  });

  it("formats an APPROVED review with ✅", async () => {
    stub.rest.search.issuesAndPullRequests.mockResolvedValue({
      data: { items: [makePr({ title: "My PR", number: 7 })] },
    });
    stub.rest.pulls.listReviews.mockResolvedValue({
      data: [makeReview("username", "APPROVED")],
    });

    const result = await plugin.fetchUpdatesByCategory(
      new Date("2024-01-01T00:00:00.000Z"),
    );

    expect(stub.rest.pulls.listReviews).toHaveBeenCalledWith({
      owner: "organization",
      repo: "repository",
      pull_number: 7,
    });
    expect(result.get("Code Review")).toEqual(["✅ My PR (#7)"]);
  });

  it("formats a CHANGES_REQUESTED review with ❌", async () => {
    stub.rest.search.issuesAndPullRequests.mockResolvedValue({
      data: { items: [makePr({ title: "My PR", number: 7 })] },
    });
    stub.rest.pulls.listReviews.mockResolvedValue({
      data: [makeReview("username", "CHANGES_REQUESTED")],
    });

    const result = await plugin.fetchUpdatesByCategory(
      new Date("2024-01-01T00:00:00.000Z"),
    );

    expect(stub.rest.pulls.listReviews).toHaveBeenCalledWith({
      owner: "organization",
      repo: "repository",
      pull_number: 7,
    });
    expect(result.get("Code Review")).toEqual(["❌ My PR (#7)"]);
  });

  it("formats a COMMENTED review with 💬", async () => {
    stub.rest.search.issuesAndPullRequests.mockResolvedValue({
      data: { items: [makePr({ title: "My PR", number: 7 })] },
    });
    stub.rest.pulls.listReviews.mockResolvedValue({
      data: [makeReview("username", "COMMENTED")],
    });

    const result = await plugin.fetchUpdatesByCategory(
      new Date("2024-01-01T00:00:00.000Z"),
    );

    expect(stub.rest.pulls.listReviews).toHaveBeenCalledWith({
      owner: "organization",
      repo: "repository",
      pull_number: 7,
    });
    expect(result.get("Code Review")).toEqual(["💬 My PR (#7)"]);
  });

  it("defaults an unknown review state to 💬", async () => {
    stub.rest.search.issuesAndPullRequests.mockResolvedValue({
      data: { items: [makePr({ title: "My PR", number: 7 })] },
    });
    stub.rest.pulls.listReviews.mockResolvedValue({
      data: [makeReview("username", "DISMISSED")],
    });

    const result = await plugin.fetchUpdatesByCategory(
      new Date("2024-01-01T00:00:00.000Z"),
    );

    expect(stub.rest.pulls.listReviews).toHaveBeenCalledWith({
      owner: "organization",
      repo: "repository",
      pull_number: 7,
    });
    expect(result.get("Code Review")).toEqual(["💬 My PR (#7)"]);
  });

  it("trims the PR title", async () => {
    stub.rest.search.issuesAndPullRequests.mockResolvedValue({
      data: { items: [makePr({ title: " My PR ", number: 7 })] },
    });
    stub.rest.pulls.listReviews.mockResolvedValue({
      data: [makeReview("username", "CHANGES_REQUESTED")],
    });

    const result = await plugin.fetchUpdatesByCategory(
      new Date("2024-01-01T00:00:00.000Z"),
    );

    expect(stub.rest.pulls.listReviews).toHaveBeenCalledWith({
      owner: "organization",
      repo: "repository",
      pull_number: 7,
    });
    expect(result.get("Code Review")).toEqual(["❌ My PR (#7)"]);
  });

  it("produces one line per PR in search order", async () => {
    stub.rest.search.issuesAndPullRequests.mockResolvedValue({
      data: {
        items: [
          makePr({ title: "PR One", number: 1 }),
          makePr({ title: "PR Two", number: 2 }),
        ],
      },
    });
    stub.rest.pulls.listReviews
      .mockResolvedValueOnce({ data: [makeReview("username", "APPROVED")] })
      .mockResolvedValueOnce({
        data: [makeReview("username", "CHANGES_REQUESTED")],
      });

    const result = await plugin.fetchUpdatesByCategory(
      new Date("2024-01-01T00:00:00.000Z"),
    );

    expect(stub.rest.pulls.listReviews).toHaveBeenCalledWith({
      owner: "organization",
      repo: "repository",
      pull_number: 1,
    });
    expect(stub.rest.pulls.listReviews).toHaveBeenCalledWith({
      owner: "organization",
      repo: "repository",
      pull_number: 2,
    });
    expect(result.get("Code Review")).toEqual([
      "✅ PR One (#1)",
      "❌ PR Two (#2)",
    ]);
  });

  it("includes a correctly scoped search query", async () => {
    stub.rest.search.issuesAndPullRequests.mockResolvedValue({
      data: { items: [] },
    });

    await plugin.fetchUpdatesByCategory(new Date("2024-01-01T00:00:00.000Z"));

    const { q } = stub.rest.search.issuesAndPullRequests.mock.calls[0][0] as {
      q: string;
    };
    expect(q).toEqual(
      "is:pr org:organization reviewed-by:username -author:username updated:>2024-01-01T00:00:00.000Z",
    );
  });

  it("filters reviews to the authenticated user only", async () => {
    stub.rest.search.issuesAndPullRequests.mockResolvedValue({
      data: { items: [makePr({ title: "My PR", number: 7 })] },
    });
    stub.rest.pulls.listReviews.mockResolvedValue({
      data: [
        makeReview("other-user", "APPROVED"),
        makeReview("username", "CHANGES_REQUESTED"),
      ],
    });

    const result = await plugin.fetchUpdatesByCategory(
      new Date("2024-01-01T00:00:00.000Z"),
    );

    expect(stub.rest.pulls.listReviews).toHaveBeenCalledWith({
      owner: "organization",
      repo: "repository",
      pull_number: 7,
    });
    expect(result.get("Code Review")).toEqual(["❌ My PR (#7)"]);
  });

  it("uses the latest review when the user has reviewed a PR multiple times", async () => {
    stub.rest.search.issuesAndPullRequests.mockResolvedValue({
      data: { items: [makePr({ title: "My PR", number: 7 })] },
    });
    stub.rest.pulls.listReviews.mockResolvedValue({
      data: [
        makeReview("username", "CHANGES_REQUESTED", "2024-01-01T10:00:00.000Z"),
        makeReview("username", "APPROVED", "2024-01-01T11:00:00.000Z"),
      ],
    });

    const result = await plugin.fetchUpdatesByCategory(
      new Date("2024-01-01T00:00:00.000Z"),
    );

    expect(stub.rest.pulls.listReviews).toHaveBeenCalledWith({
      owner: "organization",
      repo: "repository",
      pull_number: 7,
    });
    expect(result.get("Code Review")).toEqual(["✅ My PR (#7)"]);
  });

  it("omits a PR when no reviews exist from the authenticated user", async () => {
    stub.rest.search.issuesAndPullRequests.mockResolvedValue({
      data: { items: [makePr({ title: "My PR", number: 7 })] },
    });
    stub.rest.pulls.listReviews.mockResolvedValue({
      data: [makeReview("someone-else", "APPROVED")],
    });

    const result = await plugin.fetchUpdatesByCategory(
      new Date("2024-01-01T00:00:00.000Z"),
    );

    expect(stub.rest.pulls.listReviews).toHaveBeenCalledWith({
      owner: "organization",
      repo: "repository",
      pull_number: 7,
    });
    expect(result.get("Code Review")).toEqual([]);
  });

  it("omits a PR when there are no reviews at all", async () => {
    stub.rest.search.issuesAndPullRequests.mockResolvedValue({
      data: { items: [makePr({ title: "My PR", number: 7 })] },
    });
    stub.rest.pulls.listReviews.mockResolvedValue({ data: [] });

    const result = await plugin.fetchUpdatesByCategory(
      new Date("2024-01-01T00:00:00.000Z"),
    );

    expect(stub.rest.pulls.listReviews).toHaveBeenCalledWith({
      owner: "organization",
      repo: "repository",
      pull_number: 7,
    });
    expect(result.get("Code Review")).toEqual([]);
  });

  it("omits a PR when the authenticated user's review is outside the window", async () => {
    stub.rest.search.issuesAndPullRequests.mockResolvedValue({
      data: { items: [makePr({ title: "My PR", number: 7 })] },
    });
    stub.rest.pulls.listReviews.mockResolvedValue({
      data: [makeReview("username", "APPROVED", "2023-12-31T23:59:59.000Z")],
    });

    const result = await plugin.fetchUpdatesByCategory(
      new Date("2024-01-01T00:00:00.000Z"),
    );

    expect(stub.rest.pulls.listReviews).toHaveBeenCalledWith({
      owner: "organization",
      repo: "repository",
      pull_number: 7,
    });
    expect(result.get("Code Review")).toEqual([]);
  });

  it("throws when repository_url does not include both owner and repo", async () => {
    stub.rest.search.issuesAndPullRequests.mockResolvedValue({
      data: {
        items: [
          makePr({
            // Malformed URL for a repository.
            repository_url: "https://api.github.com/repos/organization",
          }),
        ],
      },
    });

    const promise = plugin.fetchUpdatesByCategory(
      new Date("2024-01-01T00:00:00.000Z"),
    );

    await expect(promise).rejects.toThrow(
      "Unable to determine repository owner or repo from repository_url: https://api.github.com/repos/organization",
    );
    expect(stub.rest.pulls.listReviews).not.toHaveBeenCalled();
  });
});
