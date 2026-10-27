/** The profile format is intentionally data-only: imports never contain Python. */
export interface Binding {
  id: string;
  label: string;
  keys: string[];
}

export type ActionCategory = "editing" | "media" | "navigation" | "system";

export interface Action extends Binding {
  category: ActionCategory;
  description: string;
}

export interface Profile {
  id: string;
  name: string;
  /** Scan order: encoder push, then the eleven switches (four rows of three). */
  bindings: Binding[];
  encoder: { clockwise: Binding; counterclockwise: Binding };
}

export type ProfilePreset = "editing" | "everyday" | "blank";

export const ACTION_CATEGORIES: { id: ActionCategory; label: string }[] = [
  { id: "editing", label: "Editing" },
  { id: "media", label: "Media controls" },
  { id: "navigation", label: "Navigation" },
  { id: "system", label: "Everyday" },
];

export const MODIFIER_KEYS = [
  "LCTL",
  "LALT",
  "LSFT",
  "LGUI",
  "RCTL",
  "RALT",
  "RSFT",
  "RGUI",
] as const;
const modifierSet = new Set<string>(MODIFIER_KEYS);
const mediaKeys = [
  "MUTE",
  "VOLU",
  "VOLD",
  "MPLY",
  "MNXT",
  "MPRV",
  "MSTP",
  "BRIU",
  "BRID",
];
const mediaSet = new Set(mediaKeys);

export const KEY_LABELS: Record<string, string> = {
  LCTL: "⌃",
  RCTL: "Right Ctrl",
  LALT: "⌥",
  RALT: "Right Alt",
  LSFT: "⇧",
  RSFT: "Right Shift",
  LGUI: "⌘",
  RGUI: "Right Cmd",
  ENTER: "Return",
  ESC: "Escape",
  BSPACE: "Backspace",
  TAB: "Tab",
  SPACE: "Space",
  MINUS: "−",
  EQUAL: "=",
  LBRACKET: "[",
  RBRACKET: "]",
  BACKSLASH: "\\",
  SEMICOLON: ";",
  QUOTE: "'",
  GRAVE: "`",
  COMMA: ",",
  DOT: ".",
  SLASH: "/",
  CAPSLOCK: "Caps Lock",
  PSCREEN: "Print Screen",
  SCROLLLOCK: "Scroll Lock",
  PAUSE: "Pause",
  INS: "Insert",
  HOME: "Home",
  PGUP: "Page Up",
  DEL: "Delete",
  END: "End",
  PGDOWN: "Page Down",
  RIGHT: "→",
  LEFT: "←",
  DOWN: "↓",
  UP: "↑",
  MUTE: "Mute",
  VOLU: "Volume +",
  VOLD: "Volume −",
  MPLY: "Play / pause",
  MNXT: "Next track",
  MPRV: "Previous track",
  MSTP: "Stop",
  BRIU: "Brightness +",
  BRID: "Brightness −",
};

const letterKeys = Array.from({ length: 26 }, (_, index) =>
  String.fromCharCode(65 + index),
);
const digitKeys = Array.from({ length: 10 }, (_, index) => `N${index}`);
const functionKeys = Array.from({ length: 24 }, (_, index) => `F${index + 1}`);
const standardKeys = [
  ...letterKeys,
  ...digitKeys,
  ...functionKeys,
  ...Object.keys(KEY_LABELS).filter(
    (key) => !modifierSet.has(key) && !mediaSet.has(key),
  ),
];
const allowedKeys = new Set([...standardKeys, ...MODIFIER_KEYS, ...mediaKeys]);
const aliases: Record<string, string> = {
  LCTRL: "LCTL",
  RCTRL: "RCTL",
  LSHIFT: "LSFT",
  RSHIFT: "RSFT",
  LCMD: "LGUI",
  RCMD: "RGUI",
  LWIN: "LGUI",
  RWIN: "RGUI",
  ESCAPE: "ESC",
  BACKSPACE: "BSPACE",
  DELETE: "DEL",
  INSERT: "INS",
  PGDN: "PGDOWN",
};

export const KEY_OPTIONS = [...standardKeys, ...mediaKeys].map((value) => ({
  value,
  label:
    KEY_LABELS[value] ??
    (value.startsWith("N") && value.length === 2 ? value.slice(1) : value),
}));

