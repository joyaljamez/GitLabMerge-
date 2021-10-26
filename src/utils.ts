import { MRParams } from './type';
import * as vscode from 'vscode';

export const log = (msg: string) => {
    vscode.window.showErrorMessage(msg, 'Show Logs');
};

export const info = (msg: string) => {
    vscode.window.showInformationMessage(msg, 'Show Info');
};

export function handleError(e: Error) {
    log(e.message);
}

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
    if (!data) {
        return log('Failed to create MR!');
    }
    if (data.error) {
        return log(data.error);
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
    return log('Failed to create MR! ' + JSON.stringify(data));
}
