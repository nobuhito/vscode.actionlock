/* global suite, test */
const assert = require('assert');
const vscode = require('vscode');
const ActionLock = require('../src/actionlock');

suite("Extension Tests", function () {
    let lines = `
# test

- [ ] test 2017-11-27
- [ ] test1
  - [x] test2
  - [ ] test3
    - [ ] test4
        `.trim().split(/\r?\n/);

    let ac = new ActionLock(true);

    test("Count Ranges", () => {
        ac.makeRanges(lines);
        assert.deepEqual(6, ac.ranges.length);

        let notInstalledMDTasks = new ActionLock(false);
        notInstalledMDTasks.makeRanges(lines);
        assert.deepEqual(1, notInstalledMDTasks.ranges.length);

    });

    test("With in range", () => {
        ac.makeRanges(lines);

        let tests = [

            {
                exp: false,
                actPosition: new vscode.Position(5, 4),
                actDist: 4
            },
            {
                exp: true,
                actPosition: new vscode.Position(5, 5),
                actDist: 4
            },
            {
                exp: true,
                actPosition: new vscode.Position(5, 6),
                actDist: 4
            },
            {
                exp: false,
                actPosition: new vscode.Position(5, 7),
                actDist: 4
            },


            {
                exp: false,
                actPosition: new vscode.Position(2, 11),
                actDist: 0
            },
            {
                exp: true,
                actPosition: new vscode.Position(2, 12),
                actDist: 0
            },
            {
                exp: true,
                actPosition: new vscode.Position(2, 20),
                actDist: 0
            },
            {
                exp: false,
                actPosition: new vscode.Position(2, 21),
                actDist: 0

            }
        ];

        for (const test of tests) {
            let range = new vscode.Range(test.actPosition, test.actPosition);
            assert.deepEqual(test.exp, ac.isWithInRange(range, ac.ranges[test.actDist]));
        }
    });

    test("Count QuickPickItems", () => {
        let items = ac.buildQuickPick();
        assert.equal(16, items.length);
    });

    test("Parent checked", () => {

        let tests = [
            {
                exp: ["[x]", "[x]"],
                actRange: new vscode.Range(new vscode.Position(5, 4), new vscode.Position(5, 7)),
                actDist: "[x]"
            },
            {
                exp: ["[ ]", "[ ]"],
                actRange: new vscode.Range(new vscode.Position(4, 4), new vscode.Position(4, 7)),
                actDist: "[ ]"
            },
            {
                exp: ["[x]", "[x]", "[x]"],
                actRange: new vscode.Range(new vscode.Position(6, 6), new vscode.Position(6, 9)),
                actDist: "[x]"
            }
        ];

        for (const test of tests) {
            assert.deepEqual(test.exp, ac.checkParentTasks([{ dist: test.actDist, range: test.actRange }], lines).map((d) => { return d.dist; }));
        }
    });
});