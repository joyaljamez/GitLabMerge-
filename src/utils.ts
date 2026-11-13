import { MRParams, ProgressPromise } from './type';
import * as vscode from 'vscode';

const modalOptions: vscode.MessageOptions = { modal: true };

/** Skip global error popups; caller shows a single message instead. */
export const SILENT_API_ERROR = 'X-GitMerge-Silent-Error';

export function isSilentApiError(
    config?: { headers?: Record<string, unknown> }
): boolean {
    return config?.headers?.[SILENT_API_ERROR] === '1';
}

const REPO_SETUP_MSG =
    'Unable to read repo. Please check gitmerge.token, gitmerge.platform, and gitmerge.instanceUrl.';

export function promptRepoSetupFailure(): Thenable<vscode.MessageItem | undefined> {
    const detail =
        'Verify the access token can read this repository on the selected platform.';
    return vscode.window.showErrorMessage(
        REPO_SETUP_MSG,
        { modal: true, detail },
        { title: 'Cancel', isCloseAffordance: true },
        { title: 'Retry' }
    );
}

export const log = (msg: string, ...items: string[]) => {
    return vscode.window.showErrorMessage(msg, modalOptions, ...items);
};

export const info = (msg: string, ...items: string[]) => {
    return vscode.window.showInformationMessage(msg, modalOptions, ...items);
};

export function infoModal(
    message: string,
    detail: string | undefined,
    ...actions: string[]
) {
    const options: vscode.MessageOptions = { modal: true };
    if (detail?.trim()) {
        options.detail = detail.trim();
    }
    return vscode.window.showInformationMessage(message, options, ...actions);
}

/** Modal with custom buttons only (no implicit Cancel). */
export function infoModalItems(
    message: string,
    detail: string | undefined,
    items: vscode.MessageItem[]
): Thenable<vscode.MessageItem | undefined> {
    const options: vscode.MessageOptions = { modal: true };
    if (detail?.trim()) {
        options.detail = detail.trim();
    }
    return vscode.window.showInformationMessage(message, options, ...items);
}

/** Run work under a progress notification; closes before callers show alerts. */
export async function runWithProgress<T>(
    title: string,
    task: () => Thenable<T> | Promise<T>
): Promise<T> {
    return vscode.window.withProgress(
        {
            location: vscode.ProgressLocation.Notification,
            cancellable: false,
            title,
        },
        async () => task()
    );
}

// export function handleError(e: Error) {
//     log(e.message);
// }

export function validateForm(data: MRParams) {
    const obj = {
        title: 'Title can\'t be blank',
        source_branch: 'Source branch can\'t be blank',
        target_branch: 'Target branch can\'t be blank',
    };
    if (!data.title) {
        return log(obj.title);
    }
    if (!data.source_branch) {
        return log(obj.source_branch);
    }
    if (!data.target_branch) {
        return log(obj.target_branch);
    }
    return true;
}

// response message
export function handleResError(data: any) {
  if (typeof data === 'string') {
    return log(data);
  }
    if (!data) {
        return log('Failed to create merge request.');
    }
    if (typeof data.message === 'string') {
        return log(data.message);
    }
    if (Array.isArray(data.errors)) {
        return log(
            data.errors
                .map((e: { message?: string } | string) =>
                    typeof e === 'string' ? e : e.message || JSON.stringify(e)
                )
                .join(', ')
        );
    }
    if (data.error) {
        return log(Array.isArray(data.error) ? data.error.join(', ') : data.error);
    }
    if (Array.isArray(data.message)) {
        return log(data.message.join('\n'));
    }
    if (Object.prototype.toString.call(data.message) === '[object Object]') {
        let str = '';
        for(let k in data.message) {
            const v = data.message[k];
            if (v.length) {
                str += `${k} ${v.join(', ')}`;
            }
        }
        return log(str);
    }
    return log(JSON.stringify(data));
}

export function withProgress(title: string) {
    return new Promise<ProgressPromise>(res => {
        vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            cancellable: false,
            title
        }, progress => {
            return new Promise<void>(r => {
                res({
                    progress,
                    res: r
                });
            });
        });
    });
}
