import * as vscode from "vscode";
import { createApi, GitMergeApi } from "./api";
import { ApiReadyPayload, SharedStore } from "./assets/store";
import { info, log, runWithProgress, withProgress } from "./utils";
import { getExtensionConfig } from "./config";
import GithubApi from "./githubApi";
import GitlabApi from "./gitlabApi";

export default class ListMRProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = "gitmerge.merge";
  private _view?: vscode.WebviewView;
  private api?: GitMergeApi;

  constructor(private readonly _extensionUri: vscode.Uri) {}
  public resolveWebviewView(webviewView: vscode.WebviewView) {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri],
    };

    webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

    webviewView.webview.onDidReceiveMessage((msg) => {
      if (msg.type === "closeMr") {
        void this.closeMergeRequest(msg.data);
      }
      if (msg.type === "mergeMr") {
        void this.mergeMergeRequest(msg.data);
      }
    });

    const onReady = (payload: ApiReadyPayload) => {
      void this.bindApiAndLoad(payload);
    };

    SharedStore.instance.onReady(onReady);

    const cached = SharedStore.instance.getLastReady();
    if (SharedStore.instance.isReady && cached) {
      void this.bindApiAndLoad(cached);
    }

    SharedStore.instance.onRefresh(() => {
      this.getMyCreatedMergeRequests();
    });
  }

  private async mergeMergeRequest(data: {
    close_id?: number;
    title?: string;
  }) {
    const closeId = data?.close_id;
    if (!closeId || !this.api) {
      return;
    }
    const title = data.title || "this merge request";
    const choice = await vscode.window.showWarningMessage(
      `Merge "${title}"?`,
      { modal: true },
      "Merge"
    );
    if (choice !== "Merge") {
      return;
    }
    try {
      await runWithProgress("Merging...", async () => {
        if (this.api instanceof GitlabApi) {
          await this.api.mergeMergeRequest(closeId);
        } else if (this.api instanceof GithubApi) {
          await this.api.mergeMergeRequest(closeId);
        }
      });
      await info("Merged successfully.");
      await this.getMyCreatedMergeRequests();
      SharedStore.instance.triggerRefresh();
    } catch (err: unknown) {
      const data = (err as { response?: { data?: unknown } })?.response?.data;
      if (!data) {
        await log(
          "Failed to merge. Check reviews, CI, and branch protection."
        );
      }
    }
  }

  private async closeMergeRequest(data: {
    close_id?: number;
    title?: string;
  }) {
    const closeId = data?.close_id;
    if (!closeId || !this.api) {
      return;
    }
    const title = data.title || "this merge request";
    const choice = await vscode.window.showWarningMessage(
      `Close "${title}"?`,
      { modal: true },
      "Close"
    );
    if (choice !== "Close") {
      return;
    }
    try {
      await runWithProgress("Closing merge request", async () => {
        if (this.api instanceof GitlabApi) {
          await this.api.closeMergeRequest(closeId);
        } else if (this.api instanceof GithubApi) {
          await this.api.closeMergeRequest(closeId);
        }
      });
      const closedMsg =
        this.api instanceof GithubApi
          ? "Pull request closed."
          : "Merge request closed.";
      await info(closedMsg);
      await this.getMyCreatedMergeRequests();
      SharedStore.instance.triggerRefresh();
    } catch (err: unknown) {
      const data = (err as { response?: { data?: unknown } })?.response?.data;
      if (!data) {
        await log("Failed to close merge request.");
      }
    }
  }

  private async bindApiAndLoad(payload: ApiReadyPayload) {
    const config = getExtensionConfig();
    this.api = createApi(payload.platform, config, payload.host);
    if (payload.projectPath) {
      try {
        await this.api.getProject(
          payload.projectPath,
          payload.webBaseUrl || ""
        );
      } catch {
        this.api.id = undefined;
      }
    } else if (payload.id) {
      this.api.id = Number(payload.id);
    }
    await this.getMyCreatedMergeRequests();
  }

  private _getHtmlForWebview(webview: vscode.Webview) {
    const nonce = getNonce();
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, "src", "assets", "main-panel2.js")
    );
    const styleMainUri = webview.asWebviewUri(
      vscode.Uri.joinPath(
        this._extensionUri,
        "src",
        "assets",
        "main-panel2.css"
      )
    );
  const styleVSCodeUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, "src", "assets", "vscode.css")
    );
    return `<!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';">
      <link href="${styleVSCodeUri}" rel="stylesheet">
      <link href="${styleMainUri}" rel="stylesheet">
      <title>My Merge Requests</title>
    </head>
    <body>
      <div id="mrt-my-mrs"></div>
      <script nonce="${nonce}" src="${scriptUri}"></script>
    </body>
    </html>`;
  }

  public async refresh(): Promise<void> {
    const { res: promiseRes } = await withProgress("Reloading merge requests");
    await this.getMyCreatedMergeRequests();
    promiseRes();
  }

  postMsg(type: string, data: any) {
    this._view?.webview.postMessage({ type, data });
  }

  async getMyCreatedMergeRequests() {
    if (!this.api?.id) {
      return;
    }
    try {
      const res = await Promise.resolve(this.api.getMyCreatedMergeRequests());
      if (res) {
        this.postMsg("myMRs", res.data);
      }
    } catch {
      this.postMsg("myMRs", []);
    }
  }
}

function getNonce() {
  return [...Array(32)]
    .map(() => ((Math.random() * 36) | 0).toString(36))
    .join("");
}
