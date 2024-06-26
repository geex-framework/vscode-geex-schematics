import { Uri } from "vscode";
import { FileSystem } from "../utils";
export class GeexConfig {
  orgName!: string;
  async init(geexConfigUri: Uri) {
    const unsafeConfig = await FileSystem.parseJsonFile(geexConfigUri) as { geex: GeexConfig };
    this.orgName = unsafeConfig.geex.orgName
    return this;
  }
}
