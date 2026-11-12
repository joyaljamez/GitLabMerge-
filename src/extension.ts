import * as vscode from "vscode";
import MergeProvider from "./provider";
import ListMRProvider from "./ListMRProvider";
import { showGitMergeSetupInfo } from "./setupInfo";

export function activate(context: vscode.ExtensionContext) {
  // https://code.visualstudio.com/api/references/activation-events
  const provider = new MergeProvider(context.extensionUri);
  const listMRProvider = new ListMRProvider(context.extensionUri);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      MergeProvider.viewType,
      provider,
      {
        webviewOptions: {
          retainContextWhenHidden: true,
        },
      }
    )
  );
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      ListMRProvider.viewType,
      listMRProvider,
      {
        webviewOptions: {
          retainContextWhenHidden: true,
        },
      }
    )
  );

  const register = (name: string, cb: () => void) => {
    return vscode.commands.registerCommand(name, cb);
  };

  const openGitPage = (isMr = false) => {
    let url = provider.gitUrl;
    if (url) {
      url = url.replace(/.git$/, "");
      const mrPath =
        provider.platform === "github" ? "/pulls" : "/-/merge_requests";
      vscode.env.openExternal(
        vscode.Uri.parse(url + (isMr ? mrPath : ""))
      );
    }
  };

  context.subscriptions.push(
    register("gitmerge.refresh", () => provider.init()),
    register("gitmerge.repository", () => openGitPage(false)),
    register("gitmerge.merge.requests", () => openGitPage(true)),
    register("gitmerge.refreshMrs", () => listMRProvider.refresh()),
    register("gitmerge.showInfo", () => showGitMergeSetupInfo()),
    register("gitmerge.clearForm", () => provider.clearForm()),
  );
}
