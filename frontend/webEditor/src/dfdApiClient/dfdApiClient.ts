import { inject, injectable } from "inversify";
import { FileName } from "../fileName/fileName";
import { BackEndURL } from "./backendUrl";

@injectable()
export class DfdApiClient {
    mitigationSeperator: string = ":MITIGATION_META_INFO:";

    constructor(
        @inject(FileName) private readonly fileName: FileName,
        @inject(BackEndURL) private readonly backEndURL: BackEndURL,
    ) {}

    public async requestDiagram(message: string, action: string) {
        try {
            const result = await this.sendMessage(message, action);

            const name = result.split(":")[0];
            let diagramMessage = result.replace(name + ":", "");

            if (diagramMessage.includes(this.mitigationSeperator)) {
                const mitigationInfo = diagramMessage.split(this.mitigationSeperator)[1];
                diagramMessage = diagramMessage.split(this.mitigationSeperator)[0];
                return {
                    fileName: name,
                    content: JSON.parse(diagramMessage),
                    mitigation: mitigationInfo,
                };
            }

            return {
                fileName: name,
                content: JSON.parse(diagramMessage),
            };
        } catch (error) {
            alert(error);
        }
    }

    public sendMessage(message: string, action: string): Promise<string> {
        const apiUrl = `${this.backEndURL.get()}${action}`;

        return fetch(apiUrl, {
            method: "POST",
            headers: {
                "Content-Type": "text/plain;charset=UTF-8",
            },
            body: this.fileName.getName() + ":" + message,
        }).then((response) => {
            return response.text().then((responseText) => {
                if (!response.ok) {
                    throw new Error(responseText || `Request failed: ${response.status} ${response.statusText}`);
                }

                return responseText;
            });
        });
    }
}