function makeId(prefix: string): string {
  const suffix =
    typeof globalThis.crypto?.randomUUID === "function"
      ? globalThis.crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 11)}`;
  return `${prefix}-${suffix}`;
}

function normalizeKeys(input: unknown): string[] {
  if (!Array.isArray(input) || input.length > 5) {
    throw new Error(
      "A binding must contain at most four modifiers and one key.",
    );
  }
  const keys = input.map((value) => {
    if (typeof value !== "string")
      throw new Error("Every shortcut key must be a supported key name.");
    const canonical = aliases[value] ?? value;
    if (!allowedKeys.has(canonical))
      throw new Error(`Unsupported key: ${value.slice(0, 40)}`);
    return canonical;
  });
  if (new Set(keys).size !== keys.length)
    throw new Error("A shortcut cannot repeat the same key.");
  if (keys.length > 1 && keys.some((key) => mediaSet.has(key))) {
    throw new Error(
      "Media controls cannot be combined with keyboard modifiers.",
    );
  }
  const modifiers = keys.filter((key) => modifierSet.has(key));
  const ordinary = keys.filter((key) => !modifierSet.has(key));
  if (ordinary.length > 1 || (keys.length > 1 && ordinary.length === 0)) {
    throw new Error("Choose one key, optionally combined with modifiers.");
  }
  return [...modifiers, ...ordinary];
}

function checkedText(input: unknown, field: string, maximum: number): string {
  if (
    typeof input !== "string" ||
    !input.trim() ||
    input.trim().length > maximum ||
    /[\u0000-\u001f\u007f]/.test(input)
  ) {
    throw new Error(
      `${field} must be between 1 and ${maximum} characters and contain no control characters.`,
    );
  }
  return input.trim();
}

function checkedId(input: unknown): string {
  if (typeof input !== "string" || !/^[A-Za-z0-9_-]{1,80}$/.test(input)) {
    throw new Error("Invalid profile or binding identifier.");
  }
  return input;
}

function object(input: unknown, field: string): Record<string, unknown> {
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw new Error(`Invalid ${field}.`);
  return input as Record<string, unknown>;
}

function validateBinding(input: unknown): Binding {
  const binding = object(input, "binding");
  return {
    id: checkedId(binding.id),
    label: checkedText(binding.label, "Binding label", 40),
    keys: normalizeKeys(binding.keys),
  };
}

export function validateProfile(input: unknown): Profile {
  const profile = object(input, "profile");
  if (!Array.isArray(profile.bindings) || profile.bindings.length !== 12) {
    throw new Error(
      "A Flamebamboo profile must contain exactly 12 matrix bindings.",
    );
  }
  const encoder = object(profile.encoder, "encoder bindings");
  return {
    id: checkedId(profile.id),
    name: checkedText(profile.name, "Profile name", 40),
    bindings: profile.bindings.map(validateBinding),
    encoder: {
      clockwise: validateBinding(encoder.clockwise),
      counterclockwise: validateBinding(encoder.counterclockwise),
    },
  };
}

export function formatShortcut(keys: string[]): string {
  if (!keys.length) return "Unassigned";
  return keys
    .map(
      (key) =>
        KEY_LABELS[key] ??
        (key.startsWith("N") && key.length === 2 ? key.slice(1) : key),
    )
    .join(" + ");
}

export function bindingFromKeys(keys: string[], label?: string): Binding {
  const normalized = normalizeKeys(keys);
  return {
    id: makeId("custom"),
    label: checkedText(
      label ?? formatShortcut(normalized),
      "Binding label",
      40,
    ),
    keys: normalized,
  };
}

function action(
  id: string,
  label: string,
  keys: string[],
  category: ActionCategory,
  description: string,
): Action {
  return { id, label, keys: normalizeKeys(keys), category, description };
}

export const ACTIONS: Action[] = [
  action("undo", "Undo", ["LGUI", "Z"], "editing", "Undo your last change"),
  action(
    "redo",
    "Redo",
    ["LGUI", "LSFT", "Z"],
    "editing",
    "Bring back your last change",
  ),
  action(
    "delete-gaps",
    "Delete gaps",
    ["LGUI", "G"],
    "editing",
    "Close gaps in your editing timeline",
  ),
  action(
    "razor",
    "Razor",
    ["LGUI", "B"],
    "editing",
    "Split a clip at the playhead",
  ),
  action(
    "import-media",
    "Import media",
    ["LGUI", "I"],
    "editing",
    "Bring footage into your project",
  ),
  action(
    "trim-start",
    "Trim start",
    ["LGUI", "LSFT", "LBRACKET"],
    "editing",
    "Trim the beginning of a clip",
  ),
  action(
    "trim-end",
    "Trim end",
    ["LGUI", "LSFT", "RBRACKET"],
    "editing",
    "Trim the end of a clip",
  ),
  action(
    "timeline-play",
    "Play timeline",
    ["SPACE"],
    "editing",
    "Play or pause the active timeline",
  ),
  action(
    "copy",
    "Copy",
    ["LGUI", "C"],
    "editing",
    "Copy the current selection",
  ),
  action(
    "paste",
    "Paste",
    ["LGUI", "V"],
    "editing",
    "Paste from the clipboard",
  ),
  action("cut", "Cut", ["LGUI", "X"], "editing", "Cut the current selection"),
  action("save", "Save", ["LGUI", "S"], "editing", "Save the active document"),
  action("mute", "Mute", ["MUTE"], "media", "Toggle system audio"),
  action("volume-up", "Volume up", ["VOLU"], "media", "Turn the volume up"),
  action(
    "volume-down",
    "Volume down",
    ["VOLD"],
    "media",
    "Turn the volume down",
  ),
  action(
    "media-play",
    "Play / pause",
    ["MPLY"],
    "media",
    "Control the active media player",
  ),
  action(
    "next-track",
    "Next track",
    ["MNXT"],
    "media",
    "Skip to the next track",
  ),
  action(
    "previous-track",
    "Previous track",
    ["MPRV"],
    "media",
    "Return to the previous track",
  ),
  action(
    "stop-media",
    "Stop playback",
    ["MSTP"],
    "media",
    "Stop the active media player",
  ),
  action(
    "brightness-up",
    "Brightness up",
    ["BRIU"],
    "media",
    "Increase screen brightness when supported",
  ),
  action(
    "brightness-down",
    "Brightness down",
    ["BRID"],
    "media",
    "Decrease screen brightness when supported",
  ),
  action(
    "enter",
    "Return",
    ["ENTER"],
    "navigation",
    "Confirm or start a new line",
  ),
  action(
    "escape",
    "Escape",
    ["ESC"],
    "navigation",
    "Dismiss the active dialog",
  ),
  action("tab", "Tab", ["TAB"], "navigation", "Move to the next field"),
  action(
    "backspace",
    "Backspace",
    ["BSPACE"],
    "navigation",
    "Delete the previous character",
  ),
  action(
    "delete",
    "Delete",
    ["DEL"],
    "navigation",
    "Delete the next character",
  ),
  action(
    "left",
    "Move left",
    ["LEFT"],
    "navigation",
    "Move one position to the left",
  ),
  action(
    "right",
    "Move right",
    ["RIGHT"],
    "navigation",
    "Move one position to the right",
  ),
  action("up", "Move up", ["UP"], "navigation", "Move one position up"),
  action("down", "Move down", ["DOWN"], "navigation", "Move one position down"),
  action("page-up", "Page up", ["PGUP"], "navigation", "Move up one page"),
  action(
    "page-down",
    "Page down",
    ["PGDOWN"],
    "navigation",
    "Move down one page",
  ),
  action(
    "select-all",
    "Select all",
    ["LGUI", "A"],
    "system",
    "Select everything in the active view",
  ),
  action("find", "Find", ["LGUI", "F"], "system", "Search the active document"),
  action(
    "new-tab",
    "New tab",
    ["LGUI", "T"],
    "system",
    "Open a new browser tab",
  ),
  action(
    "close-tab",
    "Close tab",
    ["LGUI", "W"],
    "system",
    "Close the current tab or window",
  ),
  action(
    "switch-app",
    "Switch app",
    ["LGUI", "TAB"],
    "system",
    "Switch to the previous application",
  ),
  action(
    "screenshot",
    "Screenshot",
    ["LGUI", "LSFT", "N4"],
    "system",
    "Select a screen region on macOS",
  ),
  action("six", "6", ["N6"], "system", "Press the number six"),
  action("nine", "9", ["N9"], "system", "Press the number nine"),
  action(
    "unassigned",
    "Unassigned",
    [],
    "system",
    "Leave this control without an action",
  ),
];

function catalogBinding(id: string): Binding {
  const item = ACTIONS.find((candidate) => candidate.id === id);
  if (!item) throw new Error(`Unknown action: ${id}`);
  return { id: item.id, label: item.label, keys: [...item.keys] };
}

const defaultActionIds = [
  "mute",
  "undo",
  "redo",
  "delete-gaps",
  "timeline-play",
  "razor",
  "six",
  "trim-start",
  "trim-end",
  "nine",
  "import-media",
  "backspace",
];
const everydayActionIds = [
  "mute",
  "copy",
  "paste",
  "undo",
  "redo",
  "cut",
  "find",
  "new-tab",
  "close-tab",
  "screenshot",
  "save",
  "enter",
];

export function createProfile(
  name: string,
  preset: ProfilePreset = "editing",
): Profile {
  if (!["editing", "everyday", "blank"].includes(preset))
    throw new Error("Unknown profile preset.");
  const ids =
    preset === "blank"
      ? Array<string>(12).fill("unassigned")
      : preset === "everyday"
        ? everydayActionIds
        : defaultActionIds;
  return {
    id: makeId("profile"),
    name: checkedText(name, "Profile name", 40),
    bindings: ids.map(catalogBinding),
    encoder: {
      clockwise: catalogBinding(
        preset === "blank" ? "unassigned" : "volume-up",
      ),
      counterclockwise: catalogBinding(
        preset === "blank" ? "unassigned" : "volume-down",
      ),
    },
  };
}

export function createDefaultProfile(name = "Video editing"): Profile {
  return createProfile(name, "editing");
}

export function createBlankProfile(name = "Untitled profile"): Profile {
  return createProfile(name, "blank");
}

export function duplicateProfile(profile: Profile, name?: string): Profile {
  const copy = validateProfile(profile);
  copy.id = makeId("profile");
  copy.name = checkedText(
    name ?? `${copy.name.slice(0, 35)} copy`,
    "Profile name",
    40,
  );
  return copy;
}

export function serializeProfile(profile: Profile): string {
  return (
    JSON.stringify({ version: 1, profile: validateProfile(profile) }, null, 2) +
    "\n"
  );
}

export function parseProfile(json: string): Profile {
  if (typeof json !== "string" || json.length > 128 * 1024)
    throw new Error("Choose a profile JSON file smaller than 128 KB.");
  let input: unknown;
  try {
    input = JSON.parse(json);
  } catch {
    throw new Error("This file is not valid JSON.");
  }
  const envelope = object(input, "profile file");
  if (envelope.version !== 1)
    throw new Error("This profile version is not supported.");
  return validateProfile(envelope.profile);
}

/** Convert physical browser key events to KMK keys; modifiers alone are not a chord. */
export function shortcutFromKeyboardEvent(
  event: Pick<
    KeyboardEvent,
    "code" | "key" | "ctrlKey" | "altKey" | "shiftKey" | "metaKey"
  >,
): string[] | null {
  const physicalKeys: Record<string, string> = {
    Enter: "ENTER",
    NumpadEnter: "ENTER",
    Escape: "ESC",
    Backspace: "BSPACE",
    Tab: "TAB",
    Space: "SPACE",
    Minus: "MINUS",
    Equal: "EQUAL",
    BracketLeft: "LBRACKET",
    BracketRight: "RBRACKET",
    Backslash: "BACKSLASH",
    Semicolon: "SEMICOLON",
    Quote: "QUOTE",
    Backquote: "GRAVE",
    Comma: "COMMA",
    Period: "DOT",
    Slash: "SLASH",
    CapsLock: "CAPSLOCK",
    PrintScreen: "PSCREEN",
    ScrollLock: "SCROLLLOCK",
    Pause: "PAUSE",
    Insert: "INS",
    Home: "HOME",
    PageUp: "PGUP",
    Delete: "DEL",
    End: "END",
    PageDown: "PGDOWN",
    ArrowRight: "RIGHT",
    ArrowLeft: "LEFT",
    ArrowDown: "DOWN",
    ArrowUp: "UP",
    AudioVolumeMute: "MUTE",
    AudioVolumeUp: "VOLU",
    AudioVolumeDown: "VOLD",
    MediaPlayPause: "MPLY",
    MediaTrackNext: "MNXT",
    MediaTrackPrevious: "MPRV",
  };
  if (["Control", "Alt", "Shift", "Meta", "AltGraph"].includes(event.key))
    return null;
  let key = physicalKeys[event.code];
  if (/^Key[A-Z]$/.test(event.code)) key = event.code.slice(3);
  else if (/^Digit[0-9]$/.test(event.code)) key = `N${event.code.slice(5)}`;
  else if (/^F(?:[1-9]|1[0-9]|2[0-4])$/.test(event.code)) key = event.code;
  if (!key && /^[a-z]$/i.test(event.key)) key = event.key.toUpperCase();
  if (!key && /^[0-9]$/.test(event.key)) key = `N${event.key}`;
  if (!key) return null;
  const keys = [
    ...(event.ctrlKey ? ["LCTL"] : []),
    ...(event.altKey ? ["LALT"] : []),
    ...(event.shiftKey ? ["LSFT"] : []),
    ...(event.metaKey ? ["LGUI"] : []),
    key,
  ];
  try {
    return normalizeKeys(keys);
  } catch {
    return null;
  }
}

function pythonBinding(binding: Binding): string {
  if (!binding.keys.length) return "KC.NO";
  if (binding.keys.length === 1) return `KC.${binding.keys[0]}`;
  const modifiers = binding.keys.slice(0, -1);
  const key = binding.keys[binding.keys.length - 1];
  const events = [
    ...modifiers.map((modifier) => `Press(KC.${modifier})`),
    `Tap(KC.${key})`,
    ...modifiers
      .slice()
      .reverse()
      .map((modifier) => `Release(KC.${modifier})`),
  ];
  return `KC.MACRO(${events.join(", ")})`;
}

/** All source interpolations come from validated, fixed keycodes. User text is not executable. */
export function generateFirmware(input: Profile): string {
  const profile = validateProfile(input);
  const rows = Array.from(
    { length: 4 },
    (_, row) =>
      "        " +
      profile.bindings
        .slice(row * 3, row * 3 + 3)
        .map(pythonBinding)
        .join(", ") +
      ",",
  ).join("\n");
  return `# Generated by Flamebamboo Studio.
