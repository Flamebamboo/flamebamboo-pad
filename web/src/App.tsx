import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  ArrowDown,
  ArrowDownToLine,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowUpRight,
  AudioLines,
  BookOpen,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Clipboard,
  Command,
  Copy,
  CornerDownLeft,
  Download,
  FileJson,
  Film,
  Flame,
  FolderOpen,
  Grid2X2,
  Keyboard,
  Layers,
  MousePointer2,
  Plus,
  Redo2,
  RotateCcw,
  RotateCw,
  Scissors,
  Search,
  Settings2,
  SlidersHorizontal,
  Trash2,
  Undo2,
  Upload,
  Volume1,
  Volume2,
  VolumeX,
  X,
  type LucideIcon,
} from "lucide-react";
import {
  ACTIONS,
  ACTION_CATEGORIES,
  KEY_OPTIONS,
  MODIFIER_KEYS,
  bindingFromKeys,
  createDefaultProfile,
  createProfile,
  duplicateProfile,
  formatShortcut,
  generateFirmware,
  parseProfile,
  serializeProfile,
  shortcutFromKeyboardEvent,
  validateProfile,
  type Binding,
  type Profile,
  type ProfilePreset,
} from "./lib/bindings";

type Target = number | "clockwise" | "counterclockwise";
type Workspace = { version: 1; profiles: Profile[]; activeId: string };
type Modal = "profiles" | "export" | "about" | null;
const STORAGE_KEY = "flamebamboo-studio-v1";
const LEFT_MODIFIERS = [
  { key: "LGUI", label: "⌘ / Win", name: "Command / Windows" },
  { key: "LCTL", label: "Ctrl", name: "Control" },
  { key: "LALT", label: "Alt", name: "Alt / Option" },
  { key: "LSFT", label: "Shift", name: "Shift" },
];

function readWorkspace(): {
  workspace: Workspace;
  warning: string;
  recovery: string | null;
} {
  let warning = "";
  let saved: string | null = null;
  try {
    saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const data = JSON.parse(saved);
      if (
        data.version !== 1 ||
        !Array.isArray(data.profiles) ||
        !data.profiles.length ||
        data.profiles.length > 100
      )
        throw new Error();
      const profiles: Profile[] = data.profiles.map(validateProfile);
      if (
        new Set(profiles.map((profile) => profile.id)).size !== profiles.length
      )
        throw new Error();
      return {
        workspace: {
          version: 1,
          profiles,
          activeId: profiles.some((profile) => profile.id === data.activeId)
            ? data.activeId
            : profiles[0].id,
        },
        warning,
        recovery: null,
      };
    }
  } catch {
    warning = saved
      ? "Saved profiles could not be loaded. Your original data is preserved; download a recovery copy to inspect it."
      : "Browser storage is unavailable. Export a profile backup to keep your changes.";
  }
  const profiles = [
    createDefaultProfile(),
    createProfile("Everyday", "everyday"),
  ];
  return {
    workspace: { version: 1, profiles, activeId: profiles[0].id },
    warning,
    recovery: saved,
  };
}

