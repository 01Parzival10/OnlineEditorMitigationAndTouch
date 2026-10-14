/** @jsx svg */
import { inject, injectable } from "inversify";
import {
    IActionDispatcher,
    SEdgeImpl,
    SNodeImpl,
    SPortImpl,
    SetUIExtensionVisibilityAction,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    svg,
    TYPES,
} from "sprotty";
import { Point } from "sprotty-protocol";
import { VNode } from "snabbdom";
import { DeleteKeyListener } from "../keyListeners/deleteKeyListener";
import { SETTINGS } from "../settings/Settings";
import { EditorModeController } from "../settings/editorMode";
import { ASSIGNMENT_EDIT_UI_ID } from "../assignment/id";

/** Selection controls use the same deletion and connected-edge cleanup as Delete. */
@injectable()
export class DeleteButtonRenderer {
    constructor(
        @inject(TYPES.IActionDispatcher) private readonly dispatcher: IActionDispatcher,
        @inject(DeleteKeyListener) private readonly deletion: DeleteKeyListener,
        @inject(SETTINGS.Mode) private readonly mode: EditorModeController,
    ) {}

    render(
        element: SNodeImpl | SPortImpl | SEdgeImpl,
        position: Point,
        kind: "node" | "pin" | "flow",
    ): VNode | undefined {
        if (!element.selected || this.mode.isReadOnly() || element.opacity !== 1) return;
        return (
            <g
                class={{ "element-delete": true, [`${kind}-delete`]: true }}
                attrs={{ role: "button", "aria-label": `Delete ${kind}` }}
                on={{
                    click: (event: MouseEvent) => {
                        event.stopPropagation();
                        if (this.mode.isReadOnly()) return;
                        const actions = this.deletion.deleteElements([element]);
                        if (element instanceof SPortImpl) {
                            actions.unshift(
                                SetUIExtensionVisibilityAction.create({
                                    extensionId: ASSIGNMENT_EDIT_UI_ID,
                                    visible: false,
                                }),
                            );
                        }
                        this.dispatcher.dispatchAll(actions);
                    },
                }}
            >
                <circle cx={position.x} cy={position.y} r={6} />
                <text x={position.x} y={position.y}>
                    X
                </text>
            </g>
        );
    }
}
