const vscode = require('vscode');
const moment = require("moment");

var ranges = [];
var decorationType = null;
var regexDate = /[12][90]\d{2}\-[01][0-9]\-[0-3][0-9]/g;
var isInstalledMdtasks = false;
var edits = [];

function buildSwitchWords() {
    let words = vscode.workspace.getConfiguration("actionlock").get("switchWords");

    if (isInstalledMdtasks) {
        words.push(["[x]", "[ ]"]);
    }

    return words;
}

function buildSwitchArray(switchWords) {
    let switchArray = [];
    for (const items of switchWords) {
        for (const item of items) {
            switchArray.push(item);
        }
    }
    return switchArray;
}

function doAction(editor) {
    let range = getRangeAtCursor(editor);
    editor.selection = new vscode.Selection(range.start, range.end);
    let word = editor.document.getText(range);
    let isDate = regexDate.test(word);
    if (isDate) {
        showQuickPick();
    } else {
        let switchWords = buildSwitchWords();
        for (let items of switchWords) {
            let index = items.indexOf(word);
            if (index > -1) {
                let dist = (items.length == index + 1) ? items[0] : items[index + 1];
                edits.push({ range: range, dist: dist });

                let isMdtasksItem = (["[x]", "[ ]"].indexOf(word) > -1) ? true : false;
                if (isInstalledMdtasks && isMdtasksItem) {
                    checkParentTasks(editor, range.start.line, word);
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
        });
        edits = [];
    }
}

function checkParentTasks(editor, row, changeWord) {
    let currentIndentVal = getIndentVal(editor.document.lineAt(row).text);
    let parentRow = null;

    for (let i = row; i >= 0; i--) {
        let line = editor.document.lineAt(i).text;
        let _indent = getIndentVal(line);

        // 親タスクの検出
        if (/^\s*\-?\s?\[[\sx]\]\s/.test(line) && currentIndentVal > _indent) {
            parentRow = i;
            break;
        }
    }

    if (parentRow == null) {
        return; // 親が無かったら終了
    }

    let isParentCheck = true; // 親の初期値は `[x]`
    var childIndentVal = getIndentVal(editor.document.lineAt(parentRow + 1).text)
    for (let i = parentRow + 1; i < editor.document.lineCount; i++) {
        let line = editor.document.lineAt(i).text;

        // 孫インデントになったらチェック終了
        if (childIndentVal != getIndentVal(line)) {
            break;
        }

        // 一気に書き換えるので値の変更はまだ反映されていない
        if (row == i) {
            if (changeWord == "[x]") {
                isParentCheck = false;
                break;
            }
        }

        // 変更業以外のチェック
        else if (/^\s*\-?\s?\[[\s]\]\s/.test(line)) {
            isParentCheck = false;
            break;
        }
    }

    let range = ranges.filter((d) => { return d.start.line == parentRow; });
    let dist = "";
    if (range.length > 0) {
        dist = (isParentCheck) ? "[x]" : "[ ]";
        edits.push({ range: range[1], dist: dist });
    }

    if (parentRow != null && dist != "" && getIndentVal(editor.document.lineAt(parentRow).text) != 0) {
        checkParentTasks(editor, parentRow, (dist == "[ ]") ? "[x]" : "[ ]");
    }

}

function getIndentVal(line) {
    return (/^(\s+)/.test(line)) ? RegExp.$1.length : 0;
}

function showQuickPick() {
    var days = {};
    days[moment().format("YYYY-MM-DD")] = ["Today ."];
    days[moment().add(1, "day").format("YYYY-MM-DD")] = ["Tomorrow"];
    days[moment().add(7, "day").format("YYYY-MM-DD")] = ["NextWeek"];
    days[moment().add(14, "day").format("YYYY-MM-DD")] = ["+2week", "+14day"];
    days[moment().add(30, "day").format("YYYY-MM-DD")] = ["NextMonth", "+1month", "+30day"];
    days[moment().add(60, "day").format("YYYY-MM-DD")] = ["+2month", "+60day"];
    days[moment().add(90, "day").format("YYYY-MM-DD")] = ["+3month", "+90day"];
    days[moment().add(180, "day").format("YYYY-MM-DD")] = ["+6month", "+180day"];
    days[moment().add(360, "day").format("YYYY-MM-DD")] = ["NextYear", "+1year", "+12month", "+365day"];

    for (var i = 1; i < 10; i++) {
        let _cd = moment().add(i, "day");
        let cd = _cd.format("YYYY-MM-DD");

        if (days[cd] == undefined) {
            days[cd] = [];
        }

        if (i < 8) {
            days[cd].push("Next" + _cd.format("dddd"));
        }

        days[cd].push("+" + i + "day");
    }

    var items = [];
    items = Object.keys(days).map(key => {
        return { label: key, description: days[key].join(", ") };
    }).sort((a, b) => {
        if (a.description.indexOf("Today") > -1) { return -1; }
        return (a.label > b.label) ? 1 : -1;
    });

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

function activate(context) {
    if (vscode.extensions.all.filter((d) => { return d.id == "nobuhito.mdtasks"; }).length > 0) {
        isInstalledMdtasks = true;
    }

    context.subscriptions.push(vscode.commands.registerTextEditorCommand("extension.doAction", editor => {
        doAction(editor);
    }));

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
            updateDecorations(editor);

            vscode.commands.executeCommand("setContext", "actionlock.isTrue", false);
            let range = getRangeAtCursor(editor);
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

function getRangeAtCursor(editor) {
    let currentRrange = editor.selection;
    for (let i = 0; i < ranges.length; i++) {
        let range = ranges[i];
        if (isWithin(currentRrange, range)) {
            return range;
        }
    }
    return null;
}

function isWithin(range, forRange) {
    var ret = true;
    if (forRange.start.line > range.start.line ||
        forRange.end.line < range.start.line) {
        ret = false;
    }
    if (forRange.start.character >= range.start.character ||
        forRange.end.character <= range.start.character) {
        ret = false;
    }
    return ret;
}

function updateDecorations(editor) {
    var text = editor.document.getText();

    var match;
    var numbers = [];
    ranges = [];
    if (decorationType) {
        decorationType.dispose();
    }

    // 日付の検出
    while ((match = regexDate.exec(text)) !== null) {
        let range = buildRange(editor, match.index, match[0].length);
        numbers.push({ range: range });
        ranges.push(range);
    }

    let switchWords = buildSwitchWords();
    let switchArray = buildSwitchArray(switchWords);

    // ユーザー定義の検出
    let regexWord = new RegExp(switchArray.map((d) => { return RegExp.escape(d); }).join("|"), "g");
    while ((match = regexWord.exec(text)) !== null) {
        let range = buildRange(editor, match.index, match[0].length);
        numbers.push({ range: range });
        ranges.push(range);
    }

    let underlineColor = vscode.workspace.getConfiguration("actionlock").get("underlineColor");
    decorationType = vscode.window.createTextEditorDecorationType({
        "textDecoration": "underline " + underlineColor
    });
    editor.setDecorations(decorationType, numbers);
}

function buildRange(editor, index, length) {
    let startPos = editor.document.positionAt(index);
    let endPos = editor.document.positionAt(index + length);
    return new vscode.Range(startPos, endPos);
}

RegExp.escape = function (s) {
    return s.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
};