function downloadText(filename: string, contents: string, type: string) {
  const url = URL.createObjectURL(new Blob([contents], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function iconFor(binding: Binding): LucideIcon {
  const icons: Record<string, LucideIcon> = {
    undo: Undo2,
    redo: Redo2,
    "delete-gaps": SlidersHorizontal,
    razor: Scissors,
    "import-media": FolderOpen,
    "trim-start": ArrowLeft,
    "trim-end": ArrowRight,
    "timeline-play": Film,
    copy: Copy,
    paste: Clipboard,
    cut: Scissors,
    save: Download,
    mute: VolumeX,
    "volume-up": Volume2,
    "volume-down": Volume1,
    "media-play": AudioLines,
    "next-track": ArrowRight,
    "previous-track": ArrowLeft,
    enter: CornerDownLeft,
    backspace: ArrowLeft,
    delete: Trash2,
    left: ArrowLeft,
    right: ArrowRight,
    up: ArrowUp,
    down: ArrowDown,
    find: Search,
    unassigned: Plus,
  };
  return Object.hasOwn(icons, binding.id)
    ? icons[binding.id]
    : binding.keys.length > 1
      ? Command
      : Keyboard;
}

function BindingIcon({
  binding,
  size = 19,
}: {
  binding: Binding;
  size?: number;
}) {
  if (/^N[0-9]$/.test(binding.keys[0] ?? "") && binding.keys.length === 1)
    return <span className="number-icon">{binding.keys[0].slice(1)}</span>;
  const Icon = iconFor(binding);
  return <Icon size={size} strokeWidth={1.6} aria-hidden="true" />;
}

function targetName(target: Target) {
  return typeof target === "number"
    ? target === 0
      ? "Encoder press"
      : `Key ${String(target).padStart(2, "0")}`
    : target === "clockwise"
      ? "Rotate clockwise"
      : "Rotate counterclockwise";
}

function Dialog({
  title,
  eyebrow,
  children,
  close,
  wide = false,
}: {
  title: string;
  eyebrow?: string;
  children: ReactNode;
  close: () => void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(close);
  closeRef.current = close;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    ref.current
      ?.querySelector<HTMLElement>('button, input, select, [tabindex="0"]')
      ?.focus();
    function keydown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        closeRef.current();
      }
      if (event.key !== "Tab") return;
      const items = Array.from(
        ref.current?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), select:not([disabled]), a[href], [tabindex="0"]',
        ) ?? [],
      ).filter((item) => item.getClientRects().length);
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    }
    document.addEventListener("keydown", keydown);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener("keydown", keydown);
      previous?.focus();
    };
  }, []);
  return (
    <div
      className="dialog-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <div
        className={`dialog ${wide ? "dialog-wide" : ""}`}
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
      >
        <div className="dialog-header">
          <div>
            {eyebrow && <span className="eyebrow">{eyebrow}</span>}
            <h2 id="dialog-title">{title}</h2>
          </div>
          <button className="icon-button" onClick={close} aria-label="Close">
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export default function App() {
  const [initial] = useState(readWorkspace);
  const [workspace, setWorkspace] = useState(initial.workspace);
  const [storageWarning, setStorageWarning] = useState(initial.warning);
  const profile = workspace.profiles.find(
    (item) => item.id === workspace.activeId,
  )!;
  const [target, setTarget] = useState<Target>(1);
  const currentBinding =
    typeof target === "number"
      ? profile.bindings[target]
      : profile.encoder[target];
  const [pending, setPending] = useState<Binding>(currentBinding);
  const [tab, setTab] = useState<"library" | "custom">("library");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [customLabel, setCustomLabel] = useState("");
  const [customKey, setCustomKey] = useState("Z");
  const [customModifiers, setCustomModifiers] = useState<string[]>(["LGUI"]);
  const [recording, setRecording] = useState(false);
  const [bindingError, setBindingError] = useState("");
  const [modal, setModal] = useState<Modal>(null);
  const [toast, setToast] = useState("");
  const [showLabels, setShowLabels] = useState(true);
  const [newProfileOpen, setNewProfileOpen] = useState(false);
  const [newProfileName, setNewProfileName] = useState("");
  const [preset, setPreset] = useState<ProfilePreset>("editing");
  const [profileError, setProfileError] = useState("");
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [exported, setExported] = useState(false);
  const [showCode, setShowCode] = useState(false);
  const recoverySaved = useRef(false);
  const importRef = useRef<HTMLInputElement>(null);
  const inspectorRef = useRef<HTMLElement>(null);

  function persist(next: Workspace) {
    setWorkspace(next);
    try {
      if (initial.recovery && !recoverySaved.current) {
        localStorage.setItem(
          `${STORAGE_KEY}-recovery-${Date.now()}`,
          initial.recovery,
        );
        recoverySaved.current = true;
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      setStorageWarning("");
    } catch {
      setStorageWarning(
        "Browser storage is unavailable. Your changes work for this session; export a profile backup to keep them.",
      );
    }
    setExported(false);
  }
  function notify(message: string) {
    setToast(message);
  }
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 4200);
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    setPending(currentBinding);
    setCustomLabel(currentBinding.label);
    setCustomKey(
      currentBinding.keys.find(
        (key) => !(MODIFIER_KEYS as readonly string[]).includes(key),
      ) ?? "",
    );
    setCustomModifiers(
      currentBinding.keys.filter((key) =>
        (MODIFIER_KEYS as readonly string[]).includes(key),
      ),
    );
    setBindingError("");
    setRecording(false);
  }, [currentBinding, target, profile.id]);
  useEffect(() => {
    if (!recording) return;
    function record(event: KeyboardEvent) {
      event.preventDefault();
      event.stopPropagation();
      if (event.key === "Escape") {
        setRecording(false);
        return;
      }
      const keys = shortcutFromKeyboardEvent(event);
      if (!keys) return;
      setCustomKey(
        keys.find(
          (key) => !(MODIFIER_KEYS as readonly string[]).includes(key),
        ) ?? "Z",
      );
      setCustomModifiers(
        keys.filter((key) =>
          (MODIFIER_KEYS as readonly string[]).includes(key),
        ),
      );
      setRecording(false);
    }
    window.addEventListener("keydown", record, true);
    return () => window.removeEventListener("keydown", record, true);
  }, [recording]);

  function selectTarget(next: Target) {
    if (next !== target && hasPendingChanges)
      notify("Unassigned edit discarded. Use Assign action to keep a change.");
    setTarget(next);
    if (window.matchMedia("(max-width: 760px)").matches)
      setTimeout(
        () =>
          inspectorRef.current?.scrollIntoView({
            behavior: "smooth",
            block: "start",
          }),
        80,
      );
  }
  function selectProfile(id: string) {
    if (id !== profile.id && hasPendingChanges)
      notify("Unassigned edit discarded. Use Assign action to keep a change.");
    persist({ ...workspace, activeId: id });
    setTarget(1);
    setProfileError("");
  }
  function applyBinding() {
    try {
      const binding =
        tab === "custom"
          ? bindingFromKeys(
              [...customModifiers, ...(customKey ? [customKey] : [])],
              customLabel.trim() || undefined,
            )
          : pending;
      const next =
        typeof target === "number"
          ? {
              ...profile,
              bindings: profile.bindings.map((item, index) =>
                index === target
                  ? { ...binding, keys: [...binding.keys] }
                  : item,
              ),
            }
          : {
              ...profile,
              encoder: {
                ...profile.encoder,
                [target]: { ...binding, keys: [...binding.keys] },
              },
            };
      persist({
        ...workspace,
        profiles: workspace.profiles.map((item) =>
          item.id === profile.id ? validateProfile(next) : item,
        ),
      });
      notify(
        `${binding.label} assigned to ${targetName(target).toLowerCase()}`,
      );
      setBindingError("");
    } catch (error) {
      setBindingError((error as Error).message);
    }
  }
  function createNewProfile(event: React.FormEvent) {
    event.preventDefault();
    try {
      if (workspace.profiles.length >= 100)
        throw new Error(
          "You can keep up to 100 profiles. Export a backup and remove an unused profile first.",
        );
      const next = createProfile(newProfileName, preset);
      persist({
        ...workspace,
        profiles: [...workspace.profiles, next],
        activeId: next.id,
      });
      setNewProfileOpen(false);
      setNewProfileName("");
      setProfileError("");
      notify(`Created ${next.name}`);
    } catch (error) {
      setProfileError((error as Error).message);
    }
  }
  function renameProfile(event: React.FormEvent) {
    event.preventDefault();
    try {
      const next = validateProfile({
        ...workspace.profiles.find((item) => item.id === renameId),
        name: renameValue,
      });
      persist({
        ...workspace,
        profiles: workspace.profiles.map((item) =>
          item.id === renameId ? next : item,
        ),
      });
      setRenameId(null);
      setProfileError("");
      notify("Profile renamed");
    } catch (error) {
      setProfileError((error as Error).message);
    }
  }
  async function importProfile(file?: File) {
    if (!file) return;
    try {
      if (file.size > 128 * 1024)
        throw new Error("Choose a profile JSON file smaller than 128 KB.");
      if (workspace.profiles.length >= 100)
        throw new Error(
          "You can keep up to 100 profiles. Remove an unused profile first.",
        );
      const parsed = parseProfile(await file.text());
      const next = duplicateProfile(parsed, parsed.name);
      persist({
        ...workspace,
        profiles: [...workspace.profiles, next],
        activeId: next.id,
      });
      setProfileError("");
      notify(`Imported ${next.name}`);
    } catch (error) {
      setProfileError((error as Error).message);
    }
    if (importRef.current) importRef.current.value = "";
  }
  const actions = ACTIONS.filter(
    (action) =>
      (category === "all" || category === action.category) &&
      `${action.label} ${action.description} ${formatShortcut(action.keys)}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  const assignedCount = [
    ...profile.bindings,
    profile.encoder.clockwise,
    profile.encoder.counterclockwise,
  ].filter((binding) => binding.keys.length).length;
  const draftKeys =
    tab === "custom"
      ? [...customModifiers, ...(customKey ? [customKey] : [])]
      : pending.keys;
  const draftLabel =
    tab === "custom"
      ? customLabel.trim() || formatShortcut(draftKeys)
      : pending.label;
  const hasPendingChanges =
    draftLabel !== currentBinding.label ||
    JSON.stringify(draftKeys) !== JSON.stringify(currentBinding.keys);

  return (
    <div className="studio-shell">
      <aside className="sidebar">
        <a
          className="brand"
          href="#"
          aria-label="Flamebamboo Studio home"
          onClick={(event) => {
            event.preventDefault();
            setModal(null);
          }}
        >
          <span className="brand-mark">
            <Flame size={25} strokeWidth={1.7} />
          </span>
          <span>
            flamebamboo<span className="brand-sub">STUDIO</span>
          </span>
        </a>
        <div className="workspace-switch">
          <span className="workspace-avatar">fb.</span>
          <div>
            Personal workspace<span>Make it your own.</span>
          </div>
          <ChevronDown size={14} />
        </div>
        <div className="nav-label">WORKSPACE</div>
        <nav aria-label="Main navigation">
          <button
            className={`nav-item ${modal !== "profiles" ? "nav-active" : ""}`}
            onClick={() => setModal(null)}
          >
            <Keyboard size={19} />
            Key bindings
            <span className="nav-dot" />
          </button>
          <button
            className={`nav-item ${modal === "profiles" ? "nav-active" : ""}`}
            onClick={() => {
              setModal("profiles");
              setProfileError("");
            }}
          >
            <Layers size={19} />
            Profiles
            <span className="nav-count">{workspace.profiles.length}</span>
          </button>
          <button className="nav-item" onClick={() => setModal("export")}>
            <BookOpen size={19} />
            Device guide
            <ArrowUpRight className="nav-arrow" size={15} />
          </button>
        </nav>
        <div className="sidebar-note">
          <span className="note-asterisk">✳</span>
          <p>
            A little pad.
            <br />
            <strong>Endless possibilities.</strong>
          </p>
          <span>Built for your kind of flow.</span>
        </div>
        <div className="sidebar-bottom">
          <button className="nav-item" onClick={() => setModal("about")}>
            <CircleHelp size={18} />
            About the studio
          </button>
          <div className="made-by">
            <span className="avatar">a.</span>
            <div>
              Made by Flamebamboo<span>Independent by design.</span>
            </div>
          </div>
        </div>
      </aside>

      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            <Grid2X2 size={16} />
            <span>Devices</span>
            <ChevronRight size={14} />
            <strong>Flamebamboo Pad</strong>
          </div>
          <div className="local-status">
            <span className="status-dot" />
            Local workspace
            <span className="topbar-divider" />
            <button
              className="icon-button"
              onClick={() => setModal("about")}
              aria-label="Help"
            >
              <CircleHelp size={18} />
            </button>
          </div>
        </header>
        <main>
          <section className="page-heading">
            <div>
              <div className="eyebrow">
                <span />
                YOUR PAD. YOUR FLOW.
              </div>
              <h1>
                Make every key <em>yours.</em>
              </h1>
              <p>Less reaching. More creating. A setup that feels like you.</p>
            </div>
            <button
              className="button primary export-button"
              onClick={() => setModal("export")}
            >
              <Download size={17} />
              Export to device
              <ArrowUpRight size={16} />
            </button>
          </section>
          {(storageWarning || initial.recovery) && (
            <div className="storage-warning" role="alert">
              <CircleHelp size={16} />
              <span>
                {storageWarning ||
                  "Previous browser data was preserved in a recovery copy."}
              </span>
              {initial.recovery && (
                <button
                  className="text-button"
                  onClick={() =>
                    downloadText(
                      "flamebamboo-recovery.txt",
                      initial.recovery!,
                      "text/plain",
                    )
                  }
                >
                  Download recovery data
                </button>
              )}
            </div>
          )}
          <div className="editor">
            <section className="device-workspace" aria-label="Macropad layout">
              <div className="device-toolbar">
                <div className="profile-picker">
                  <span className="profile-icon">
                    <Film size={17} />
                  </span>
                  <div>
                    <label htmlFor="active-profile">ACTIVE PROFILE</label>
                    <div className="select-wrap">
                      <select
                        id="active-profile"
                        aria-label="Active profile"
                        value={profile.id}
                        onChange={(event) => selectProfile(event.target.value)}
                      >
                        {workspace.profiles.map((item) => (
                          <option value={item.id} key={item.id}>
                            {item.name}
                          </option>
                        ))}
                      </select>
                      <ChevronDown size={14} />
                    </div>
                  </div>
                </div>
                <button
                  className="icon-button profile-manage"
                  title="Manage profiles"
                  aria-label="Manage profiles"
                  onClick={() => setModal("profiles")}
                >
                  <Settings2 size={18} />
                </button>
                <span className="saved-label">
                  <CheckCheck size={15} />
                  {hasPendingChanges
                    ? "Unassigned edit"
                    : storageWarning
                      ? "Session only"
                      : "Saved in browser"}
                </span>
              </div>

              <div className="device-stage">
                <div className="stage-caption">
                  <span className="tiny-label">THE ORIGINAL</span>
                  <h2>
                    Flamebamboo Pad<span>01</span>
                  </h2>
                </div>
                <div className="stage-tag">11 KEYS + 1 ENCODER</div>
                <div className="device-render">
                  <div className="usb-cable" />
                  <div className="usb-plug" />
                  <div className="macropad">
                    <span className="screw screw-tl" />
                    <span className="screw screw-tr" />
                    <span className="screw screw-bl" />
                    <span className="screw screw-br" />
                    <div className="board-top">
                      <div className="chip">
                        <span>SEEED</span>
                        <div className="chip-core" />
                        <small>RP2040</small>
                      </div>
                      <div className="oled">
                        <div className="oled-pixels">
                          flamebamboo<span>●</span>
                        </div>
                        <div className="oled-profile">{profile.name}</div>
                        <div className="oled-bottom">
                          <span>MAKE SOMETHING.</span>
                          <span>↗</span>
                        </div>
                      </div>
                    </div>
                    <div className="key-grid">
                      <button
                        data-testid="encoder-press"
                        className={`knob-container ${target === 0 ? "control-selected" : ""}`}
                        aria-label={`Encoder press · ${profile.bindings[0].label}`}
                        aria-pressed={target === 0}
                        onClick={() => selectTarget(0)}
                      >
                        <span className="knob">
                          <span className="knob-face">
                            <span className="knob-indicator" />
                            <Volume2 size={19} strokeWidth={1.4} />
                          </span>
                        </span>
                        <span className="knob-label">
                          {showLabels ? profile.bindings[0].label : "PRESS"}
                        </span>
                        {target === 0 && <span className="selected-led" />}
                      </button>
                      {profile.bindings.slice(1).map((binding, index) => {
                        const slot = index + 1;
                        return (
                          <button
                            key={slot}
                            data-testid={`key-${slot}`}
                            aria-label={`${targetName(slot)} · ${binding.label}`}
                            aria-pressed={target === slot}
                            className={`keycap ${target === slot ? "key-selected" : ""} ${!binding.keys.length ? "key-unassigned" : ""}`}
                            onClick={() => selectTarget(slot)}
                          >
                            <span className="key-index">
                              {String(slot).padStart(2, "0")}
                            </span>
                            <BindingIcon binding={binding} size={22} />
                            <span className="key-label">
                              {showLabels
                                ? binding.label
                                : formatShortcut(binding.keys)}
                            </span>
                            {target === slot && <span className="key-led" />}
                          </button>
                        );
                      })}
                    </div>
                    <div className="board-brand">
                      <Flame size={13} strokeWidth={1.8} />
                      <span>flamebamboo.</span>
                      <span className="board-model">PAD — 001</span>
                    </div>
                  </div>
                </div>
                <div className="stage-hint">
                  <MousePointer2 size={14} />
                  Select a key to make it yours
                </div>
                <button
                  className="label-toggle"
                  aria-pressed={showLabels}
                  onClick={() => setShowLabels(!showLabels)}
                >
                  <span
                    className={`mini-toggle ${showLabels ? "toggle-on" : ""}`}
                  />
                  Key labels
                </button>
              </div>

              <div className="encoder-strip">
                <div className="encoder-strip-title">
                  <RotateCw size={18} />
                  <div>
                    Give it a spin<span>ROTARY ENCODER</span>
                  </div>
                </div>
                <div className="encoder-directions">
                  {(["counterclockwise", "clockwise"] as const).map(
                    (direction) => (
                      <button
                        data-testid={`encoder-${direction}`}
                        className={`encoder-direction ${target === direction ? "direction-active" : ""}`}
                        key={direction}
                        aria-label={`${targetName(direction)} · ${profile.encoder[direction].label}`}
                        aria-pressed={target === direction}
                        onClick={() => selectTarget(direction)}
                      >
                        {direction === "clockwise" ? (
                          <RotateCw size={17} />
                        ) : (
                          <RotateCcw size={17} />
                        )}
                        <div>
                          <span>
                            {direction === "clockwise"
                              ? "CLOCKWISE"
                              : "COUNTERCLOCKWISE"}
                          </span>
                          <strong>{profile.encoder[direction].label}</strong>
                        </div>
                        <ChevronRight size={14} />
                      </button>
                    ),
                  )}
                </div>
              </div>
              <div className="device-footer">
                <span>
                  <span className="status-dot" />
                  {assignedCount} of 14 controls assigned
                </span>
                <button onClick={() => setModal("export")}>
                  How do I apply this?
                  <ArrowUpRight size={12} />
                </button>
              </div>
            </section>

            <aside
              className="inspector"
              ref={inspectorRef}
              aria-label="Binding editor"
            >
              <div className="inspector-header">
                <span className="eyebrow">MAKE IT DO SOMETHING</span>
                <div className="inspector-heading">
                  <h2>{targetName(target)}</h2>
                  <span className="control-badge">
                    {typeof target === "number" && target > 0
                      ? "KEYCAP"
                      : "ENCODER"}
                  </span>
                </div>
                <div className="current-assignment">
                  <div className="assignment-icon">
                    <BindingIcon binding={currentBinding} size={22} />
                  </div>
                  <div>
                    <span>CURRENTLY ASSIGNED</span>
                    <strong>{currentBinding.label}</strong>
                  </div>
                  <kbd>{formatShortcut(currentBinding.keys)}</kbd>
                </div>
              </div>
              <div
                className="inspector-tabs"
                role="tablist"
                aria-label="Binding type"
              >
                <button
                  role="tab"
                  aria-selected={tab === "library"}
                  onClick={() => {
                    setTab("library");
                    setRecording(false);
                    setBindingError("");
                  }}
                >
                  <Grid2X2 size={14} />
                  Action library
                </button>
                <button
                  role="tab"
                  aria-selected={tab === "custom"}
                  onClick={() => {
                    setTab("custom");
                    setBindingError("");
                  }}
                >
                  <Command size={14} />
                  Custom shortcut
                </button>
              </div>
              {tab === "library" ? (
                <div
                  className="action-library"
                  role="tabpanel"
                  aria-label="Action library"
                >
                  <div className="search-field">
                    <Search size={17} />
                    <input
                      aria-label="Search actions"
                      placeholder="Find your next shortcut…"
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                    />
                    {search && (
                      <button
                        aria-label="Clear search"
                        onClick={() => setSearch("")}
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>
                  <div className="category-tabs" aria-label="Action categories">
                    <button
                      className={category === "all" ? "category-active" : ""}
                      onClick={() => setCategory("all")}
                    >
                      All actions
                    </button>
                    {ACTION_CATEGORIES.map((item) => (
                      <button
                        key={item.id}
                        className={
                          category === item.id ? "category-active" : ""
                        }
                        onClick={() => setCategory(item.id)}
                      >
                        {item.id === "media" ? "Media" : item.label}
                      </button>
                    ))}
                  </div>
                  <div className="action-list-heading">
                    <span>
                      {search
                        ? "SEARCH RESULTS"
                        : category === "all"
                          ? "FIND YOUR FLOW"
                          : `${category.toUpperCase()} ACTIONS`}
                    </span>
                    <span>{actions.length}</span>
                  </div>
                  <div className="action-list">
                    {actions.map((action) => (
                      <button
                        className={`action-row ${pending.id === action.id ? "action-selected" : ""}`}
                        data-testid={`action-${action.id}`}
                        key={action.id}
                        aria-label={`${action.label} — ${formatShortcut(action.keys)}`}
                        aria-pressed={pending.id === action.id}
                        onClick={() => setPending(action)}
                      >
                        <span className="action-icon">
                          <BindingIcon binding={action} size={17} />
                        </span>
                        <span className="action-text">
                          <strong>{action.label}</strong>
                          <span>{action.description}</span>
                        </span>
                        {pending.id === action.id ? (
                          <span className="action-check">
                            <Check size={12} strokeWidth={3} />
                          </span>
                        ) : (
                          <span className="action-keys">
                            {formatShortcut(action.keys)}
                          </span>
                        )}
                      </button>
                    ))}
                    {!actions.length && (
                      <div className="empty-actions">
                        <Search size={25} />
                        <strong>No matching actions</strong>
                        <span>
                          Try another search or make a custom shortcut.
                        </span>
                        <button
                          className="text-button"
                          onClick={() => {
                            setSearch("");
                            setCategory("all");
                          }}
                        >
                          Clear filters
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="library-note">
                    <Command size={13} />
                    <span>
                      Editing presets use macOS shortcuts.
                      <br />
                      Use custom shortcuts for Windows or Linux.
                    </span>
                  </div>
                </div>
              ) : (
                <div
                  className="custom-editor"
                  role="tabpanel"
                  aria-label="Custom shortcut"
                >
                  <p>
                    That one shortcut you use all the time.
                    <br />
                    Give it a key of its own.
                  </p>
                  <label className="field-label" htmlFor="shortcut-name">
                    Action name
                  </label>
                  <input
                    className="form-input"
                    id="shortcut-name"
                    aria-label="Action name"
                    maxLength={40}
                    placeholder="e.g. Open command palette"
                    value={customLabel}
                    onChange={(event) => setCustomLabel(event.target.value)}
                  />
                  <div className="field-label">
                    Modifiers <span>optional</span>
                  </div>
                  <div className="modifier-buttons">
                    {LEFT_MODIFIERS.map((modifier) => (
                      <button
                        key={modifier.key}
                        aria-label={modifier.name}
                        aria-pressed={customModifiers.includes(modifier.key)}
                        className={
                          customModifiers.includes(modifier.key)
                            ? "modifier-selected"
                            : ""
                        }
                        onClick={() =>
                          setCustomModifiers(
                            customModifiers.includes(modifier.key)
                              ? customModifiers.filter(
                                  (key) => key !== modifier.key,
                                )
                              : [...customModifiers, modifier.key],
                          )
                        }
                      >
                        {modifier.label}
                      </button>
                    ))}
                  </div>
                  {customModifiers.some((key) => key.startsWith("R")) && (
                    <button
                      className="text-button"
                      onClick={() =>
                        setCustomModifiers(
                          customModifiers.filter((key) => !key.startsWith("R")),
                        )
                      }
                    >
                      Clear right-side modifiers
                    </button>
                  )}
                  <label className="field-label" htmlFor="shortcut-key">
                    Key
                  </label>
                  <select
                    className="form-input"
                    id="shortcut-key"
                    aria-label="Shortcut key"
                    value={customKey}
                    onChange={(event) => setCustomKey(event.target.value)}
                  >
                    <option value="">No key / modifier only</option>
                    {KEY_OPTIONS.map((key) => (
                      <option key={key.value} value={key.value}>
                        {key.label}
                      </option>
                    ))}
                  </select>
                  <div className="shortcut-preview">
                    <Keyboard size={18} />
                    <kbd>
                      {formatShortcut([
                        ...customModifiers,
                        ...(customKey ? [customKey] : []),
                      ])}
                    </kbd>
                  </div>
                  <button
                    className={`button secondary record-button ${recording ? "recording" : ""}`}
                    onClick={() => setRecording(!recording)}
                  >
                    <span className="record-dot" />
                    {recording
                      ? "Listening… press your shortcut"
                      : "Record shortcut"}
                  </button>
                  <p className="record-help">
                    {recording
                      ? "Press Escape to cancel. Some system shortcuts cannot be captured by your browser."
                      : "Or build it above. Command maps to the Windows key on Windows."}
                  </p>
                </div>
              )}
              <div className="assign-footer">
                {bindingError && (
                  <p className="form-error" role="alert">
                    {bindingError}
                  </p>
                )}
                <div className="assign-caption">
                  <span>
                    {tab === "custom"
                      ? customLabel || "Custom shortcut"
                      : pending.label}
                  </span>
                  <span>→ {targetName(target)}</span>
                </div>
                <button
                  className="button primary assign-button"
                  onClick={applyBinding}
                  disabled={recording}
                >
                  <Plus size={17} />
                  Assign action
                  <ArrowRight size={16} />
                </button>
                <p>
                  {hasPendingChanges
                    ? "Not saved yet. Assign this action to keep it."
                    : "Saved here. Export when you’re ready."}
                </p>
              </div>
            </aside>
          </div>
          <footer className="page-footer">
            <span>Thoughtfully made. Uniquely yours.</span>
            <span>
              FLAMEBAMBOO STUDIO <span className="footer-version">v0.1</span>
            </span>
          </footer>
        </main>
      </div>

      {toast && (
        <div className="toast" role="status">
          <span>
            <Check size={15} />
          </span>
          {toast}
          <button
            onClick={() => setToast("")}
            aria-label="Dismiss notification"
          >
            <X size={15} />
          </button>
        </div>
      )}
      {modal === "profiles" && (
        <Dialog
          title="A profile for every flow."
          eyebrow="YOUR WORKSPACE"
          close={() => setModal(null)}
          wide
        >
          <div className="dialog-body">
            <p className="dialog-intro">
              Different projects. Different shortcuts. Keep your favorite setups
              together.
            </p>
            {hasPendingChanges && (
              <div className="pending-notice">
                <p>
                  Your current edit is not assigned. Assign it before switching
                  profiles to keep it.
                </p>
                <button
                  className="button secondary"
                  onClick={() => setModal(null)}
                >
                  Back to binding
                </button>
              </div>
            )}
            <div className="profile-cards">
              {workspace.profiles.map((item) => (
                <div
                  className={`profile-card ${item.id === profile.id ? "profile-card-active" : ""}`}
                  key={item.id}
                >
                  <div className="profile-card-top">
                    <span className="profile-card-icon">
                      <Layers size={23} />
                    </span>
                    {item.id === profile.id && (
                      <span className="active-pill">
                        <span className="status-dot" />
                        ACTIVE
                      </span>
                    )}
                  </div>
                  {renameId === item.id ? (
                    <form className="rename-form" onSubmit={renameProfile}>
                      <input
                        className="form-input"
                        aria-label="New profile name"
                        value={renameValue}
                        onChange={(event) => setRenameValue(event.target.value)}
                        maxLength={40}
                        autoFocus
                      />
                      <button type="submit" className="button secondary">
                        Save name
                      </button>
                      <button
                        type="button"
                        className="text-button"
                        onClick={() => setRenameId(null)}
                      >
                        Cancel
                      </button>
                    </form>
                  ) : (
                    <>
                      <button
                        className="profile-select-name"
                        onClick={() => selectProfile(item.id)}
                      >
                        {item.name}
                        <ArrowUpRight size={16} />
                      </button>
                      <span className="profile-card-detail">
                        {
                          item.bindings.filter((binding) => binding.keys.length)
                            .length
                        }{" "}
                        matrix bindings · 2 encoder directions
                      </span>
                      <div className="profile-card-actions">
                        <button
                          aria-label={`Rename ${item.name}`}
                          onClick={() => {
                            setRenameId(item.id);
                            setRenameValue(item.name);
                          }}
                        >
                          Rename
                        </button>
                        <button
                          aria-label={`Duplicate ${item.name}`}
                          onClick={() => {
                            if (workspace.profiles.length >= 100) {
                              setProfileError(
                                "You can keep up to 100 profiles.",
                              );
                              return;
                            }
                            const next = duplicateProfile(item);
                            persist({
                              ...workspace,
                              profiles: [...workspace.profiles, next],
                              activeId: next.id,
                            });
                            notify("Profile duplicated");
                          }}
                        >
                          <Copy size={13} />
                          Duplicate
                        </button>
                        <button
                          className="profile-delete"
                          aria-label={`Delete ${item.name}`}
                          disabled={workspace.profiles.length === 1}
                          onClick={() => setDeleteId(item.id)}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </>
                  )}
                  {deleteId === item.id && (
                    <div className="delete-confirm">
                      <p>Delete “{item.name}” from this browser?</p>
                      <div>
                        <button
                          className="button danger"
                          onClick={() => {
                            const profiles = workspace.profiles.filter(
                              (candidate) => candidate.id !== item.id,
                            );
                            persist({
                              ...workspace,
                              profiles,
                              activeId:
                                profile.id === item.id
                                  ? profiles[0].id
                                  : profile.id,
                            });
                            setDeleteId(null);
                            notify("Profile deleted");
                          }}
                        >
                          Delete profile
                        </button>
                        <button
                          className="text-button"
                          onClick={() => setDeleteId(null)}
                        >
                          Keep it
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
            {newProfileOpen ? (
              <form className="new-profile-form" onSubmit={createNewProfile}>
                <div>
                  <label className="field-label" htmlFor="profile-name">
                    Profile name
                  </label>
                  <input
                    id="profile-name"
                    className="form-input"
                    aria-label="Profile name"
                    placeholder="e.g. Late-night coding"
                    maxLength={40}
                    required
                    value={newProfileName}
                    onChange={(event) => setNewProfileName(event.target.value)}
                    autoFocus
                  />
                </div>
                <div>
                  <label className="field-label" htmlFor="starting-point">
                    Starting point
                  </label>
                  <select
                    id="starting-point"
                    className="form-input"
                    aria-label="Starting point"
                    value={preset}
                    onChange={(event) =>
                      setPreset(event.target.value as ProfilePreset)
                    }
                  >
                    <option value="editing">Video editing</option>
                    <option value="everyday">Everyday</option>
                    <option value="blank">Blank canvas</option>
                  </select>
                </div>
                <div className="new-profile-buttons">
                  <button className="button primary" type="submit">
                    <Plus size={16} />
                    Create profile
                  </button>
                  <button
                    className="text-button"
                    type="button"
                    onClick={() => setNewProfileOpen(false)}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <button
                className="new-profile-card"
                onClick={() => setNewProfileOpen(true)}
              >
                <Plus size={18} />
                New profile<span>A fresh start for your next thing.</span>
              </button>
            )}
            {profileError && (
              <p className="form-error" role="alert">
                {profileError}
              </p>
            )}
            <div className="profile-transfer">
              <div>
                <FileJson size={19} />
                <span>
                  Take your setup with you.
                  <small>Profiles stay in this browser. Keep a backup.</small>
                </span>
              </div>
              <div>
                <button
                  className="button secondary"
                  onClick={() => importRef.current?.click()}
                >
                  <Upload size={15} />
                  Import profile
                </button>
                <button
                  className="button secondary"
                  onClick={() => {
                    downloadText(
                      `${profile.name.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "profile"}.flamebamboo.json`,
                      serializeProfile(profile),
                      "application/json",
                    );
                    notify("Profile backup downloaded");
                  }}
                >
                  <Download size={15} />
                  Export profile
                </button>
                <input
                  ref={importRef}
                  type="file"
                  accept=".json,application/json"
                  aria-label="Import profile"
                  className="visually-hidden"
                  tabIndex={-1}
                  onChange={(event) =>
                    void importProfile(event.target.files?.[0])
                  }
                />
              </div>
            </div>
          </div>
        </Dialog>
      )}
      {modal === "export" && (
        <Dialog
          title="From your screen to your pad."
          eyebrow="MAKE IT REAL"
          close={() => setModal(null)}
          wide
        >
          <div className="dialog-body">
            <>
              {hasPendingChanges && (
                <div className="pending-notice">
                  <p>
                    The change to {targetName(target).toLowerCase()} is not
                    assigned yet. Assign it before downloading.
                  </p>
                  <button className="button secondary" onClick={applyBinding}>
                    Assign pending change
                  </button>
                  {bindingError && (
                    <p className="form-error" role="alert">
                      {bindingError}
                    </p>
                  )}
                </div>
              )}
            </>
            <div className="export-profile-summary">
              <span className="export-summary-icon">
                <Keyboard size={28} />
              </span>
              <div>
                <h3>{profile.name}</h3>
                <p>{assignedCount} assigned controls · CircuitPython + KMK</p>
              </div>
              <span className="file-badge">code.py</span>
            </div>
            <p className="dialog-intro">
              Your pad uses a file-based setup. Download your bindings, then
              copy the file to your macropad’s CIRCUITPY drive.
            </p>
            <ol className="setup-steps">
              <li>
                <span>01</span>
                <div>
                  <h3>Plug in your Flamebamboo Pad</h3>
                  <p>
                    Use a USB data cable. Your board should already have
                    CircuitPython, KMK, and its display dependencies installed.
                    Look for the <code>CIRCUITPY</code> drive.
                  </p>
                </div>
              </li>
              <li>
                <span>02</span>
                <div>
                  <h3>Back up your current setup</h3>
                  <p>
                    Copy your existing startup file to your computer. Keep your{" "}
                    <code>kmk</code> and <code>lib</code> folders on the board.
                  </p>
                </div>
              </li>
              <li>
                <span>03</span>
                <div>
                  <h3>Copy over your new code.py</h3>
                  <p>
                    Replace the active startup script with the downloaded{" "}
                    <code>code.py</code>. CircuitPython normally reloads
                    automatically. Test every key and both encoder directions.
                  </p>
                </div>
              </li>
            </ol>
            <div className="export-note">
              <CircleHelp size={18} />
              <p>
                This downloads a file; it does not connect to or flash your
                device. Profiles switch when you copy a new file. The physical
                pad still needs testing.
              </p>
            </div>
            <button
              className="code-toggle"
              aria-expanded={showCode}
              onClick={() => setShowCode(!showCode)}
            >
              <span>
                <FileJson size={15} />
                Preview generated firmware
              </span>
              <ChevronDown
                size={16}
                className={showCode ? "chevron-open" : ""}
              />
            </button>
            {showCode && (
              <pre className="code-preview">
                <code>{generateFirmware(profile)}</code>
              </pre>
            )}
            <div className="export-actions">
              <span>
                {exported ? (
                  <>
                    <CheckCheck size={16} />
                    Downloaded. Ready to copy.
                  </>
                ) : (
                  <>
                    <Check size={16} />
                    Your board pin configuration is preserved.
                  </>
                )}
              </span>
              <button
                className="button primary"
                disabled={hasPendingChanges}
                onClick={() => {
                  downloadText(
                    "code.py",
                    generateFirmware(profile),
                    "text/x-python",
                  );
                  setExported(true);
                  notify(
                    "code.py downloaded — copy it to your CIRCUITPY drive",
                  );
                }}
              >
                <ArrowDownToLine size={17} />
                Download code.py
              </button>
            </div>
          </div>
        </Dialog>
      )}
      {modal === "about" && (
        <Dialog
          title="A little pad. All you."
          eyebrow="FLAMEBAMBOO STUDIO"
          close={() => setModal(null)}
        >
          <div className="dialog-body about-body">
            <span className="about-flame">
              <Flame size={36} />
            </span>
            <p>
              A personal control room for the Flamebamboo Pad. Build shortcuts
              around the way you create, work, and play.
            </p>
            <div className="about-facts">
              <div>
                <span>Hardware</span>
                <strong>XIAO RP2040 · 11 keys + encoder</strong>
              </div>
              <div>
                <span>Firmware</span>
                <strong>CircuitPython + KMK</strong>
              </div>
              <div>
                <span>Your data</span>
                <strong>Stored in this browser. No account.</strong>
              </div>
              <div>
                <span>Applying changes</span>
                <strong>Download and copy code.py</strong>
              </div>
            </div>
            <p className="about-small">
              Bindings and profiles work offline after the app is loaded. Export
              profile backups before clearing browser data. Keyboard shortcuts
              depend on your operating system and the active application.
            </p>
            <a
              className="portfolio-link"
              href="https://www.athmarasyraf.xyz/"
              target="_blank"
              rel="noreferrer"
            >
              Meet the maker
              <ArrowUpRight size={16} />
            </a>
          </div>
        </Dialog>
      )}
    </div>
  );
}
