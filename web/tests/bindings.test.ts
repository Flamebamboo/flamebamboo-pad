import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  ACTIONS,
  bindingFromKeys,
  createBlankProfile,
  createDefaultProfile,
  createProfile,
  duplicateProfile,
  generateFirmware,
  parseProfile,
  serializeProfile,
  shortcutFromKeyboardEvent,
  validateProfile,
  type Profile,
} from "../src/lib/bindings.ts";

const pythonExecutable =
  process.env.PYTHON_EXECUTABLE ||
  (process.platform === "win32" ? "python" : "python3");

const originalBindings = [
  ["MUTE"],
  ["LGUI", "Z"],
  ["LGUI", "LSFT", "Z"],
  ["LGUI", "G"],
  ["SPACE"],
  ["LGUI", "B"],
  ["N6"],
  ["LGUI", "LSFT", "LBRACKET"],
  ["LGUI", "LSFT", "RBRACKET"],
  ["N9"],
  ["LGUI", "I"],
  ["BSPACE"],
];

function changedProfile(change: (profile: Profile) => void): Profile {
  const profile = createDefaultProfile();
  change(profile);
  return profile;
}

function pythonAst(source: string): {
  matrixBindings: string[][];
  encoderBindings: string[][];
} {
  const result = spawnSync(
    pythonExecutable,
    [
      "-c",
      `
import ast, json, sys
tree = ast.parse(sys.stdin.read(), filename='code.py')
assignments = {}
symbols = {}
for node in ast.walk(tree):
    if isinstance(node, ast.Assign):
        for target in node.targets:
            if isinstance(target, ast.Name):
                symbols[target.id] = node.value
            if isinstance(target, ast.Attribute) and isinstance(target.value, ast.Name):
                assignments[target.value.id + '.' + target.attr] = node.value
matrix = assignments['keyboard.keymap']
encoder = assignments['encoder_handler.map']
assert isinstance(matrix, ast.List) and len(matrix.elts) == 1
assert isinstance(matrix.elts[0], (ast.List, ast.Tuple))
assert isinstance(encoder, ast.List) and len(encoder.elts) == 1
def binding_keys(node):
    if isinstance(node, ast.Name):
        return binding_keys(symbols[node.id])
    if isinstance(node, ast.Attribute) and isinstance(node.value, ast.Name) and node.value.id == 'KC':
        return [] if node.attr == 'NO' else [node.attr]
    if isinstance(node, ast.Call) and isinstance(node.func, ast.Attribute) and node.func.attr == 'MACRO':
        keys = []
        for step in node.args:
            assert isinstance(step, ast.Call) and isinstance(step.func, ast.Name)
            if step.func.id in ('Press', 'Tap'):
                keys.extend(binding_keys(step.args[0]))
        return keys
    raise AssertionError('Unexpected generated binding: ' + ast.dump(node))
print(json.dumps({'matrixBindings': [binding_keys(node) for node in matrix.elts[0].elts], 'encoderBindings': [binding_keys(node) for node in encoder.elts[0].elts[0].elts]}))
`,
    ],
    { input: source, encoding: "utf8" },
  );
  assert.equal(result.status, 0, result.stderr || result.error?.message);
  return JSON.parse(result.stdout);
}

test("editing preset preserves all 12 original bindings, including encoder push", () => {
  const profile = createDefaultProfile();
  assert.deepEqual(
    profile.bindings.map((binding) => binding.keys),
    originalBindings,
  );
  assert.deepEqual(profile.encoder.clockwise.keys, ["VOLU"]);
  assert.deepEqual(profile.encoder.counterclockwise.keys, ["VOLD"]);
  assert.equal(profile.bindings[0].keys[0], "MUTE");
});

test("profile factories and duplication do not share mutable binding arrays", () => {
  const first = createDefaultProfile("First");
  const second = createDefaultProfile("Second");
  const copy = duplicateProfile(first, "Copy");
  assert.notEqual(copy.id, first.id);
  assert.equal(copy.name, "Copy");
  copy.bindings[1].keys[0] = "LCTL";
  copy.encoder.clockwise.keys[0] = "N1";
  first.bindings[0].keys[0] = "SPACE";
  assert.deepEqual(
    second.bindings.map((binding) => binding.keys),
    originalBindings,
  );
  assert.deepEqual(first.bindings[1].keys, ["LGUI", "Z"]);
  assert.deepEqual(first.encoder.clockwise.keys, ["VOLU"]);
  assert.equal(
    ACTIONS.find(
      (action) => action.keys.length === 1 && action.keys[0] === "MUTE",
    )?.keys[0],
    "MUTE",
  );
});

