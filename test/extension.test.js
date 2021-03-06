/* global suite, test */
const assert = require('assert');
const vscode = require('vscode');
const ActionLock = require('../src/actionlock');

suite("Extension Tests", function () {
    let lines = `
# test

- [ ] test 2017-11-27   2
- [ ] test 2017-01-14   3
  - [x] test 2017-01-14 4
  - [ ] test            5
    - [ ] test          6
- [x] test              7
  - test                8
    - [ ] test          9
    - [x] test         10  -> 2018-01-15
    - [x] test         11
  - [x] test           12
  - [ ] test           13
    - test             14
  - [x] test           15
    - [ ] test         16
      - [ ] test       17
    - [ ] test         18
      - [ ] test       19
- [ ] test             20
  - [ ] test           21
    - [ ] test         22
    - [ ] test         23
- [x] test             24
  - [x] test           25
    - [x] test         26
    - [x] test         27
`.trim().split(/\r?\n/);

    let ac = new ActionLock(true);

    test("Count Ranges", () => {
        ac.makeRanges(lines);
        assert.deepEqual(28, ac.ranges.length);

        let notInstalledMDTasks = new ActionLock(false);
        notInstalledMDTasks.makeRanges(lines);
        assert.deepEqual(4, notInstalledMDTasks.ranges.length);

    });

    test("Checkbox position", () => {
        let tests = [
            {
                exp: 3,
                line: 2
            },
            {
                exp: 3,
                line: 3
            },
            {
                exp: 5,
                line: 4
            },
            {
                exp: 7,
                line: 10
            }
        ];
        for (const test of tests) {
            let position = ac.findCheckboxAtCursorLine(test.line);
            assert.deepEqual(new vscode.Position(test.line, test.exp), position);
        }
    });

    test("With in range", () => {
        ac.makeRanges(lines);

        let tests = [

            {
                exp: false,
                actPosition: new vscode.Position(5, 4),
                actDist: 6
            },
            {
                exp: true,
                actPosition: new vscode.Position(5, 5),
                actDist: 6
            },
            {
                exp: true,
                actPosition: new vscode.Position(5, 6),
                actDist: 6
            },
            {
                exp: false,
                actPosition: new vscode.Position(5, 7),
                actDist: 6
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
            },
            {
                exp: ["[ ]", "[ ]"],
                actRange: new vscode.Range(new vscode.Position(15, 4), new vscode.Position(15, 7)),
                actDist: "[ ]"
            },
            {
                exp: ["[x]"],
                actRange: new vscode.Range(new vscode.Position(9, 6), new vscode.Position(9, 9)),
                actDist: "[x]"
            },
            {
                exp: ["[x]", "[ ]", "[ ]"],
                actRange: new vscode.Range(new vscode.Position(22, 6), new vscode.Position(22, 9)),
                actDist: "[x]"
            },
            {
                exp: ["[ ]", "[ ]", "[ ]"],
                actRange: new vscode.Range(new vscode.Position(27, 6), new vscode.Position(27, 9)),
                actDist: "[ ]"
            },
        ];

        for (const test of tests) {
            assert.deepEqual(test.exp, ac.checkParentTasks([{ dist: test.actDist, range: test.actRange }], lines).map((d) => { return d.dist; }));
        }
    });
});