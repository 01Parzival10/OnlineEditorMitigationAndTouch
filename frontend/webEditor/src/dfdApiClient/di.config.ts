import { ContainerModule } from "inversify";
import { DfdApiClient } from "./dfdApiClient";
import { BackEndURL } from "./backendUrl";

export const dfdApiModule = new ContainerModule((bind) => {
    bind(BackEndURL).toSelf().inSingletonScope();

    bind(DfdApiClient).toSelf().inSingletonScope();
});