test("blank and everyday profiles create complete valid maps", () => {
  const blank = createBlankProfile("New layout");
  assert.equal(blank.bindings.length, 12);
  assert.ok(blank.bindings.every((binding) => binding.keys.length === 0));
  assert.equal(validateProfile(blank).name, "New layout");
  const everyday = createProfile("Everyday", "everyday");
  assert.equal(validateProfile(everyday).bindings.length, 12);
  assert.ok(everyday.bindings.some((binding) => binding.keys.length > 0));
});

test("JSON export/import preserves the full profile and versioned envelope", () => {
  const profile = createDefaultProfile("My editing profile");
  const serialized = serializeProfile(profile);
  assert.equal(JSON.parse(serialized).version, 1);
  assert.deepEqual(parseProfile(serialized), profile);
  const imported = parseProfile(serialized);
  imported.bindings[0].keys.push("A");
  assert.equal(profile.bindings[0].keys.length, 1);
});

test("profile import rejects malformed JSON, unsupported schema, and oversized input", () => {
  assert.throws(() => parseProfile("{not json}"));
  assert.throws(() =>
    parseProfile(
      JSON.stringify({ version: 2, profile: createDefaultProfile() }),
    ),
  );
  assert.throws(() => parseProfile(JSON.stringify({ version: 1 })));
  assert.throws(() => parseProfile(" ".repeat(128 * 1024 + 1)));
});

test("profile validation rejects malformed mappings and invalid identifiers", () => {
  assert.throws(() => validateProfile(null));
  assert.throws(() => validateProfile({}));
  assert.throws(() =>
    validateProfile(
      changedProfile((profile) => {
        profile.bindings.pop();
      }),
    ),
  );
  assert.throws(() =>
    validateProfile(
      changedProfile((profile) => {
        profile.bindings.push(profile.bindings[0]);
      }),
    ),
  );
  assert.throws(() =>
    validateProfile(
      changedProfile((profile) => {
        profile.name = " ".repeat(4);
      }),
    ),
  );
  assert.throws(() =>
    validateProfile(
      changedProfile((profile) => {
        profile.name = "x".repeat(41);
      }),
    ),
  );
  assert.throws(() =>
    validateProfile(
      changedProfile((profile) => {
        profile.name = "Unsafe\nname";
      }),
    ),
  );
  assert.throws(() =>
    validateProfile(
      changedProfile((profile) => {
        profile.id = "x".repeat(81);
      }),
    ),
  );
  assert.throws(() =>
    validateProfile(
      changedProfile((profile) => {
        profile.bindings[0].label = "x".repeat(41);
      }),
    ),
  );
  assert.throws(() =>
    validateProfile(
      changedProfile((profile) => {
        profile.encoder.clockwise.keys = ["NOT_A_KEY"];
      }),
    ),
  );
});

test("key validation refuses code injection, invalid chords, and repeated modifiers", () => {
  for (const keys of [
    ['A); __import__("os").system("bad")'],
    ["LGUI", "LGUI", "Z"],
    ["A", "B"],
    ["LCTL", "MUTE"],
    ["NOT_A_KEY"],
  ]) {
    assert.throws(
      () => bindingFromKeys(keys),
      `invalid keys: ${keys.join(",")}`,
    );
  }
  assert.deepEqual(bindingFromKeys(["LGUI", "LSHIFT", "Z"]).keys, [
    "LGUI",
    "LSFT",
    "Z",
  ]);
  assert.deepEqual(bindingFromKeys([]).keys, []);
});

test("firmware output parses as Python and exports all matrix and encoder positions", () => {
  const source = generateFirmware(createDefaultProfile());
  assert.deepEqual(pythonAst(source), {
    matrixBindings: originalBindings,
    encoderBindings: [["VOLU"], ["VOLD"], []],
  });
  for (const assignment of [
    "COL0 = board.D0",
    "COL1 = board.D1",
    "COL2 = board.D2",
    "ROW0 = board.D9",
    "ROW1 = board.D8",
    "ROW2 = board.D7",
    "ROW3 = board.D3",
    "SDA = board.D4",
    "SCL = board.D5",
    "SW1A = board.D10",
    "SW1B = board.D6",
  ])
    assert.ok(source.includes(assignment), assignment);
  assert.match(source, /DiodeOrientation\.COL2ROW/);
  assert.match(source, /height\s*=\s*32/);
  assert.match(source, /keyboard\.go\(\)/);
});

