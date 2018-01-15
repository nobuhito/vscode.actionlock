const vscode = require('vscode');
const ActionLock = require("./actionlock")
const moment = require("moment");

var decorationTypes = [];

function activate(context) {
    let isInstalledMdtasks = (vscode.extensions.all.filter((d) => { return d.id == "nobuhito.mdtasks"; }).length > 0);
    let ac = new ActionLock(isInstalledMdtasks);

    context.subscriptions.push(vscode.commands.registerTextEditorCommand("extension.doAction", editor => {
        doAction(ac, editor);
    }));

    vscode.commands.executeCommand("setContext", "actionlock.isInstalledMDTasks", false);
    if (isInstalledMdtasks) {
        vscode.commands.executeCommand("setContext", "actionlock.isInstalledMDTasks", true);
        context.subscriptions.push(vscode.commands.registerTextEditorCommand("extension.toggleTask", editor => {
            toggleTask(ac, editor);
        }));
    }

    var select = vscode.window.onDidChangeTextEditorSelection((event) => {
        triggerUpdate(event.textEditor);
    });
    context.subscriptions.push(select);

    var timeout = null;
    function triggerUpdate(editor) {
        if (timeout) {
            clearTimeout(timeout);
        }

        timeout = setTimeout(() => {
            updateDecorations(ac, editor);

            vscode.commands.executeCommand("setContext", "actionlock.isTrue", false);
            let range = ac.getRangeAtCursor(editor);
            if (range != null) {
                vscode.commands.executeCommand("setContext", "actionlock.isTrue", true);
            }

        }, 100);
    }

    let editor = vscode.window.activeTextEditor;
    if (editor) {
        triggerUpdate(editor);
    }
}
exports.activate = activate;

// this method is called when your extension is deactivated
function deactivate() {
}
exports.deactivate = deactivate;

function toggleTask(ac, editor) {
    let line = editor.selection.start.line;
    let position = ac.findCheckboxAtCursorLine(line);

    editor.selection = new vscode.Selection(position, position);
    doAction(ac, editor);
}

function updateDecorations(ActionLock, editor) {
    for (const decorationType of decorationTypes) {
        decorationType.dispose();
    }
    decorationTypes = [];

    decorationTypes.push(ActionLock.updateDecorations(editor));
}

function doAction(ac, editor) {
    let range = ac.getRangeAtCursor(editor);
    editor.selection = new vscode.Selection(range.start, range.end);
    let word = editor.document.getText(range);
    let isDate = ac.regexDate.test(word);
    if (isDate) {
        showQuickPick(ac);
    } else {
        let edits = [];
        let switchWords = ac.switchWords;
        for (let items of switchWords) {
            let index = items.indexOf(word);
            if (index > -1) {
                let dist = (items.length == index + 1) ? items[0] : items[index + 1];
                edits.push({ range: range, dist: dist });

                let isMdtasksItem = (["[x]", "[ ]"].indexOf(word) > -1) ? true : false;
                if (ac.isInstalledMdtasks && isMdtasksItem) {
                    edits = ac.checkParentTasks(edits, editor.document.getText().split(/\r?\n/));
                }

                var selection = new vscode.Position(range.start.line, range.start.character + dist.length);
                editor.selection = new vscode.Selection(selection, selection);

                break;
            }
        }

        editor.edit(edit => {
            for (const e of edits) {
                edit.replace(e.range, e.dist);
            }
        }).then(() => {
            if (ac.isInstalledMdtasks) {
                let lineAt = editor.document.lineAt(range.start.line);

                let doneDateReg = /\s\->\s\d{4}\-\d{2}\-\d{2}/;
                let newText = (doneDateReg.test(lineAt.text)) ?
                    lineAt.text.replace(doneDateReg, "") :
                    lineAt.text + " -> " + moment().format("YYYY-MM-DD");

                editor.edit(edit => {
                    edit.replace(lineAt.range, newText);
                });
            }
        });
    }
}

function showQuickPick(ac) {
    let items = ac.buildQuickPick();

    let editor = vscode.window.activeTextEditor;
    var range = new vscode.Range(editor.selection.start, editor.selection.end);

    let options = { matchOnDescription: true, placeHolder: "Select date or Close with escape key" };
    vscode.window.showQuickPick(items, options).then((select) => {
        if (select != undefined) {
            editor.edit((edit) => {
                edit.replace(range, select.label);
            });
        }
    });
}