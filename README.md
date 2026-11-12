# GitMerge

**GitLab merge requests & GitHub pull requests from VS Code**

**Author:** Joyal James

---

## Features

### Create Merge Request / Pull Request

- Create an MR or PR directly from VS Code (remote is auto-detected when possible).
- Auto-fill source branch, title, and common target branches (`master`, `dev`, `develop`).
- Assignees, reviewers, and labels (GitLab + GitHub).
- GitLab-only options: delete source branch and squash on merge.

### My Merge Requests

- Lists open merge/pull requests you created for the current repo.
- Open or copy URLs; conflict hint when the platform reports conflicts.

---

## Settings

| Setting | Description |
| -------- | ------------ |
| `gitmerge.token` | Personal access token for GitLab or GitHub. |
| `gitmerge.platform` | `auto` (default), `gitlab`, or `github`. |
| `gitmerge.instanceUrl` | Optional base URL for self-managed GitLab or GitHub Enterprise. |

Legacy keys `gitlabmergeplus.token` and `gitlabmergeplus.instanceUrl` are still read as fallbacks.

### Tokens

- **GitHub:** Classic PAT with `repo`, or a [fine-grained token](https://github.com/settings/tokens?type=beta) with **Pull requests** and **Contents** (Read and write) for this repo (authorize SSO on the org if needed). Merge/close need write access, not read-only `public_repo`.
- **GitLab:** Token with `api` and `read_user` — [gitlab.com](https://gitlab.com/-/profile/personal_access_tokens?name=GitMerge&scopes=api,read_user) or your instance.

### Example `settings.json`

```json
{
  "gitmerge.platform": "auto",
  "gitmerge.token": "YOUR_ACCESS_TOKEN",
  "gitmerge.instanceUrl": ""
}
```

---

## Links

- [GitHub repository](https://github.com/joyaljamez/GitLabMerge-)