test("generated firmware preserves the repository hardware initialization", () => {
  const original = readFileSync(
    new URL("../../Firmware/Main.py", import.meta.url),
    "utf8",
  );
  const generated = generateFirmware(createDefaultProfile());
  const result = spawnSync(
    pythonExecutable,
    [
      "-c",
      `
import ast, json, sys
original, generated = json.load(sys.stdin)
names = {
    'COL0', 'COL1', 'COL2', 'ROW0', 'ROW1', 'ROW2', 'ROW3',
    'SDA', 'SCL', 'SW1A', 'SW1B', 'ROW_PINS', 'COL_PINS',
    'i2c_bus', 'display_driver', 'display',
    'keyboard.matrix', 'encoder_handler.pins',
}
def hardware(source):
    result = {}
    for node in ast.walk(ast.parse(source)):
        if isinstance(node, ast.Assign):
            for target in node.targets:
                name = ast.unparse(target)
                if name in names:
                    result[name] = ast.dump(node.value, include_attributes=False)
    assert set(result) == names, 'Missing hardware initialization'
    return result
assert hardware(original) == hardware(generated), 'Generated hardware setup differs from Firmware/Main.py'
`,
    ],
    { input: JSON.stringify([original, generated]), encoding: "utf8" },
  );
  assert.equal(result.status, 0, result.stderr || result.error?.message);
});

test("chords hold modifiers through the tap and release them in reverse order", () => {
  const profile = createBlankProfile();
  profile.bindings[5] = bindingFromKeys(
    ["LCTL", "LALT", "LSFT", "Z"],
    "My shortcut",
  );
  const source = generateFirmware(profile);
  assert.match(
    source,
    /Press\(KC\.LCTL\)[\s\S]*Press\(KC\.LALT\)[\s\S]*Press\(KC\.LSFT\)[\s\S]*Tap\(KC\.Z\)[\s\S]*Release\(KC\.LSFT\)[\s\S]*Release\(KC\.LALT\)[\s\S]*Release\(KC\.LCTL\)/,
  );
  const parsed = pythonAst(source);
  assert.equal(parsed.matrixBindings.length, 12);
  assert.deepEqual(parsed.matrixBindings[5], ["LCTL", "LALT", "LSFT", "Z"]);
  assert.equal(parsed.encoderBindings.length, 3);
});

test("labels and profile names cannot add executable content to firmware", () => {
  const marker = "INJECT_MARKER";
  const profile = createBlankProfile(`'${marker}'`);
  profile.bindings[0] = bindingFromKeys(["SPACE"], `"${marker}"`);
  const source = generateFirmware(profile);
  assert.ok(!source.includes(marker));
  const parsed = pythonAst(source);
  assert.deepEqual(parsed.matrixBindings[0], ["SPACE"]);
  assert.equal(parsed.matrixBindings.length, 12);
});

test("export revalidates profiles instead of trusting callers", () => {
  const invalid = changedProfile((profile) => {
    profile.bindings[0].keys = ["unsafe()"];
  });
  assert.throws(() => generateFirmware(invalid));
  assert.throws(() => serializeProfile(invalid));
});

test("keyboard recording uses physical key codes and rejects unsupported events", () => {
  const event = {
    code: "KeyZ",
    key: "z",
    ctrlKey: true,
    metaKey: false,
    shiftKey: true,
    altKey: false,
    repeat: false,
  } as Parameters<typeof shortcutFromKeyboardEvent>[0];
  assert.deepEqual(shortcutFromKeyboardEvent(event), ["LCTL", "LSFT", "Z"]);
  for (const key of ["Control", "Alt", "Shift", "Meta", "AltGraph"]) {
    assert.equal(
      shortcutFromKeyboardEvent({ ...event, code: `${key}Left`, key }),
      null,
    );
  }
  assert.deepEqual(
    shortcutFromKeyboardEvent({ ...event, code: "BracketLeft", key: "{" }),
    ["LCTL", "LSFT", "LBRACKET"],
  );
  assert.equal(
    shortcutFromKeyboardEvent({
      ...event,
      code: "Unidentified",
      key: "Unidentified",
    }),
    null,
  );
});
