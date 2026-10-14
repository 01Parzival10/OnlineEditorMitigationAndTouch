import { inject, injectable } from "inversify";
import { VNode } from "snabbdom";
import {
    ILogger,
    isViewport,
    MouseEventKind,
    MouseListener,
    MouseTool,
    MoveMouseListener,
    on,
    SModelElementImpl,
    SModelRootImpl,
    TYPES,
    ViewerOptions,
} from "sprotty";
import { Point, SetViewportAction, Viewport } from "sprotty-protocol";
import { PlacementToolRegistry } from "./placementTool";
import { SETTINGS } from "../settings/Settings";
import { EditorModeController } from "../settings/editorMode";

import { DfdOutputPortImpl } from "../diagram/ports/DfdOutputPort";
import { OutputPortEditUIMouseListener } from "../assignment/clickListener";

type Contact = { x: number; y: number; target: Element };
type Pinch = { distance: number; center: Point; viewport: Viewport };

/**
 * Adapt touch gestures to the registered Sprotty listeners. Commands, snapping,
 * port editing and dynamic palette tools remain owned by the existing modules.
 */
@injectable()
export class TouchMouseTool extends MouseTool {
    @inject(TYPES.ILogger) private logger!: ILogger;
    @inject(PlacementToolRegistry) private placements!: PlacementToolRegistry;
    @inject(TYPES.ViewerOptions) private options!: ViewerOptions;
    @inject(SETTINGS.Mode) private mode!: EditorModeController;

    private contacts = new Map<number, Contact>();
    private start?: Contact;
    private dragging = false;
    private multiple = false;
    private pinch?: Pinch;
    private lastTap?: { time: number; point: Point; elementId: string };
    private suppressMouseUntil = 0;
    private queue = Promise.resolve();
    private readonly canvases = new WeakSet<Element>();
    private readonly dragThreshold = 8;

    override decorate(vnode: VNode, element: SModelElementImpl): VNode {
        vnode = super.decorate(vnode, element);
        if (element instanceof SModelRootImpl) {
            for (const kind of [
                "pointerdown",
                "pointermove",
                "pointerup",
                "pointercancel",
                "lostpointercapture",
            ] as const) {
                on(vnode, kind, (event: Event) => this.enqueue(kind, element, event as PointerEvent));
            }
        }
        return vnode;
    }

    private enqueue(kind: string, model: SModelRootImpl, event: PointerEvent): void {
        if (event.pointerType !== "touch") return;
        const canvas = event.currentTarget as Element;
        if (!(canvas instanceof SVGElement) || (event.target as Element).closest("foreignObject")) return;
        event.preventDefault();
        this.suppressMouseUntil = Date.now() + 800;
        if (!this.canvases.has(canvas)) {
            // Suppress compatibility clicks before a child SVG button sees them.
            // Intentional taps dispatch one synthetic click below.
            canvas.addEventListener(
                "click",
                (click) => {
                    if (click.isTrusted && Date.now() < this.suppressMouseUntil) {
                        click.preventDefault();
                        click.stopImmediatePropagation();
                    }
                },
                true,
            );
            this.canvases.add(canvas);
        }
        if (kind === "pointerdown") canvas.setPointerCapture(event.pointerId);
        // Capture the hit before pointer capture retargets subsequent events to the SVG.
        const hit = document.elementFromPoint(event.clientX, event.clientY);
        const contact: Contact = {
            x: event.clientX,
            y: event.clientY,
            target: hit && canvas.contains(hit) ? hit : canvas,
        };
        this.queue = this.queue
            .then(() => this.handlePointer(kind, model, canvas, event.pointerId, contact))
            .catch((error: unknown) => {
                this.contacts.clear();
                this.start = undefined;
                this.dragging = false;
                this.multiple = false;
                this.pinch = undefined;
                this.logger.error(this, "Touch gesture failed", error);
            });
    }

    protected override handleEvent(method: MouseEventKind, model: SModelRootImpl, event: MouseEvent): void {
        if (Date.now() < this.suppressMouseUntil && method !== "wheel") return;
        super.handleEvent(method, model, event);
    }

    private async handlePointer(
        kind: string,
        model: SModelRootImpl,
        canvas: Element,
        id: number,
        point: Contact,
    ): Promise<void> {
        if (kind === "pointerdown") {
            this.contacts.set(id, point);
            if (this.contacts.size === 1) {
                this.start = point;
                this.dragging = false;
                this.multiple = false;
            } else {
                // Finish any movement at the last one-finger position before zooming.
                if (this.dragging) {
                    const first = this.contacts.values().next().value as Contact;
                    await this.send("mouseUp", model, canvas, first, 0);
                    this.dragging = false;
                }
                this.multiple = true;
                this.lastTap = undefined;
                this.beginPinch(model);
            }
            return;
        }
        if (!this.contacts.has(id)) return;
        if (kind === "pointermove") {
            this.contacts.set(id, point);
            if (this.multiple) {
                await this.updatePinch(model, canvas);
            } else if (this.start) {
                if (Math.hypot(point.x - this.start.x, point.y - this.start.y) > this.dragThreshold) {
                    if (!this.dragging) {
                        this.lastTap = undefined;
                        // A placement requires a tap. A swipe must never place a new element.
                        if (!this.placements.active) {
                            await this.send("mouseDown", model, canvas, this.start, 1);
                        }
                        this.dragging = true;
                    }
                }
                if (this.dragging && !this.placements.active) {
                    await this.send("mouseMove", model, canvas, point, 1);
                }
            }
            return;
        }

        if (!this.multiple) {
            if (this.dragging && !this.placements.active) {
                // Cancellation still closes the existing move command and releases listener state.
                const last = kind === "pointerup" ? point : this.contacts.get(id)!;
                await this.send("mouseUp", model, canvas, last, 0);
            } else if (!this.dragging && kind === "pointerup" && this.start) {
                await this.tap(model, canvas, point);
            }
        }
        this.contacts.delete(id);
        if (this.contacts.size === 0) {
            this.start = undefined;
            this.dragging = false;
            this.multiple = false;
            this.pinch = undefined;
        } else if (this.multiple) {
            this.beginPinch(model);
        }
    }

