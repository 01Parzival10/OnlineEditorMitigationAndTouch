import { inject, injectable } from "inversify";
import { CommitModelAction, MouseListener, MouseTool, SChildElementImpl, SModelElementImpl, SNodeImpl } from "sprotty";
import { Action } from "sprotty-protocol";
import { LabelAssignment } from "./LabelType";
import { AddLabelAssignmentAction } from "./assignmentCommand";
import { containsDfdLabels } from "./feature";
import { LabelTypeRegistry } from "./LabelTypeRegistry";
import { PlacementToolRegistry } from "../touch/placementTool";
import { SETTINGS } from "../settings/Settings";
import { EditorModeController } from "../settings/editorMode";

/** Tap/click a value, then a node. Uses the same assignment command as before. */
@injectable()
export class LabelPlacementTool extends MouseListener {
    assignment?: LabelAssignment;

    constructor(
        @inject(MouseTool) private readonly mouseTool: MouseTool,
        @inject(PlacementToolRegistry) private readonly placements: PlacementToolRegistry,
        @inject(LabelTypeRegistry) private readonly labels: LabelTypeRegistry,
        @inject(SETTINGS.Mode) private readonly mode: EditorModeController,
    ) {
        super();
        mode.registerListener(() => this.disable());
        labels.onUpdate(() => this.disable());
    }

    enable(assignment: LabelAssignment): void {
        if (this.mode.isReadOnly()) return;
        if (
            this.assignment?.labelTypeId === assignment.labelTypeId &&
            this.assignment.labelTypeValueId === assignment.labelTypeValueId
        ) {
            this.disable();
            return;
        }
        this.placements.cancel();
        this.assignment = assignment;
        this.mouseTool.register(this);
        this.placements.activate(this);
    }

    disable(): void {
        this.assignment = undefined;
        this.mouseTool.deregister(this);
        this.placements.deactivate(this);
    }

    override mouseDown(target: SModelElementImpl): Action[] {
        const assignment = this.assignment;
        if (!assignment || this.mode.isReadOnly()) {
            this.disable();
            return [];
        }
        const type = this.labels.getLabelType(assignment.labelTypeId);
        if (!type?.values.some((value) => value.id === assignment.labelTypeValueId)) {
            this.disable();
            return [];
        }
        while (!(target instanceof SNodeImpl && containsDfdLabels(target))) {
            if (!(target instanceof SChildElementImpl)) return [];
            target = target.parent;
        }
        this.disable();
        return [AddLabelAssignmentAction.create(assignment, target), CommitModelAction.create()];
    }
}
