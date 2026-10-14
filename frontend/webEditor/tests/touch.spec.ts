import { expect, test, Page, Locator } from "@playwright/test";

const nodes = (page: Page) => page.locator("svg.sprotty-graph .sprotty-node");
const node = (page: Page, text: string) =>
    nodes(page).filter({ has: page.locator("text.sprotty-label", { hasText: new RegExp(`^${text}$`) }) });
const palette = (page: Page, index: number) => page.locator(".tool-palette .tool").nth(index);

async function center(locator: Locator) {
    const bounds = await locator.boundingBox();
    if (!bounds) throw new Error("Element has no bounds");
    return { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
}

async function gesture(page: Page, points: { x: number; y: number; id?: number }[][], cancel = false) {
    const session = await page.context().newCDPSession(page);
    await session.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: points[0] });
    for (const touchPoints of points.slice(1)) {
        await session.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints });
        // Allow the command stack and animation frame to catch up between physical samples.
        await page.waitForTimeout(30);
    }
    await session.send("Input.dispatchTouchEvent", { type: cancel ? "touchCancel" : "touchEnd", touchPoints: [] });
    await session.detach();
}

async function drag(page: Page, from: { x: number; y: number }, dx: number, dy: number, cancel = false) {
    await gesture(
        page,
        [[from], [{ x: from.x + dx / 2, y: from.y + dy / 2 }], [{ x: from.x + dx, y: from.y + dy }]],
        cancel,
    );
}

async function transform(page: Page) {
    return page.locator("svg.sprotty-graph > g").first().getAttribute("transform");
}

test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await expect(nodes(page)).toHaveCount(7);
    await expect(page.locator("svg.sprotty-graph")).toHaveCSS("touch-action", "none");
});

test("tap creates one node at the tapped location; a swipe does not place it", async ({ page }) => {
    await palette(page, 2).tap();
    await expect(palette(page, 2)).toHaveClass(/active/);
    await drag(page, { x: 450, y: 180 }, 100, 20);
    await expect(palette(page, 2)).toHaveClass(/active/);
    await page.touchscreen.tap(450, 180);
    await expect(palette(page, 2)).not.toHaveClass(/active/);
    await expect(nodes(page)).toHaveCount(8);
    const point = await center(node(page, "Function"));
    expect(Math.abs(point.x - 450)).toBeLessThan(15);
    expect(Math.abs(point.y - 180)).toBeLessThan(15);
    await page.keyboard.press("Control+z");
    await expect(nodes(page)).toHaveCount(7);
});

test("label selection waits for a target and can be cancelled or replaced by a creation tool", async ({ page }) => {
    await page.locator(".label-type-editor-ui .accordion-button").tap();
    const value = page.locator(".label-type-value-name").filter({ visible: true }).first();
    await value.tap();
    await expect(value).toHaveClass(/pending-assignment/);
    const target = node(page, "view");
    await expect(target.locator(".node-label")).toHaveCount(0);
    await target.locator("text.sprotty-label").tap();
    await expect(target.locator(".node-label")).toHaveCount(1);
    await expect(value).not.toHaveClass(/pending-assignment/);
    await page.waitForTimeout(550);
    await value.tap();
    await expect(value).toHaveClass(/pending-assignment/);
    await palette(page, 0).tap();
    await expect(value).not.toHaveClass(/pending-assignment/);
    await expect(palette(page, 0)).toHaveClass(/active/);
    await page.keyboard.press("Escape");
    await expect(palette(page, 0)).not.toHaveClass(/active/);
});

test("drag moves an existing node with undo, and cancellation does not leave dragging active", async ({ page }) => {
    const target = node(page, "view");
    const before = await target.getAttribute("transform");
    const at = await center(target.locator("text.sprotty-label"));
    await drag(page, at, 50, 70);
    await expect(target).not.toHaveAttribute("transform", before!);
    await page.keyboard.press("Control+z");
    await expect(target).toHaveAttribute("transform", before!);
    await drag(page, at, 40, 40, true);
    const cancelled = await target.getAttribute("transform");
    await page.touchscreen.tap(450, 180);
    await expect(target).toHaveAttribute("transform", cancelled!);
});

test("empty-canvas pan and two-finger pinch change the viewport without moving nodes", async ({ page }) => {
    const beforeNodes = await nodes(page).evaluateAll((elements) => elements.map((e) => e.getAttribute("transform")));
    const before = await transform(page);
    await drag(page, { x: 400, y: 150 }, 80, 50);
    await expect.poll(() => transform(page)).not.toBe(before);
    const panned = await transform(page);
    await gesture(page, [
        [
            { x: 400, y: 150, id: 1 },
            { x: 600, y: 150, id: 2 },
        ],
        [
            { x: 350, y: 170, id: 1 },
            { x: 650, y: 170, id: 2 },
        ],
    ]);
    await expect.poll(() => transform(page)).not.toBe(panned);
    expect(await nodes(page).evaluateAll((elements) => elements.map((e) => e.getAttribute("transform")))).toEqual(
        beforeNodes,
    );
});

test("double-tap opens the existing label editor", async ({ page }) => {
    const at = await center(node(page, "view").locator("text.sprotty-label"));
    await page.touchscreen.tap(at.x, at.y);
    await page.touchscreen.tap(at.x, at.y);
    await expect(page.locator(".label-edit input")).toBeVisible();
});

test("port placement targets the node even when tapping its label", async ({ page }) => {
    const target = node(page, "view");
    const ports = target.locator(".sprotty-port");
    const before = await ports.count();
    await palette(page, 4).tap();
    await target.locator("text.sprotty-label").tap();
    await expect(ports).toHaveCount(before + 1);
    await expect(palette(page, 4)).not.toHaveClass(/active/);
});

test("read-only mode blocks placement and movement but allows navigation", async ({ page }) => {
    await page.locator(".settings-ui .accordion-button").tap();
    await page.locator("label:has(#setting-read-only)").tap();
    await palette(page, 2).tap();
    await expect(palette(page, 2)).not.toHaveClass(/active/);
    const target = node(page, "view");
    const before = await target.getAttribute("transform");
    await drag(page, await center(target), 50, 50);
    await expect(target).toHaveAttribute("transform", before!);
    const viewport = await transform(page);
    await drag(page, { x: 400, y: 150 }, 80, 50);
    await expect.poll(() => transform(page)).not.toBe(viewport);
});

test("mouse creation and dragging still work", async ({ page }) => {
    await palette(page, 2).click();
    await page.mouse.move(450, 180);
    await page.mouse.click(450, 180);
    await expect(nodes(page)).toHaveCount(8);
    const target = node(page, "Function");
    const before = await target.getAttribute("transform");
    const at = await center(target);
    await page.mouse.move(at.x, at.y);
    await page.mouse.down();
    await page.mouse.move(at.x + 50, at.y + 50, { steps: 5 });
    await page.mouse.up();
    await expect(target).not.toHaveAttribute("transform", before!);
});
