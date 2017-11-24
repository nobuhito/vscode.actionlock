/* global suite, test */
const assert = require('assert');
const vscode = require('vscode');
const ActionLock = require('../src/actionlock');

suite("Extension Tests", function () {

    test("Parent checked", function () {
        let ac = new ActionLock(true);
        let lines = `
- [ ] test
- [ ] test1
  - [x] test2
  - [ ] test3
    - [ ] test4
        `.trim().split(/\r?\n/);

        let tests = [
            {
                exp: ["[x]", "[x]"],
                actRange: new vscode.Range(new vscode.Position(3, 4), new vscode.Position(3, 7)),
                actDist: "[x]"
            },
            {
                exp: ["[ ]", "[ ]"],
                actRange: new vscode.Range(new vscode.Position(2, 4), new vscode.Position(2, 7)),
                actDist: "[ ]"
            },
            {
                exp: ["[x]", "[x]", "[x]"],
                actRange: new vscode.Range(new vscode.Position(4, 6), new vscode.Position(4, 9)),
                actDist: "[x]"
            }
        ];

        for (const test of tests) {
            assert.deepEqual(test.exp, ac.checkParentTasks([{ dist: test.actDist, range: test.actRange }], lines).map((d) => { return d.dist; }));
        }

        // let range1 = new vscode.Range(new vscode.Position(3, 4), new vscode.Position(3, 7));
        // assert.deepEqual(
        //     ["[x]", "[x]"],
        //     ac.checkParentTasks([{ dist: "[x]", range: range1 }], lines).map(function (d) { return d.dist; })
        // );

        // let range2 = new vscode.Range(new vscode.Position(2, 4), new vscode.Position(2, 7));
        // assert.deepEqual(
        //     ["[ ]", "[ ]"],
        //     ac.checkParentTasks([{ dist: "[ ]", range: range2 }], lines).map(function (d) { return d.dist; })
        // );

        // let range3 = new vscode.Range(new vscode.Position(4, 6), new vscode.Position(4, 9));
        // assert.deepEqual(
        //     ["[x]", "[x]", "[x]"],
        //     ac.checkParentTasks([{ dist: "[x]", range: range3 }], lines).map(function (d) { return d.dist; })
        // );
    });
});