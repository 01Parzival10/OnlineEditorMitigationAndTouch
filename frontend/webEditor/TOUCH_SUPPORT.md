# Touch support

Implemented against `origin/fix` (base commit `433284`).

- Tap an element to select it; drag existing nodes, ports, and routing handles to move them.
- Drag empty canvas to pan; use two fingers to pan and pinch to zoom.
- Double-tap diagram labels to edit. A single tap on an output port opens its assignment editor.
- Selected pins have an X above/right; selected flows have an X above the route midpoint. Deleting a pin also removes its connected flows. Deleting a flow keeps its endpoint pins. Both support undo.
- Selecting a node shows an X at its top-right corner and on its labels. Tapping a label also selects its node and reveals these controls. Node deletion includes connected edges and supports undo; read-only mode hides the delete controls.
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

On screens where Help and Constraints would overlap, the palette, label types, mitigations, settings, help, and constraints move into a scrollable right-hand stack. The Keyboard Shortcuts / Help panel is hidden while stacked. Empty space between and below panels passes input through to the diagram. Accordion state is preserved; widening the screen restores the original positions and Help panel.

Hold empty canvas for 550 ms to open the command palette (the same action as Ctrl+Space). Moving, adding a second finger, or cancelling the contact cancels the hold. A completed hold cancels pending placement and does not place anything on release. Holding nodes does not open the palette.

Floating menus retain their viewport position and size during diagram pan/zoom. Panels allow native scrolling but do not initiate browser pinch zoom.

Command palette folders expand on tap or click without losing search focus; choosing a child executes it and closes the palette.

In stacked-menu mode the command palette is a bottom panel sized to the visible viewport. Folder entries expand above their heading, with scrolling on short screens and 44px touch targets. Normal desktop positioning returns when the menus are no longer stacked.
