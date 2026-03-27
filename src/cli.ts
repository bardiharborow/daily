import { fetchUpdates, formatUpdates } from "./aggregation";
import { GitHub } from "./plugins/github";
import { Jira } from "./plugins/jira";
import type { Plugin } from "./types";

export function main() {
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

  const enabledPlugins: Plugin[] = [
    new Jira(jiraBaseUrl, jiraEmail, jiraApiToken),
    new GitHub(githubToken, githubOrganization),
  ];

  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  fetchUpdates(oneDayAgo, enabledPlugins).then((updates) => {
    console.log(formatUpdates(updates));
  });
}

main();
