import { request } from "node:https";
import type { Plugin, UpdatesByCategory } from "../types";

interface JiraIssue {
  key: string;
  fields: {
    summary: string;
    status: { name: string };
    parent?: { key: string; fields: { summary: string } };
  };
}

// Narrow interface covering only the JIRA REST API endpoints this plugin calls,
// so tests can inject a lightweight stub instead of a full API specification.
interface JiraClientLike {
  searchIssues(params: {
    jql: string;
    fields: string[];
    maxResults: number;
  }): Promise<{ issues: JiraIssue[] }>;
}

function isoToJql(iso: string): string {
  // JQL date comparisons require "YYYY-MM-DD HH:mm" format.
  return iso.slice(0, 16).replace("T", " ");
}

class RealJiraClient implements JiraClientLike {
  private readonly baseUrl: string;
  private readonly authHeader: string;

  constructor(baseUrl: string, email: string, apiToken: string) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.authHeader = `Basic ${Buffer.from(`${email}:${apiToken}`).toString("base64")}`;
  }

  private readResponse<T>(
    res: import("node:http").IncomingMessage,
    resolve: (value: T) => void,
    reject: (reason: Error) => void,
  ): void {
    const chunks: Buffer[] = [];
    res.on("data", (chunk: Buffer) => chunks.push(chunk));
    res.on("end", () => {
      const body = Buffer.concat(chunks).toString();
      if (res.statusCode && res.statusCode >= 400) {
        reject(new Error(`Jira API error ${res.statusCode}: ${body}`));
        return;
      }
      try {
        resolve(JSON.parse(body) as T);
      } catch (e) {
        reject(e as Error);
      }
    });
  }

  private post<T>(path: string, body: unknown): Promise<T> {
    const payload = JSON.stringify(body);
    return new Promise((resolve, reject) => {
      const url = new URL(`${this.baseUrl}${path}`);
      const req = request(
        {
          hostname: url.hostname,
          path: url.pathname + url.search,
          method: "POST",
          headers: {
            Authorization: this.authHeader,
            "Content-Type": "application/json",
            Accept: "application/json",
            "Content-Length": Buffer.byteLength(payload),
          },
        },
        (res) => this.readResponse(res, resolve, reject),
      );
      req.on("error", reject);
      req.write(payload);
      req.end();
    });
  }

  searchIssues(params: {
    jql: string;
    fields: string[];
    maxResults: number;
  }): Promise<{ issues: JiraIssue[] }> {
    return this.post("/rest/api/3/search/jql", params);
  }
}

const ISSUE_STATE_EMOJI: Record<string, string> = {
  "In Progress": "🔄",
  QA: "✅",
  Done: "✅",
};

export class Jira implements Plugin {
  private readonly client: JiraClientLike;

  constructor(
    baseUrl: string,
    email: string,
    apiToken: string,
    client?: JiraClientLike,
  ) {
    this.client = client ?? new RealJiraClient(baseUrl, email, apiToken);
  }

  async fetchUpdatesByCategory(since: string): Promise<UpdatesByCategory> {
    const issues = await this.fetchRelevantIssues(since);

    // Group issues by parent epic summary; issues with no parent epic go under "Other".
    const updates = new Map<string, string[]>();

    for (const issue of issues) {
      const emoji = ISSUE_STATE_EMOJI[issue.fields.status.name] ?? "❓";
      const line = `${issue.key}: ${issue.fields.summary} – \`${issue.fields.status.name}\` – ${emoji}`;
      const category = issue.fields.parent
        ? `${issue.fields.parent.key}: ${issue.fields.parent.fields.summary}`
        : "Other";

      const existing = updates.get(category) ?? [];
      existing.push(line);

      updates.set(category, existing);
    }

    return updates;
  }

  private async fetchRelevantIssues(since: string): Promise<JiraIssue[]> {
    const jqlDate = isoToJql(since);

    const { issues } = await this.client.searchIssues({
      jql:
        `(assignee = currentUser() and status = "In progress") or ` +
        `(assignee was currentUser() after "${jqlDate}" and status = "QA") or ` +
        `(assignee = currentUser() and status = "Done" and (status changed after "${jqlDate}"))`,
      fields: ["summary", "status", "parent"],
      maxResults: 50,
    });

    return issues;
  }
}