    private async tap(model: SModelRootImpl, canvas: Element, point: Contact): Promise<void> {
        const placement = this.placements.active;
        if (placement) {
            this.lastTap = undefined;
            if (this.mode.isReadOnly()) {
                this.placements.cancel();
                return;
            }
            // Creation normally receives a hover before mouseDown. Supply that position
            // explicitly on touch, without involving selection or movement listeners.
            await this.send("mouseMove", model, canvas, point, 0, [placement]);
            await this.send("mouseDown", model, canvas, point, 1, [placement]);
            return;
        }
        // SVG buttons own the tap. Do not turn it into a selection/double-tap edit.
        if (point.target.closest(".element-delete, .label-delete")) {
            this.lastTap = undefined;
            point.target.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
            return;
        }
        const target = this.getTargetElement(model, this.mouseEvent("mouseDown", canvas, point, 1));
        await this.send("mouseDown", model, canvas, point, 1);
        await this.send("mouseUp", model, canvas, point, 0);
        point.target.dispatchEvent(
            new MouseEvent("click", { bubbles: true, cancelable: true, clientX: point.x, clientY: point.y }),
        );
        if (!target) return;
        if (target instanceof DfdOutputPortImpl) {
            this.lastTap = undefined;
            await this.send(
                "doubleClick",
                model,
                canvas,
                point,
                0,
                this.mouseListeners.filter((listener) => listener instanceof OutputPortEditUIMouseListener),
            );
            return;
        }
        const now = Date.now();
        if (
            this.lastTap &&
            now - this.lastTap.time < 400 &&
            this.lastTap.elementId === target.id &&
            Math.hypot(point.x - this.lastTap.point.x, point.y - this.lastTap.point.y) < 24
        ) {
            await this.send("doubleClick", model, canvas, point, 0);
            this.lastTap = undefined;
        } else {
            this.lastTap = { time: now, point, elementId: target.id };
        }
    }

    private async send(
        method: MouseEventKind,
        model: SModelRootImpl,
        canvas: Element,
        point: Contact,
        buttons: number,
        listeners: MouseListener[] = this.mouseListeners,
    ): Promise<void> {
        const event = this.mouseEvent(method, canvas, point, buttons);
        const target = this.getTargetElement(model, event);
        if (!target) return;
        this.focusOnMouseEvent(method, model);
        const actions = listeners
            .slice()
            .filter((listener) => !(this.mode.isReadOnly() && listener instanceof MoveMouseListener))
            .flatMap((listener) => listener[method](target, event as WheelEvent));
        await this.actionDispatcher.dispatchAll(await Promise.all(actions));
    }

    private mouseEvent(method: string, canvas: Element, point: Contact, buttons: number): MouseEvent {
        const event = new MouseEvent(method, {
            clientX: point.x,
            clientY: point.y,
            button: 0,
            buttons,
            cancelable: true,
        });
        const rect = canvas.getBoundingClientRect();
        Object.defineProperties(event, {
            target: { value: point.target },
            // Synthetic events aren't dispatched through the DOM; supply canvas-relative offsets.
            offsetX: { value: point.x - rect.left },
            offsetY: { value: point.y - rect.top },
        });
        return event;
    }

    private geometry(): { center: Point; distance: number } | undefined {
        const [a, b] = Array.from(this.contacts.values());
        if (!a || !b) return;
        return { center: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, distance: Math.hypot(a.x - b.x, a.y - b.y) };
    }

    private beginPinch(model: SModelRootImpl): void {
        const geometry = this.geometry();
        this.pinch =
            geometry && isViewport(model)
                ? {
                      ...geometry,
                      viewport: { zoom: model.zoom, scroll: { ...model.scroll } },
                  }
                : undefined;
    }

    private async updatePinch(model: SModelRootImpl, canvas: Element): Promise<void> {
        const current = this.geometry();
        const start = this.pinch;
        if (!current || !start || start.distance === 0 || !isViewport(model)) return;
        const rect = canvas.getBoundingClientRect();
        const zoom = Math.min(
            this.options.zoomLimits.max,
            Math.max(this.options.zoomLimits.min, (start.viewport.zoom * current.distance) / start.distance),
        );
        // Keep the graph point under the initial midpoint under the moving midpoint.
        await this.actionDispatcher.dispatch(
            SetViewportAction.create(
                model.id,
                {
                    zoom,
                    scroll: {
                        x:
                            start.viewport.scroll.x +
                            (start.center.x - rect.left) / start.viewport.zoom -
                            (current.center.x - rect.left) / zoom,
                        y:
                            start.viewport.scroll.y +
                            (start.center.y - rect.top) / start.viewport.zoom -
                            (current.center.y - rect.top) / zoom,
                    },
                },
                { animate: false },
            ),
        );
    }
}
