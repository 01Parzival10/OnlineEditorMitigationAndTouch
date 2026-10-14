# Touch support

Implemented against `origin/fix` (base commit `433284`).

- Tap an element to select it; drag existing nodes, ports, and routing handles to move them.
- Drag empty canvas to pan; use two fingers to pan and pinch to zoom.
- Double-tap diagram labels or output ports to open the existing editor.
- Tap a creation tool and then the desired location. For edges, tap source then target.
- Tap a label value and then a target node. Tap the selected value again to cancel, or select a different tool.
- A swipe while a placement tool is active does not create anything. Two-finger navigation remains available.
- Escape or tapping the active creation tool cancels placement.

The `touch` module replaces Sprotty's `MouseTool` through the existing Inversify container. It adapts touch Pointer Events to the registered listeners, while retaining the existing model commands, snapping and read-only checks. The label picker now uses tap/click-to-assign instead of HTML drag-and-drop. Only the diagram disables browser touch scrolling; floating panels and inputs retain native behavior.

The existing port snap listener now replaces the default move listener instead of running alongside it. UI-extension visibility changes are excluded from undo history so they do not split a drag into multiple undo steps.

## Validation

From `frontend/webEditor`:

```sh
npm ci
npm run build
npx playwright install chromium
npm run test:touch
```

The browser tests use Chromium touch emulation and cover placement, assignment, pan/zoom, movement and undo, cancellation, read-only behavior, label editing, and mouse regression. Physical iOS/Android devices have not been tested.
