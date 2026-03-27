# daily

An application to generate daily reports of activity from external services and provide a daily report. The project is currently focused on providing daily activity reports for a single JIRA and GitHub user.

## Usage

Set the required environment variables:

| Variable        | Plugin |
|-----------------|-------|
| `GITHUB_TOKEN`        | GitHub |
| `GITHUB_ORGANIZATION` | GitHub |
| `JIRA_BASE_URL` | Jira  |
| `JIRA_EMAIL`    | Jira  |
| `JIRA_API_TOKEN`| Jira  |

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
