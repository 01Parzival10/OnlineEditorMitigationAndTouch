import { expect, Page, test } from "@playwright/test";

async function expectStacked(page: Page) {
    const dock = page.locator(".responsive-menu-dock");
    await expect(dock).toBeVisible();
    await expect(dock.locator(":scope > .ui-float")).toHaveCount(6);
    await expect
        .poll(() =>
            dock.locator(":scope > .ui-float").evaluateAll((menus) => {
                const bounds = menus
                    .filter((menu) => menu.getClientRects().length > 0)
                    .map((menu) => menu.getBoundingClientRect());
                return bounds.every(
                    (box, index) =>
                        box.left >= 0 &&
                        box.right <= window.innerWidth &&
                        (index === 0 || box.top >= bounds[index - 1].bottom + 8),
                );
            }),
        )
        .toBe(true);
}

test("phone menus stack on the right, remain separate when expanded, and preserve state on resize", async ({
    page,
}) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto("/");
    await expectStacked(page);
    await expect(page.locator(".help-ui")).toBeHidden();
    await page.locator(".constraint-menu .accordion-button").tap();
    await expect(page.locator("#constraint-menu-checkbox")).toBeChecked();
    await expectStacked(page);
    await page.locator("#run-button").scrollIntoViewIfNeeded();
    await expect(page.locator("#run-button")).toBeInViewport();
    await expect(page.locator("#repair-button")).toBeInViewport();
    await page.setViewportSize({ width: 2000, height: 1000 });
    await expect(page.locator(".responsive-menu-dock")).toBeHidden();
    await expect(page.locator(".help-ui")).toBeVisible();
    await expect(page.locator("#constraint-menu-checkbox")).toBeChecked();
    const help = await page.locator(".help-ui").boundingBox();
    const constraints = await page.locator(".constraint-menu").boundingBox();
    expect(help!.x + help!.width).toBeLessThan(constraints!.x);
    await page.setViewportSize({ width: 375, height: 667 });
    await expectStacked(page);
});

test("opening menus on a medium screen triggers docking when their measured widths collide", async ({ page }) => {
    await page.setViewportSize({ width: 1000, height: 750 });
    await page.goto("/");
    await expect(page.locator(".help-ui")).toBeVisible();
    await expect(page.locator(".responsive-menu-dock")).toBeHidden();
    await page.locator(".help-ui .accordion-button").tap();
    await page.locator(".constraint-menu .accordion-button").tap();
    await expectStacked(page);
});

test("narrow landscape and 320px portrait keep all six menus reachable", async ({ page }) => {
    await page.setViewportSize({ width: 600, height: 320 });
    await page.goto("/");
    await expectStacked(page);
    await page.locator(".constraint-menu .accordion-button").scrollIntoViewIfNeeded();
    await expect(page.locator(".constraint-menu .accordion-button")).toBeInViewport();
    await page.setViewportSize({ width: 320, height: 568 });
    await expectStacked(page);
    await page.locator(".constraint-menu .accordion-button").tap();
    await expectStacked(page);
    await page.locator("#run-button").scrollIntoViewIfNeeded();
    await expect(page.locator("#repair-button")).toBeInViewport();
    await page.locator(".tool-palette").scrollIntoViewIfNeeded();
    await expect(page.locator(".tool-palette")).toBeInViewport();
});

test("empty space below and between stacked panels passes touches to the diagram", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 900 });
    await page.goto("/");
    await expectStacked(page);
    const point = await page.locator(".constraint-menu").evaluate((menu) => {
        const box = menu.getBoundingClientRect();
        return { x: box.right - 20, y: box.bottom + 40 };
    });
    expect(
        await page.evaluate(({ x, y }) => !!document.elementFromPoint(x, y)?.closest("svg.sprotty-graph"), point),
    ).toBe(true);
    const gap = await page.locator(".tool-palette").evaluate((menu) => {
        const box = menu.getBoundingClientRect();
        return { x: box.right - 10, y: box.bottom + 5 };
    });
    expect(
        await page.evaluate(({ x, y }) => !!document.elementFromPoint(x, y)?.closest("svg.sprotty-graph"), gap),
    ).toBe(true);
    const diagram = page.locator("svg.sprotty-graph > g").first();
    const before = await diagram.getAttribute("transform");
    const session = await page.context().newCDPSession(page);
    await session.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [point] });
    await session.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [{ x: point.x - 40, y: point.y + 40 }],
    });
    await session.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await expect(diagram).not.toHaveAttribute("transform", before!);
    await session.detach();
});

for (const viewport of [
    { width: 375, height: 667 },
    { width: 600, height: 320 },
]) {
    test(`stacked command palette opens at bottom with upward folders at ${viewport.width}px`, async ({ page }) => {
        await page.setViewportSize(viewport);
        await page.goto("/");
        await expectStacked(page);
        await page.touchscreen.tap(20, 250);
        await page.keyboard.press("Control+Space");
        const palette = page.locator(".command-palette");
        await expect(palette).toBeVisible();
        const bounds = await palette.boundingBox();
        expect(bounds!.x).toBeGreaterThanOrEqual(0);
        expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(viewport.width);
        expect(Math.abs(bounds!.y + bounds!.height - (viewport.height - 12))).toBeLessThan(2);
        const save = palette
            .locator(".command-palette-suggestions-holder > .command-palette-suggestion")
            .filter({ has: page.locator(":scope > .command-palette-suggestion-label", { hasText: /^Save$/ }) });
        const heading = save.locator(":scope > .command-palette-suggestion-label");
        await heading.tap();
        const children = save.locator(".command-palette-suggestion-children");
        await expect(children).toBeVisible();
        const childBounds = await children.boundingBox();
        const parentBounds = await heading.boundingBox();
        expect(childBounds!.y + childBounds!.height).toBeLessThanOrEqual(parentBounds!.y + 1);
        const child = children.getByText("Save diagram as JSON", { exact: true });
        await child.scrollIntoViewIfNeeded();
        await expect(child).toBeInViewport();
        const download = page.waitForEvent("download");
        await child.tap();
        await download;
        await expect(palette).toBeHidden();
        await page.setViewportSize({ width: 2000, height: 1000 });
        await expect(page.locator("body")).not.toHaveClass(/menus-stacked/);
        await page.touchscreen.tap(20, 250);
        await page.keyboard.press("Control+Space");
        await expect(palette).toHaveCSS("position", "absolute");
    });
}
