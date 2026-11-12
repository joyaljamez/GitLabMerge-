import * as vscode from 'vscode';
import { API, GitExtension, Repository, GitInfo } from './type';
import { log } from './utils';
import { parseGitRemote } from './remote';

class GitExtensionWrap implements vscode.Disposable {
    apiListeners: vscode.Disposable[] = [];
    private enablementListener?: vscode.Disposable;
    private repositoryCountChangedEmitter = new vscode.EventEmitter<void>();
    // private wrappedRepositories: WrappedRepository[] = [];

    onRepositoryCountChanged = this.repositoryCountChangedEmitter.event;

    private gitApi?: API;
    private gitExtension?: GitExtension;
    private repo?: Repository;
    public repos: Repository[] = [];
    public repoPath?: string;

    // private async onDidChangeGitExtensionEnablement(enabled: boolean) {
    //     if (enabled) {
    //       this.register();
    //       await this.addRepositories(this.gitApi?.repositories ?? []);
    //     } else {
    //     //   this.wrappedRepositories = [];
    //       this.repositoryCountChangedEmitter.fire();
    //       this.disposeApiListeners();
    //     }
    // }

    async init(repoPath: string, cb: (paths: string[]) => void) {
        try {
            this.gitExtension = vscode.extensions.getExtension<GitExtension>('vscode.git')?.exports;
            if (!this.gitExtension) {
              log('Could not get Git Extension');
              return;
            }
            this.gitApi = this.gitExtension?.getAPI(1);

            // 有子模块
            this.repos = this.gitApi.repositories;
            const paths = this.repos
                .sort((a, b) => a.rootUri.path.length - b.rootUri.path.length)
                .map(item => {
                    return item.rootUri.path;
                });
            cb(paths);

            this.repoPath = repoPath;
            console.log(this.gitApi.repositories);
            // this.enablementListener = this.gitExtension.onDidChangeEnablement(
            //   this.onDidChangeGitExtensionEnablement,
            //   this,
            // );
            // await this.onDidChangeGitExtensionEnablement(this.gitExtension.enabled);
          } catch (error) {
            // handleError(error);
        }
    }

    getInfo() {
        return new Promise<GitInfo>(async (res, rej) => {
            this.repo = this.repos?.find(r => {
                return r.rootUri.path === this.repoPath;
            });
            if (!this.repo && this.repos.length) {
                this.repo = this.repos[0];
                this.repoPath = this.repo.rootUri.path;
            }
            if (!this.repo) {
                return rej();
            }

            const head = this.repo.state.HEAD;
            const remotes = this.repo.state.remotes;
            const origin =
                remotes.find((r) => r.name === "origin") || remotes[0];
            const fetchUrl = origin?.fetchUrl || origin?.pushUrl;
            const remote = parseGitRemote(fetchUrl);
            const legacyMatch = fetchUrl
                ?.replace(/\.git(\/)?$/, '')
                ?.match(/\/([^\/.]+)$/);

            const branches = await this.repo?.getBranches({remote: true});
            res({
                branches,
                currentBranchName: head?.name || 'master',
                projectName: legacyMatch ? legacyMatch[1] : '',
                projectPath: remote?.projectPath || '',
                url: remote?.webBaseUrl,
                platform: remote?.platform,
                host: remote?.host,
            });
        });
    }

    dispose() {}
}

export default GitExtensionWrap;
