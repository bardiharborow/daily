import { mergeUpdates } from "./merge";
import { GitHub } from "./plugins/github";
import { Jira } from "./plugins/jira";
import type { Plugin, UpdatesByCategory } from "./types";

const githubToken = process.env.GITHUB_TOKEN;
if (!githubToken) {
  throw new Error("GITHUB_TOKEN environment variable is not set");
}

const githubOrganization = process.env.GITHUB_ORGANIZATION;
if (!githubOrganization) {
  throw new Error("GITHUB_ORGANIZATION environment variable is not set");
}

const jiraBaseUrl = process.env.JIRA_BASE_URL;
if (!jiraBaseUrl) {
  throw new Error("JIRA_BASE_URL environment variable is not set");
}

const jiraEmail = process.env.JIRA_EMAIL;
if (!jiraEmail) {
  throw new Error("JIRA_EMAIL environment variable is not set");
}

const jiraApiToken = process.env.JIRA_API_TOKEN;
if (!jiraApiToken) {
  throw new Error("JIRA_API_TOKEN environment variable is not set");
}

const enabled_plugins: Plugin[] = [
  new Jira(jiraBaseUrl, jiraEmail, jiraApiToken),
  new GitHub(githubToken, githubOrganization),
];

export async function fetchUpdates(since: string): Promise<UpdatesByCategory> {
  const updates = await Promise.all(
    enabled_plugins.map((plugin) => plugin.fetchUpdatesByCategory(since)),
  );

  return mergeUpdates(updates);
}

function formatUpdates(updates: UpdatesByCategory): string {
  return Array.from(updates.entries())
    .filter(([, lines]) => lines.length > 0)
    .map(([category, lines]) =>
      [category, ...lines.map((line) => `* ${line}`)].join("\n"),
    )
    .join("\n\n");
}

const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

fetchUpdates(oneDayAgo).then((updates) => {
  console.log(formatUpdates(updates));
});
