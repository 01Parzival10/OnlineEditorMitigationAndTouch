import { ContainerModule } from "inversify";
import { MouseTool } from "sprotty";
import { PlacementToolRegistry } from "./placementTool";
import { TouchMouseTool } from "./touchMouseTool";
import "./touch.css";

export const touchModule = new ContainerModule((bind, _unbind, _isBound, rebind) => {
    bind(PlacementToolRegistry).toSelf().inSingletonScope();
    rebind(MouseTool).to(TouchMouseTool).inSingletonScope();
});
