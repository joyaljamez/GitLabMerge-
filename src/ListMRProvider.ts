import * as vscode from "vscode";
import Api from "./api";
import { ExtensionConfig } from "./type";
import { SharedStore } from "./assets/store";
import { validateForm, info, log, withProgress } from "./utils";

export default class ListMRProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = "gitlab.mrt.merge";
  private _view?: vscode.WebviewView;
  private config: ExtensionConfig = {};
  private api?: Api;

  constructor(private readonly _extensionUri: vscode.Uri) {}
  public resolveWebviewView(webviewView: vscode.WebviewView) {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri],
    };

    webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

    SharedStore.instance.onReady((id) => {
      this.getConfig();
      this.api = new Api(this.config);
      this.api.id = Number(id);
      this.getMyCreatedMergeRequests();
    });

    SharedStore.instance.onRefresh(() => {
      this.getMyCreatedMergeRequests();
    });
  }
  getConfig() {
    const { instanceUrl, token } =
      vscode.workspace.getConfiguration("gitlabmergeplus");
    this.config = { instanceUrl, token };
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
    return `<!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';">
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
    const { res: promiseRes } = await withProgress("Reloading Merge Requests");
    this.getMyCreatedMergeRequests();
    promiseRes();
  }

  postMsg(type: string, data: any) {
    this._view?.webview.postMessage({ type, data });
  }

  getMyCreatedMergeRequests() {
    this.api?.getMyCreatedMergeRequests().then((res) => {
      this.postMsg("myMRs", res.data);
    });
  }
}

function getNonce() {
  return [...Array(32)]
    .map(() => ((Math.random() * 36) | 0).toString(36))
    .join("");
}
