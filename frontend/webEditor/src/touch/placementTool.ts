import { injectable } from "inversify";
import { MouseListener } from "sprotty";

export interface PlacementTool extends MouseListener {
    disable(): void;
}

/** Shared by the palette and label picker so only one placement operation is armed. */
@injectable()
export class PlacementToolRegistry {
    active?: PlacementTool;
    private listeners: (() => void)[] = [];

    activate(tool: PlacementTool): void {
        this.cancel();
        this.active = tool;
        this.notify();
    }

    deactivate(tool: PlacementTool): void {
        if (this.active === tool) {
            this.active = undefined;
            this.notify();
        }
    }

    cancel(): void {
        this.active?.disable();
    }

    onChange(listener: () => void): void {
        this.listeners.push(listener);
    }

    private notify(): void {
        this.listeners.forEach((listener) => listener());
    }
}
