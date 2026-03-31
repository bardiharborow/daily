# daily

An application to generate daily reports of activity from external services and provide a daily report. The project is currently focused on providing daily activity reports for a single JIRA and GitHub user.

## Usage

Copy `.env.example` to `.env` and fill in the required environment variables:

| Variable              | Plugin | Description                                               |
|-----------------------|--------|-----------------------------------------------------------|
| `GITHUB_TOKEN`        | GitHub | A GitHub personal access token with certain scopes.       |
| `GITHUB_ORGANIZATION` | GitHub | The GitHub organization slug to query (e.g. `my-org`).    |
| `JIRA_CLOUD_ID`       | Jira   | A UUID representing your JIRA instance.                   |
| `JIRA_EMAIL`          | Jira   | The email address associated with your Atlassian account. |
| `JIRA_API_TOKEN`      | Jira   | An Atlassian API token with certain scopes.               |

### Creating a GitHub token

1. Go to **GitHub → Settings → Developer settings → Personal access tokens → [Fine-grained tokens](https://github.com/settings/personal-access-tokens)**.
2. Click **Generate new token**.
3. Give the token a name, select the organization you want to query as the resource owner, and set an expiration date.
4. Choose repository access, generally **All repositories** is recommended, but you can select specific repositories if you prefer.
3. Add repository permission for **Pull requests** (read-only).
4. Click **Generate token**.
4. Copy the generated token into the `GITHUB_TOKEN` environment variable.

### Creating a Jira API token

1. Go to **Atlassian → Account Settings → Security → [API Tokens](https://id.atlassian.com/manage-profile/security/api-tokens)**.
2. Click **Create API token with scopes**.
3. Give the token a name and an expiry date, then click **Next**.
4. Select **JIRA** as the API token application, then click **Next**.
5. Select the following scopes: `read:issue-details:jira`, `read:field.default-value:jira`, `read:field.option:jira`, `read:field:jira`, `read:group:jira`.
6. Copy the generated token into the `JIRA_API_TOKEN` environment variable.
7. Set the `JIRA_EMAIL` environment variable to the email address of your Atlassian account.
8. Go to `https://<my-site-name>.atlassian.net/_edge/tenant_info`.
9. Copy the value of the `cloudId` key into the `JIRA_CLOUD_ID` environment variable.

### Installation

Then run:

```shell
npm install
npm start
```

## Example output

```
PROG-1: JIRA Epic
* PROG-2: JIRA Bug – `QA` – ✅

Code Review
* ✅ GitHub PR (#123)
* 💬 GitHub PR (#456)

```

## Contributing

```
npm run format
npm test
```

## Licence

This project is licensed under the terms of [the MIT License](LICENSE).
