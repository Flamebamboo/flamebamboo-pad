import { expect, test, type Download, type Page } from "@playwright/test";

async function downloadText(download: Download) {
  expect(await download.failure()).toBeNull();
  const stream = await download.createReadStream();
  if (!stream)
    throw new Error("The browser did not provide a download stream.");
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).toString("utf8");
}

async function expectInspectorFits(page: Page) {
  const inspector = await page.locator(".inspector").evaluate((element) => ({
    width: element.clientWidth,
    scrollWidth: element.scrollWidth,
    right: element.getBoundingClientRect().right,
    childRightEdges: Array.from(
      element.children,
      (child) => child.getBoundingClientRect().right,
    ),
  }));
  expect(inspector.scrollWidth).toBeLessThanOrEqual(inspector.width + 1);
  for (const right of inspector.childRightEdges) {
    expect(right).toBeLessThanOrEqual(inspector.right + 1);
  }
}

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("key-1")).toBeVisible();
});

test("renders all physical controls and has no browser runtime errors", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.reload();
  await expect(page).toHaveTitle(/Flamebamboo/i);
  for (let key = 1; key <= 11; key++) {
    await expect(page.getByTestId(`key-${key}`)).toBeVisible();
  }
  await expect(page.getByTestId("encoder-press")).toBeVisible();
  await expect(page.getByTestId("encoder-clockwise")).toBeVisible();
  await expect(page.getByTestId("encoder-counterclockwise")).toBeVisible();
  const actionList = await page.locator(".action-list").evaluate((element) => ({
    contentHeight: element.scrollHeight,
    viewportHeight: element.clientHeight,
  }));
  expect(actionList.contentHeight).toBeGreaterThan(actionList.viewportHeight);
  expect(actionList.viewportHeight).toBeGreaterThan(100);
  expect((await page.locator(".editor").boundingBox())!.height).toBeLessThan(
    1000,
  );
  await expectInspectorFits(page);
  expect(errors).toEqual([]);
});

test("assigns an action to a physical key and persists it after reload", async ({
  page,
}) => {
  await page.getByTestId("key-1").click();
  await page.getByRole("textbox", { name: "Search actions" }).fill("Copy");
  await page.getByRole("button", { name: /^Copy\b/ }).click();
  await page
    .getByRole("button", { name: "Assign action", exact: true })
    .click();
  await expect(page.getByTestId("key-1")).toContainText("Copy");
  await page.reload();
  await expect(page.getByTestId("key-1")).toContainText("Copy");
});

test("exports complete CircuitPython code from the active bindings", async ({
  page,
}) => {
  await page
    .getByRole("button", { name: "Export to device", exact: true })
    .click();
  const pending = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Download code.py", exact: true })
    .click();
  const download = await pending;
  expect(download.suggestedFilename()).toBe("code.py");
  const code = await downloadText(download);
  expect(code).toContain("from kmk.kmk_keyboard import KMKKeyboard");
  expect(code).toContain("board.D9");
  expect(code).toContain("board.D10");
  expect(code).toContain("DiodeOrientation.COL2ROW");
  expect(code).toContain("encoder_handler.map");
  expect(code).toContain("keyboard.keymap");
  expect(code).toContain("keyboard.go()");
  expect(code).not.toContain("undefined");
});

test("creates a separate profile and retains it after reload", async ({
  page,
}) => {
  await page.getByRole("button", { name: /^Profiles/ }).click();
  await page.getByRole("button", { name: /^New profile/ }).click();
  await page
    .getByRole("textbox", { name: "Profile name", exact: true })
    .fill("Streaming desk");
  await page.getByLabel("Starting point").selectOption("blank");
  await page
    .getByRole("button", { name: "Create profile", exact: true })
    .click();
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await expect(
    page.getByLabel("Active profile").locator("option:checked"),
  ).toHaveText("Streaming desk");
  await page.reload();
  await expect(
    page.getByLabel("Active profile").locator("option:checked"),
  ).toHaveText("Streaming desk");
});

test("rejects a malformed profile import without replacing saved work", async ({
  page,
}) => {
  const before = await page.evaluate(() => JSON.stringify(localStorage));
  await page.getByRole("button", { name: /^Profiles/ }).click();
  await page.getByLabel("Import profile", { exact: true }).setInputFiles({
    name: "broken-profile.json",
    mimeType: "application/json",
    buffer: Buffer.from(
      '{"version":1,"profile":{"name":"Broken","bindings":[]}}',
    ),
  });
  await expect(page.getByRole("alert")).toBeVisible();
  expect(await page.evaluate(() => JSON.stringify(localStorage))).toBe(before);
});

