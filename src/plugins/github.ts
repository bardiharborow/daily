import type { Endpoints } from "@octokit/types";
import { Octokit } from "octokit";
import type { Plugin, UpdatesByCategory } from "../types";

type PullRequestReview =
  Endpoints["GET /repos/{owner}/{repo}/pulls/{pull_number}/reviews"]["response"]["data"][number];

// Narrow type covering only the Octokit methods this plugin calls,
// so tests can inject a lightweight stub instead of a full Octokit instance.
export type OctokitLike = {
  rest: {
    users: {
      getAuthenticated(): Promise<{
        data: Pick<Endpoints["GET /user"]["response"]["data"], "login">;
      }>;
    };
    search: {
      issuesAndPullRequests(
        params: Endpoints["GET /search/issues"]["parameters"],
      ): Promise<{
        data: {
          items: Array<
            Pick<
              Endpoints["GET /search/issues"]["response"]["data"]["items"][number],
              "title" | "number" | "repository_url"
            >
          >;
        };
      }>;
    };
    pulls: {
      listReviews(
        params: Endpoints["GET /repos/{owner}/{repo}/pulls/{pull_number}/reviews"]["parameters"],
      ): Promise<{
        data: Array<
          Pick<PullRequestReview, "state" | "submitted_at"> & {
            user: Pick<NonNullable<PullRequestReview["user"]>, "login"> | null;
          }
        >;
      }>;
    };
  };
};

const REVIEW_STATE_EMOJI: Record<string, string> = {
  APPROVED: "✅",
  CHANGES_REQUESTED: "❌",
  COMMENTED: "💬",
};

export class GitHub implements Plugin {
  private static readonly CATEGORY = "Code Review";

  private readonly organization: string;
  private readonly octokit: OctokitLike;

  constructor(auth_token: string, organization: string, octokit?: OctokitLike) {
    this.organization = organization;
    this.octokit = octokit ?? new Octokit({ auth: auth_token });
  }

  async fetchUpdatesByCategory(since: Date): Promise<UpdatesByCategory> {
    const reviewedPullRequests = await this.fetchPullRequestReviews(since);

    const updates = reviewedPullRequests.map(
      ({ pullRequestTitle, pullRequestNumber, reviewState }) => {
        const emoji = REVIEW_STATE_EMOJI[reviewState] ?? "💬";

        return `${emoji} ${pullRequestTitle} (#${pullRequestNumber})`;
      },
    );

    return new Map<string, Array<string>>([[GitHub.CATEGORY, updates]]);
  }

  private static getOwnerAndNameFromRepositoryURL(repository_url: string): {
    owner: string;
    repo: string;
  } {
    let pathSegments: string[];

    try {
      pathSegments = new URL(repository_url).pathname
        .split("/")
        .filter(Boolean);
    } catch {
      throw new Error(
        `Unable to determine repository owner or repo from repository_url: ${repository_url}`,
      );
    }

    if (
      pathSegments.length < 3 ||
      pathSegments[pathSegments.length - 3] !== "repos"
    ) {
      throw new Error(
        `Unable to determine repository owner or repo from repository_url: ${repository_url}`,
      );
    }

    const owner = pathSegments[pathSegments.length - 2];
    const repo = pathSegments[pathSegments.length - 1];

    if (!owner || !repo) {
      throw new Error(
        `Unable to determine repository owner or repo from repository_url: ${repository_url}`,
      );
    }

    return { owner, repo };
  }

  private async fetchPullRequestReviews(since: Date): Promise<
    Array<{
      pullRequestTitle: string;
      pullRequestNumber: number;
      reviewState: string;
    }>
  > {
    // Determine the current active user.
    const {
      data: { login: authUserLogin },
    } = await this.octokit.rest.users.getAuthenticated();

    // Search for pull requests reviewed by the current active user that have
    // been updated since the specified time.
    const {
      data: { items: prs },
    } = await this.octokit.rest.search.issuesAndPullRequests({
      q: `is:pr org:${this.organization} reviewed-by:${authUserLogin} -author:${authUserLogin} updated:>${since.toISOString()}`,
      sort: "updated",
    });

    const results = await Promise.all(
      prs.map(async ({ title, number, repository_url }) => {
        const { owner, repo } =
          GitHub.getOwnerAndNameFromRepositoryURL(repository_url);

        const { data: reviews } = await this.octokit.rest.pulls.listReviews({
          owner,
          repo,
          pull_number: number,
        });

        // Only consider reviews left by the authenticated user in the requested time window.
        const myReviews = reviews.filter((review) => {
          if (review.user?.login !== authUserLogin || !review.submitted_at) {
            return false;
          }

          return new Date(review.submitted_at) >= since;
        });

        // Skip PRs where the authenticated user has left no in-window review.
        if (myReviews.length === 0) return null;

        // Use the most recent in-window review state when the user has reviewed multiple times.
        const latestReview = myReviews.reduce((latest, review) => {
          if (!latest.submitted_at || !review.submitted_at) {
            return latest;
          }

          return Date.parse(review.submitted_at) >
            Date.parse(latest.submitted_at)
            ? review
            : latest;
        });
        const reviewState: string = latestReview.state;

        return {
          pullRequestTitle: title.trim(),
          pullRequestNumber: number,
          reviewState,
        };
      }),
    );

    return results.filter((r): r is NonNullable<typeof r> => r !== null);
  }
}