# Back up the current CIRCUITPY files before replacing code.py.
# Keep the existing KMK library on your device.
# Hardware initialization matches Firmware/Main.py in flamebamboo-pad.

import board
import busio
from kmk.kmk_keyboard import KMKKeyboard
from kmk.scanners.keypad import MatrixScanner
from kmk.scanners import DiodeOrientation
from kmk.keys import KC
from kmk.modules.encoder import EncoderHandler
from kmk.extensions.media_keys import MediaKeys
from kmk.modules.macros import Macros, Press, Release, Tap
from kmk.extensions.display import Display, TextEntry, ImageEntry
from kmk.extensions.display.ssd1306 import SSD1306

COL0 = board.D0
COL1 = board.D1
COL2 = board.D2
ROW0 = board.D9
ROW1 = board.D8
ROW2 = board.D7
ROW3 = board.D3
SDA = board.D4
SCL = board.D5
SW1A = board.D10
SW1B = board.D6

keyboard = KMKKeyboard()
keyboard.extensions.append(MediaKeys())
macros = Macros()
keyboard.modules.append(macros)

i2c_bus = busio.I2C(SCL, SDA)
display_driver = SSD1306(i2c=i2c_bus)
display = Display(
    display=display_driver,
    entries=[TextEntry(text='flamebamboo', x=30, y=15)],
    height=32,
    dim_time=10,
    dim_target=0.2,
    off_time=1200,
    brightness=1,
)
keyboard.extensions.append(display)

ROW_PINS = [ROW0, ROW1, ROW2, ROW3]
COL_PINS = [COL0, COL1, COL2]
keyboard.matrix = MatrixScanner(
    column_pins=COL_PINS,
    row_pins=ROW_PINS,
    columns_to_anodes=DiodeOrientation.COL2ROW,
    interval=0.02,
    max_events=64,
)

# Encoder push is matrix position 0, not a separate encoder button pin.
encoder_handler = EncoderHandler()
encoder_handler.pins = ((SW1A, SW1B, None),)
encoder_handler.map = [((${pythonBinding(profile.encoder.clockwise)}, ${pythonBinding(profile.encoder.counterclockwise)}, KC.NO),)]
keyboard.modules.append(encoder_handler)

keyboard.keymap = [
    [
${rows}
    ]
]

if __name__ == '__main__':
    keyboard.go()
`;
}
