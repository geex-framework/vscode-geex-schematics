import { Uri } from "vscode";
import { FileSystem } from "../utils";

export class GeexConfig {
  orgName!: string;
  projName!: string;
  async init(geexConfigUri: Uri) {
    const unsafeConfig = await FileSystem.parseJsonFile(geexConfigUri) as { geex: Record<keyof GeexConfig, string> };
    this.orgName = unsafeConfig.geex.orgName
    this.projName = unsafeConfig.geex.projName
    return this;
  }
    
}
