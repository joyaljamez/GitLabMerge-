# GitLabMerge+ README

**GitLab Merge Request Helper for VS Code**

**Author:** Joyal James

![Extension Preview](src/assets/view.png)

---

## 🚀 Features

### 🔧 Create Merge Request

- Create a Merge Request directly from VS Code.
- **Auto-fill** on refresh:

  - Source branch and title.
  - Target branch (`master`, `dev`, `develop`).

- Select project members as **reviewers** or **assignees**.
- Add **multiple labels** with ease.

### 📂 My Merge Requests

- View a list of all merge requests created by you.
- Expand a merge request to:

  - View MR details.
  - Copy or open MR URL.

- 🔴 **Red Arrow** indicator for merge conflicts.

---

## ⚙️ Extension Settings

| Setting                       | Description                                                                                                 |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `gitlabmergeplus.token`       | Access token to connect to the GitLab API. Make sure to use a token created from your GitLab account's main settings (not a project-specific token) to ensure that all merge requests—created from both the web and the extension—are tracked properly. Generate one from **GitLab → Profile Settings → Access Tokens.**. |
| `gitlabmergeplus.instanceUrl` | (Optional) Custom GitLab domain URL (e.g., `https://git.yourdomain.com`).                                   |

### VS Code Settings UI

![VS Code Settings](src/assets/setting.png) |

### Example: `settings.json`

```json
{
  "gitlabmergeplus.token": "YOUR_ACCESS_TOKEN",
  "gitlabmergeplus.instanceUrl": "https://gitlab.com"
}
```

---

## 🔗 Links

- 🧩 [Visual Studio Marketplace](https://marketplace.visualstudio.com/items?itemName=JoyalJames.GitLabMerge)
- 🐙 [GitHub Repository - GitLabMerge+](https://github.com/joyaljamez/GitLabMerge-)

---