test("preserves corrupted browser data and makes the original raw content recoverable", async ({
  page,
}) => {
  const storageKey = "flamebamboo-studio-v1";
  const raw =
    '{"version":1,"profiles":[{"name":"Work in progress"}],"unfinished":';
  await page.evaluate(({ key, value }) => localStorage.setItem(key, value), {
    key: storageKey,
    value: raw,
  });
  await page.reload();
  await expect(page.getByRole("alert")).toContainText(
    "Your original data is preserved",
  );
  expect(
    await page.evaluate((key) => localStorage.getItem(key), storageKey),
  ).toBe(raw);
  const recoveryDownload = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Download recovery data", exact: true })
    .click();
  const downloaded = await recoveryDownload;
  expect(downloaded.suggestedFilename()).toBe("flamebamboo-recovery.txt");
  expect(await downloadText(downloaded)).toBe(raw);

  await page.getByTestId("key-1").click();
  await page.getByRole("textbox", { name: "Search actions" }).fill("Copy");
  await page.getByRole("button", { name: /^Copy\b/ }).click();
  await page
    .getByRole("button", { name: "Assign action", exact: true })
    .click();
  await expect(page.getByTestId("key-1")).toContainText("Copy");
  const stored = await page.evaluate(
    (key) => ({
      active: localStorage.getItem(key),
      recovery: Object.keys(localStorage)
        .filter((item) => item.startsWith(`${key}-recovery-`))
        .map((item) => localStorage.getItem(item)),
    }),
    storageKey,
  );
  expect(stored.recovery).toEqual([raw]);
  expect(JSON.parse(stored.active!).profiles[0].bindings[1].label).toBe("Copy");
});

