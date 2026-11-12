import * as vscode from "vscode";

const SETUP_DETAIL = `Required (add to Settings → search "gitmerge"):

• gitmerge.token — Personal access token for GitHub or GitLab
• gitmerge.platform — auto (default), gitlab, or github
• gitmerge.instanceUrl — optional; self-hosted GitLab or GitHub Enterprise

GitHub: classic PAT — "repo" scope (read + write).
Fine-grained PAT — grant this repository; Pull requests & Contents (Read and write); authorize SSO on the org if prompted.
GitLab: token needs "api" and "read_user" scopes.

Open a git repo folder with origin on GitHub or GitLab.

Legacy gitlabmergeplus.* keys still work as fallbacks.`;

export async function showGitMergeSetupInfo(): Promise<void> {
  const choice = await vscode.window.showInformationMessage(
    "GitMerge setup",
    { modal: true, detail: SETUP_DETAIL },
    "Open Settings"
  );
  if (choice === "Open Settings") {
    await vscode.commands.executeCommand(
      "workbench.action.openSettings",
      "gitmerge"
    );
  }
}
