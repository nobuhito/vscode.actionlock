const vscode = require('vscode');
const moment = require("moment");

module.exports = class ActionLock {
    constructor(isInstalledMdtasks) {
        this.isInstalledMdtasks = isInstalledMdtasks;
        this.regexDate = /[12][90]\d{2}\-[01][0-9]\-[0-3][0-9]/g;
        this.decorationType = null;

        let myConf = vscode.workspace.getConfiguration("actionlock");

        this.switchWords = myConf.get("switchWords");
        if (isInstalledMdtasks) {
            this.switchWords.push(["[x]", "[ ]"]);
        }

        this.switchArray = [];
        for (const items of this.switchWords) {
            for (const item of items) {
                this.switchArray.push(item);
            }
        }

        this.regexWord = new RegExp(this.switchArray.map((d) => {
            return this.regexpEscape(d);
        }).join("|"), "g");

        this.underlineColor = myConf.get("underlineColor");
        this.ranges = [];
    }

    makeRanges(lines) {
        let match;
        this.ranges = [];

        for (let i = 0; i < lines.length; i++) {
            let line = lines[i];

            // 日付
            while ((match = this.regexDate.exec(line)) !== null) {
                let range = new vscode.Range(i, match.index, i, match.index + match[0].length);
                this.ranges.push(range);
            }

            // ユーザー定義
            while ((match = this.regexWord.exec(line)) != null) {
                let range = new vscode.Range(i, match.index, i, match.index + match[0].length);
                this.ranges.push(range);
            }
        }
    }

    regexpEscape(regexpString) {
        return regexpString.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    }

    getRanges(text) {
        this.makeRanges(text.split(/\r?\n/));
        return this.ranges;
    }

    updateDecorations(editor) {
        let ranges = this.getRanges(editor.document.getText());
        let decorationType = vscode.window.createTextEditorDecorationType({
            "textDecoration": "underline " + this.underlineColor
        });
        editor.setDecorations(decorationType, ranges);
        return decorationType;
    }

    getRangeAtCursor(editor) {
        let ranges = this.getRanges(editor.document.getText());
        let selection = editor.selection;
        for (let i = 0; i < ranges.length; i++) {
            let range = ranges[i];
            if (this.isWithInRange(selection, range)) {
                return range;
            }
        }
        return null;
    }

    isWithInRange(selection, range) {
        if (range.start.line == 44) {
            console.log(selection, range);
        }
        var ret = true;
        if (range.start.line > selection.start.line ||
            range.end.line < selection.start.line) {
            ret = false;
        }
        if (range.start.character >= selection.start.character ||
            range.end.character <= selection.start.character) {
            ret = false;
        }
        return ret;
    }

    buildQuickPick() {
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

        return items;
    }

    // for MDTasks
    checkParentTasks(edits, lines) {
        let toggleCheck = function (check) {
            return (check == "[x]") ? "[ ]" : "[x]";
        };

        let getIndentLevel = function (line) {
            return (/^(\s+)/.test(line)) ? RegExp.$1.length : 0;
        };

        let changeWord = toggleCheck(edits[0].dist);
        let row = edits[edits.length - 1].range.start.line;

        let currentIndentLevel = getIndentLevel(lines[row]);
        let parentRow = null;

        for (let i = row; i >= 0; i--) {
            let line = lines[i];
            let _indent = getIndentLevel(line);

            // is parent?
            if (currentIndentLevel > _indent) {
                if (/^\s*\-?\s?\[[\sx]\]\s/.test(line)) {
                    parentRow = i;
                    break;
                } else {
                    return edits;
                }
            }
        }

        if (parentRow == null) {
            return edits;
        }

        let isParentCheck = true;
        let firstChildRow = parentRow + 1;
        let childIndentLevel = getIndentLevel(lines[firstChildRow]);
        for (let i = firstChildRow; i < lines.length; i++) {
            let line = lines[i];

            if (childIndentLevel > getIndentLevel(line)) {
                break;
            }
            if (childIndentLevel < getIndentLevel(line)) {
                continue;
            }

            if (row == i) {
                if (changeWord == "[x]") { // 変更前の値が `[x]` の場合は親もfalse
                    isParentCheck = false;
                    break;
                }
            }

            // 変更した行以外をチェック
            else if (/^\s*\-?\s?\[[\s]\]\s/.test(line)) {
                isParentCheck = false;
                break;
            }
        }

        this.makeRanges(lines);
        let range = this.ranges.filter((d) => { return d.start.line == parentRow; });
        let dist = "";
        if (range.length != 0) {
            dist = (isParentCheck) ? "[x]" : "[ ]";
            edits.push({ range: range[0], dist: dist });
        }

        if (parentRow != null && dist != "" && getIndentLevel(lines[parentRow]) != 0) {
            return this.checkParentTasks(edits, lines);
        }

        return edits;
    }


};