for (const bindingId of ["__proto__", "constructor"]) {
  test(`safely renders an imported binding with the ID ${bindingId}`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    const binding = { id: bindingId, label: "Imported A", keys: ["A"] };
    const profile = {
      id: "prototype-name-import",
      name: "Safe imported bindings",
      bindings: Array.from({ length: 12 }, () => ({ ...binding })),
      encoder: { clockwise: { ...binding }, counterclockwise: { ...binding } },
    };
    await page.getByRole("button", { name: /^Profiles/ }).click();
    await page.getByLabel("Import profile", { exact: true }).setInputFiles({
      name: "safe-bindings.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify({ version: 1, profile })),
    });
    await expect(
      page.getByRole("button", { name: profile.name, exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Close", exact: true }).click();
    await expect(page.getByTestId("key-1")).toContainText("Imported A");
    await page.reload();
    await expect(page.getByTestId("key-1")).toContainText("Imported A");
    await expect(page.getByTestId("encoder-clockwise")).toContainText(
      "Imported A",
    );
    expect(errors).toEqual([]);
  });
}

test("keeps a blank binding unassigned when opening and applying the custom editor", async ({
  page,
}) => {
  await page.getByRole("button", { name: /^Profiles/ }).click();
  await page.getByRole("button", { name: /^New profile/ }).click();
  await page
    .getByRole("textbox", { name: "Profile name", exact: true })
    .fill("Blank workspace");
  await page.getByLabel("Starting point").selectOption("blank");
  await page
    .getByRole("button", { name: "Create profile", exact: true })
    .click();
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await page.getByTestId("key-1").click();
  await page.getByRole("tab", { name: "Custom shortcut", exact: true }).click();
  await expect(page.getByLabel("Shortcut key", { exact: true })).toHaveValue(
    "",
  );
  await page
    .getByRole("button", { name: "Assign action", exact: true })
    .click();
  await expect(page.getByTestId("key-1")).toContainText("Unassigned");
  await page
    .getByRole("button", { name: "Export to device", exact: true })
    .click();
  const pending = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Download code.py", exact: true })
    .click();
  const code = await downloadText(await pending);
  const matrix = code.split("keyboard.keymap = [")[1].split("if __name__")[0];
  expect(matrix.match(/KC\.NO/g)).toHaveLength(12);
  expect(matrix).not.toContain("KC.Z");
});

test("requires an unassigned library edit to be applied before exporting it", async ({
  page,
}) => {
  await page.getByTestId("key-1").click();
  await page.getByRole("textbox", { name: "Search actions" }).fill("Copy");
  await page.getByRole("button", { name: /^Copy\b/ }).click();
  await expect(page.getByTestId("key-1")).toContainText("Undo");
  await page
    .getByRole("button", { name: "Export to device", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toContainText("not assigned yet");
  await expect(
    page.getByRole("button", { name: "Download code.py", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "Assign pending change", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Download code.py", exact: true }),
  ).toBeEnabled();
  const pending = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Download code.py", exact: true })
    .click();
  expect(await downloadText(await pending)).toContain("Tap(KC.C)");
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await expect(page.getByTestId("key-1")).toContainText("Copy");
});

test("builds a custom chord and includes the actual key assignment in code.py", async ({
  page,
}) => {
  await page.getByTestId("key-4").click();
  await page.getByRole("tab", { name: "Custom shortcut", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Action name", exact: true })
    .fill("Quick save");
  await page.getByRole("button", { name: "Control", exact: true }).click();
  await page.getByRole("button", { name: "Shift", exact: true }).click();
  await page.getByLabel("Shortcut key", { exact: true }).selectOption("S");
  await page
    .getByRole("button", { name: "Assign action", exact: true })
    .click();
  await expect(page.getByTestId("key-4")).toContainText("Quick save");
  await page
    .getByRole("button", { name: "Export to device", exact: true })
    .click();
  const pending = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Download code.py", exact: true })
    .click();
  const code = await downloadText(await pending);
  expect(code).toContain(
    "Press(KC.LCTL), Press(KC.LSFT), Tap(KC.S), Release(KC.LSFT), Release(KC.LCTL)",
  );
  await page.reload();
  await expect(page.getByTestId("key-4")).toContainText("Quick save");
});

test("assigns encoder rotation independently from its push switch", async ({
  page,
}) => {
  await page.getByTestId("encoder-clockwise").click();
  await page
    .getByRole("textbox", { name: "Search actions" })
    .fill("Next track");
  await page.getByRole("button", { name: /^Next track\b/ }).click();
  await page
    .getByRole("button", { name: "Assign action", exact: true })
    .click();
  await expect(page.getByTestId("encoder-clockwise")).toContainText(
    "Next track",
  );
  await expect(page.getByTestId("encoder-counterclockwise")).toContainText(
    "Volume down",
  );
  await expect(page.getByTestId("encoder-press")).toHaveAccessibleName(
    "Encoder press · Mute",
  );
  await page.reload();
  await expect(page.getByTestId("encoder-clockwise")).toContainText(
    "Next track",
  );
});

test("imports a valid profile and exports the same binding data", async ({
  page,
}) => {
  const binding = { id: "letter-a", label: "Type A", keys: ["A"] };
  const profile = {
    id: "imported-profile",
    name: "Imported shortcuts",
    bindings: Array.from({ length: 12 }, () => ({ ...binding })),
    encoder: {
      clockwise: { id: "volume-up", label: "Louder", keys: ["VOLU"] },
      counterclockwise: { id: "volume-down", label: "Quieter", keys: ["VOLD"] },
    },
  };
  await page.getByRole("button", { name: /^Profiles/ }).click();
  await page.getByLabel("Import profile", { exact: true }).setInputFiles({
    name: "imported.flamebamboo.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify({ version: 1, profile })),
  });
  await expect(
    page.getByRole("button", { name: "Imported shortcuts", exact: true }),
  ).toBeVisible();
  const pending = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Export profile", exact: true })
    .click();
  const downloaded = JSON.parse(await downloadText(await pending));
  expect(downloaded.version).toBe(1);
  expect(downloaded.profile.name).toBe(profile.name);
  expect(downloaded.profile.bindings).toEqual(profile.bindings);
  expect(downloaded.profile.encoder).toEqual(profile.encoder);
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await expect(page.getByTestId("key-1")).toContainText("Type A");
  await expect(
    page.getByLabel("Active profile").locator("option:checked"),
  ).toHaveText(profile.name);
});

test("renames, duplicates, and deletes a profile without changing the original", async ({
  page,
}) => {
  await page.getByRole("button", { name: /^Profiles/ }).click();
  await page
    .getByRole("button", { name: "Rename Everyday", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "New profile name", exact: true })
    .fill("Office");
  await page.getByRole("button", { name: "Save name", exact: true }).click();
  await page
    .getByRole("button", { name: "Duplicate Office", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Office copy", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Delete Office copy", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Delete profile", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Office copy", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Office", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await expect(page.getByLabel("Active profile").locator("option")).toHaveCount(
    2,
  );
  await page.reload();
  await expect(page.getByLabel("Active profile").locator("option")).toHaveText([
    "Video editing",
    "Office",
  ]);
});

test("mobile layout keeps key assignment and export usable without page overflow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const device = (await page.locator(".macropad").boundingBox())!;
  const hint = (await page.locator(".stage-hint").boundingBox())!;
  const toggle = (await page
    .getByRole("button", { name: "Key labels", exact: true })
    .boundingBox())!;
  expect(device.y + device.height).toBeLessThanOrEqual(hint.y);
  expect(device.y + device.height).toBeLessThanOrEqual(toggle.y);
  await expectInspectorFits(page);
  await page.getByTestId("key-2").click();
  await page.getByRole("textbox", { name: "Search actions" }).fill("Copy");
  await page.getByRole("button", { name: /^Copy\b/ }).click();
  await page
    .getByRole("button", { name: "Assign action", exact: true })
    .click();
  await expect(page.getByTestId("key-2")).toContainText("Copy");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth + 1,
    ),
  ).toBe(true);
  await page
    .getByRole("button", { name: "Export to device", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Download code.py", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth + 1,
    ),
  ).toBe(true);
});
