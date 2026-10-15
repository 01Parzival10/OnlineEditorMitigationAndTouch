import { injectable } from "inversify";
import { IStartUpAgent } from "./StartUpAgent";
import "./responsiveMenus.css";

const menuSelectors = [
    ".tool-palette",
    ".label-type-editor-ui",
    ".mitigation-options",
    ".settings-ui",
    ".help-ui",
    ".constraint-menu",
];

/** Keep the existing extensions and their state; only change their layout. */
@injectable()
export class ResponsiveMenusStartUpAgent implements IStartUpAgent {
    run(): void {
        const host = document.getElementById("sprotty");
        if (!host) return;
        const dock = document.createElement("div");
        dock.className = "responsive-menu-dock";
        dock.hidden = true;
        document.body.appendChild(dock);

        const originals = new Map<HTMLElement, Comment>();
        const observed = new Set<HTMLElement>();
        let compact = false;
        let returnWidth = 0;
        let lastWidth = document.documentElement.clientWidth;
        let frame: number | undefined;
        const schedule = () => {
            if (frame === undefined) frame = requestAnimationFrame(update);
        };
        const sizes = new ResizeObserver(schedule);
        sizes.observe(document.documentElement);
        window.addEventListener("resize", schedule);
        // UI extensions are created asynchronously after the startup actions run.
        new MutationObserver((records) => {
            if (
                records.some((record) =>
                    Array.from(record.addedNodes).some(
                        (node) =>
                            node instanceof HTMLElement &&
                            (node.matches(".ui-float") || node.querySelector(".ui-float")),
                    ),
                )
            )
                schedule();
        }).observe(document.body, { childList: true, subtree: true });

        const update = () => {
            frame = undefined;
            const menus = menuSelectors
                .map((selector) => document.querySelector<HTMLElement>(selector))
                .filter((menu): menu is HTMLElement => menu !== null);
            menus.forEach((menu) => {
                if (!observed.has(menu)) {
                    sizes.observe(menu);
                    observed.add(menu);
                }
            });
            const help = document.querySelector<HTMLElement>(".help-ui");
            const constraints = document.querySelector<HTMLElement>(".constraint-menu");
            if (!help || !constraints) return;
            const width = document.documentElement.clientWidth;
            if (compact) {
                // Hysteresis avoids switching back and forth as accordion sizes animate.
                if (width > lastWidth && width >= returnWidth) {
                    originals.forEach((placeholder, menu) => {
                        if (placeholder.isConnected) placeholder.replaceWith(menu);
                        else document.getElementById("sprotty")?.prepend(menu);
                    });
                    originals.clear();
                    dock.hidden = true;
                    compact = false;
                    document.body.classList.remove("menus-stacked");
                    schedule();
                } else {
                    menus.forEach(moveToDock);
                }
            } else {
                const left = help.getBoundingClientRect();
                const right = constraints.getBoundingClientRect();
                if (left.right + 12 > right.left) {
                    returnWidth = Math.max(width + 24, left.width + right.width + 60);
                    compact = true;
                    document.body.classList.add("menus-stacked");
                    dock.hidden = false;
                    menus.forEach(moveToDock);
                }
            }
            lastWidth = width;
        };
        const moveToDock = (menu: HTMLElement) => {
            if (menu.parentElement === dock) return;
            const placeholder = document.createComment("floating-menu-position");
            menu.before(placeholder);
            originals.set(menu, placeholder);
            dock.appendChild(menu);
        };
        schedule();
    }
}
