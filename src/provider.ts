import * as vscode from "vscode";
import GitExtensionWrap from "./git";
import { MRParams, ExtensionConfig } from "./type";
import { createApi, GitMergeApi } from "./api";
import {
  validateForm,
  infoModalItems,
  promptRepoSetupFailure,
  withProgress,
} from "./utils";
import { SharedStore } from "./assets/store";
import { getExtensionConfig } from "./config";
import { Platform } from "./remote";

export default class MergeProvider implements vscode.WebviewViewProvider {
  public static readonly viewType: string = "gitmerge";
  private _view?: vscode.WebviewView;
  private git?: GitExtensionWrap;
  private api?: GitMergeApi;
  private config: ExtensionConfig = {};
  public gitUrl?: string;
  public repoPath?: string;
  public platform: Platform = "gitlab";
  private remoteHost?: string;
  private projectPath?: string;

  constructor(private readonly _extensionUri: vscode.Uri) {}

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ) {
    this._view = webviewView;

    webviewView.webview.options = {
      // Allow scripts in the webview
      enableScripts: true,
      localResourceRoots: [this._extensionUri],
    };

    webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

    webviewView.webview.onDidReceiveMessage((msg) => {
      switch (msg.type) {
        case "init":
          this.init(msg.data);
          break;
        case "submitMR":
          void this.submitMR(msg.data);
          break;
        case "searchUser":
          this.getUsers(msg.data);
          break;
        case "searchReviewer":
          this.getReviewers(msg.data);
          break;
        case "setting":
          vscode.commands.executeCommand(
            "workbench.action.openSettings",
            `gitmerge`
          );
          break;
        case "repoChange":
          this.setupRepo(msg.data);
          break;
        case "getLabels":
          this.getLabels();
          break;
        case "openUrl":
          if (typeof msg.data === "string" && msg.data) {
            vscode.env.openExternal(vscode.Uri.parse(msg.data));
          }
          break;
      }
    });
  }

  private _getHtmlForWebview(webview: vscode.Webview) {
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, "src", "assets", "main.js")
    );
    const toolkitUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, "src", "assets", "toolkit.js")
    );

    const styleVSCodeUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, "src", "assets", "vscode.css")
    );
    const styleResetUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, "src", "assets", "reset.css")
    );
    const styleMainUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, "src", "assets", "main.css")
    );
    const nonce = getNonce();

    return `<!DOCTYPE html>
      <html lang="en">
      <head>
      <meta charset="UTF-8">
      <!--
        Use a content security policy to only allow loading images from https or from our extension directory,
        and only allow scripts that have a specific nonce.
      -->
      <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <link href="${styleMainUri}" rel="stylesheet">
      <link href="${styleResetUri}" rel="stylesheet">
      <link href="${styleVSCodeUri}" rel="stylesheet">
      <script type="module" nonce="${nonce}" src="${toolkitUri}"></script>
      <title>Merge Request Tool</title>
      </head>
      <body>
      <div class="mrt-wrap hidden">
        <div id="repo-list"></div>
        <div class="mrt-form hidden">
        <div class="gm-form-body">
        <div class="gm-field">
          <vscode-label for="title-field">Title</vscode-label>
          <vscode-text-field id="title-field" class="form mrt-title" name="title"></vscode-text-field>
        </div>
        <div class="gm-field">
          <vscode-label for="description-field">Description</vscode-label>
          <vscode-text-area id="description-field" class="form mrt-description" name="description" rows="4"></vscode-text-area>
        </div>
        <div class="gm-field">
          <vscode-label>Source branch</vscode-label>
          <input class="mrt-source-branch-value form" name="source_branch" type="hidden" />
          <div class="mrt-picker-select source">
            <div class="mrt-source-branch-name mrt-picker-display placeholder">Select source branch</div>
            <div class="picker-wrap">
              <input id="keywordInp-source-branch" class="mrt-keyword-inp" placeholder="Search branches" />
              <div class="list">
                <p class="empty show">No matching results</p>
                <ul class="mrt-branch-list source"></ul>
              </div>
            </div>
          </div>
        </div>
        <div class="gm-field">
          <vscode-label>Target branch</vscode-label>
          <input class="mrt-target-branch-value form" name="target_branch" type="hidden" />
          <div class="mrt-picker-select target">
            <div class="mrt-target-branch-name mrt-picker-display placeholder">Select target branch</div>
            <div class="picker-wrap">
              <input id="keywordInp-target-branch" class="mrt-keyword-inp" placeholder="Search branches" />
              <div class="list">
                <p class="empty show">No matching results</p>
                <ul class="mrt-branch-list target"></ul>
              </div>
            </div>
          </div>
        </div>
        <div class="gm-field">
          <vscode-label>Assignee</vscode-label>
        <input class="mrt-assignee-id form" name="assignee_id"></input>
        <div class="mrt-picker-select assignee">
          <div class="mrt-assignee-name mrt-picker-display placeholder"></div>
          <svg class="del-icon del-assignee" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" data-v-ea893728=""><path fill="currentColor" d="M764.288 214.592 512 466.88 259.712 214.592a31.936 31.936 0 0 0-45.12 45.12L466.752 512 214.528 764.224a31.936 31.936 0 1 0 45.12 45.184L512 557.184l252.288 252.288a31.936 31.936 0 0 0 45.12-45.12L557.12 512.064l252.288-252.352a31.936 31.936 0 1 0-45.12-45.184z"></path></svg>
          <div class="picker-wrap">
          <input id="keywordInp-assignee" class="mrt-keyword-inp" placeholder="Search users" >
          <div class="list">
            <p class="empty show">No matching results</p>
            <ul class="mrt-user-list"></ul>
          </div>
          </div>
        </div>
        </div>

        <div class="gm-field">
          <vscode-label>Reviewer</vscode-label>
        <input class="mrt-reviewer-id form" name="reviewer_id"></input>
        <div class="mrt-picker-select reviewer">
          <div class="mrt-reviewer-name mrt-picker-display placeholder"></div>
          <svg class="del-icon del-reviewer" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" data-v-ea893728=""><path fill="currentColor" d="M764.288 214.592 512 466.88 259.712 214.592a31.936 31.936 0 0 0-45.12 45.12L466.752 512 214.528 764.224a31.936 31.936 0 1 0 45.12 45.184L512 557.184l252.288 252.288a31.936 31.936 0 0 0 45.12-45.12L557.12 512.064l252.288-252.352a31.936 31.936 0 1 0-45.12-45.184z"></path></svg>
          <div class="picker-wrap">
          <input id="keywordInp-reviewer" class="mrt-keyword-inp" placeholder="Search users" >
          <div class="list">
            <p class="empty show">No matching results</p>
            <ul class="mrt-user-list"></ul>
          </div>
          </div>
        </div>
        </div>

        <div class="gm-field">
          <vscode-label for="labels-select">Labels</vscode-label>
          <select id="labels-select" multiple class="mrt-labels-select form gm-multi-select" name="labels" size="6"></select>
          <p class="gm-hint">Hold Ctrl (Cmd on Mac) to select multiple labels.</p>
        </div>

        <div class="gm-field gitlab-only">
          <vscode-checkbox id="delete-source-branch" class="checkbox" name="remove_source_branch" checked>Delete source branch when merge request is accepted.</vscode-checkbox>
        </div>
        <div class="gm-field gitlab-only">
          <vscode-checkbox id="squash-commits" class="checkbox" name="squash">Squash commits when merge request is accepted.</vscode-checkbox>
        </div>
        <vscode-button id="submit" class="mrt-btn" appearance="primary">Submit MR</vscode-button>
        </div>
        </div>
        <div class="mrt-tips">
        <p>Add your API token in VS Code settings to use GitMerge. Use the <strong>Info</strong> icon in the panel title bar for setup help.</p>
        </div>
      </div>
      <script nonce="${nonce}" src="${scriptUri}" defer></script>
      </body>
      </html>`;
  }

  async submitMR(data: MRParams) {
    try {
      const result = validateForm(data);
      if (result !== true) {
        return;
      }
      if (!this.api) {
        return;
      }
      const res = await this.api.submitMR(data);
      const url = this.resolveWebUrl(res.data.web_url || "");
      const successMessage =
        this.platform === "github"
          ? "Pull request created successfully."
          : "Merge request created successfully.";
      const openLabel = this.platform === "github" ? "Open PR" : "Open MR";
      const detailLines = [
        res.data.id ? `Number: ${res.data.id}` : "",
        url ? `URL: ${url}` : "",
      ].filter(Boolean);
      const item = await infoModalItems(successMessage, detailLines.join("\n"), [
        { title: "OK", isCloseAffordance: true },
        { title: openLabel },
      ]);
      if (item?.title === openLabel && url) {
        vscode.env.openExternal(vscode.Uri.parse(url));
      }
      SharedStore.instance.triggerRefresh();
    } catch {
      /* API errors surfaced via handleResError in the HTTP client */
    } finally {
      this.postMsg("submitState", { busy: false });
    }
  }

  async init(repoPath?: string): Promise<void> {
    this.getConfig();

    const tipsVisible = !this.config.token;
    this.postMsg("viewTips", tipsVisible);
    if (tipsVisible) {
      return;
    }

    this.repoPath = repoPath || this.repoPath || "";

    const { res: promiseRes } = await withProgress(
      "Initializing Git Repository."
    );
    let ok = false;
    try {
      this.git = new GitExtensionWrap();
      await this.git.init(this.repoPath || "", (paths) => {
        this.postMsg("updateRepoTab", paths);
      });
      await this.setupRepo();
      ok = Boolean(this.api?.id);
    } catch {
      ok = false;
    }
    promiseRes();

    if (ok) {
      this.postMsg("viewReady", true);
      return;
    }

    SharedStore.instance.clearReady();
    this.api = undefined;

    const choice = await promptRepoSetupFailure();
    if (choice?.title === "Retry") {
      return this.init(repoPath);
    }

    this.postMsg("viewTips", true);
    this.postMsg("viewReady", true);
  }

  async setupRepo(path?: string) {
    if (!this.git) {
      return;
    }

    if (path) {
      this.git.repoPath = path;
    }

    const {
      branches,
      currentBranchName,
      projectName,
      projectPath,
      url,
      platform,
      host,
    } = await this.git.getInfo();
    this.gitUrl = url;
    this.remoteHost = host;
    const setting = this.config.platform || "auto";
    this.platform =
      setting !== "auto" ? setting : platform ?? "gitlab";
    this.postMsg("currentBranch", currentBranchName);
    this.postMsg("platform", this.platform);
    this.api = createApi(this.platform, this.config, host);
    const lookupPath = projectPath || projectName;
    this.projectPath = lookupPath;
    try {
      await this.api.getProject(lookupPath, url || "");
    } catch {
      this.api.id = undefined;
    }

    if (this.api.id) {
      this.getBranches(branches);
      await this.getUsers();
      await this.getReviewers();
      await this.getLabels();
      SharedStore.instance.markReady(
        this.api.id,
        this.platform,
        this.remoteHost,
        this.projectPath,
        this.gitUrl
      );
    }
  }

  getConfig() {
    this.config = getExtensionConfig();
  }

  private resolveWebUrl(webUrl: string) {
    if (!webUrl) {
      return "";
    }
    if (this.platform === "github") {
      return webUrl;
    }
    if (this.config.instanceUrl) {
      return webUrl.replace(
        /^http(s)?:\/\/[^/]+/,
        this.config.instanceUrl.replace(/\/$/, "")
      );
    }
    return webUrl;
  }

  getBranches(branches: any[]) {
    const data = branches
      .filter((v) => v.type === 1 && !v.name.includes("HEAD"))
      .map((v) => {
        v.name = v.name.replace("origin/", "");
        return v;
      });
    // this.api?.getBranches().then(res => {
    this.postMsg("branches", data || []);
    // });
  }

  getUsers(name?: string) {
    Promise.resolve(this.api?.getUsers(name)).then((res) => {
      if (res) {
        this.postMsg("users", res.data);
      }
    });
  }

  //Reviewer
  getReviewers(name?: string) {
    Promise.resolve(this.api?.getUsers(name)).then((res) => {
      if (res) {
        this.postMsg("reviewers", res.data);
      }
    });
  }

  getLabels() {
    this.api?.getLabels().then((res) => {
      this.postMsg("labels", res.data);
    });
  }

  postMsg(type: string, data: any) {
    this._view?.webview.postMessage({ type, data });
  }

  public clearForm() {
    if (!this._view) {
      void vscode.window.showWarningMessage(
        "Open the Create Merge Request view first."
      );
      return;
    }
    this.postMsg("clearForm", true);
  }
}

function getNonce() {
  let text = "";
  const possible =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}
