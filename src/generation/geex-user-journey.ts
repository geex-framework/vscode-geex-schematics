import * as vscode from 'vscode';
import axios, { AxiosResponse } from 'axios';
import { extensionName } from '../defaults';
import { Output, FileSystem, Terminals, schematicsProInfo } from '../utils';
import { Workspace, WorkspaceFolderConfig } from '../workspace';
import JSZip = require("jszip");
import { CliCommand } from './cli-command';
import path = require('path');

export class GeexUserJourney {
  extensionContext!: vscode.ExtensionContext;
  workspaceFolder!: WorkspaceFolderConfig;
  cliCommand!: CliCommand;
  collection: any;
  schematic: any;
  orgName!: string;
  modName!: string;
  aggregateName: any;
  constructor() {

  }

  async start(extensionContext: vscode.ExtensionContext, contextUri?: vscode.Uri): Promise<void> {

    this.extensionContext = extensionContext;

    /* As the configurations are loaded in an async way, they may not be ready */
    try {

      /* Show progress to the user */
      await vscode.window.withProgress({
        location: vscode.ProgressLocation.Window,
        title: `${extensionName}: loading configuration, please wait...`,
      }, () => Workspace.whenStable());

    } catch {
      Output.showError(`Loading configurations needed for ${extensionName} extension was too long. Check Output channel for error logs.`);
      return;
    }

    let workspaceFolder: WorkspaceFolderConfig | undefined;
    /* Get workspace folder configuration */

    try {
      workspaceFolder = await Workspace.askFolder(contextUri);
    } catch (ex) {
      Output.showError(`not a valid workspaceFolder`);
      return;
    }

    if (!workspaceFolder) {
      Output.logInfo(`You have canceled the workspaceFolder choice.`);
      return;
    }

    this.workspaceFolder = workspaceFolder;

    Output.logInfo(`Workspace folder selected: "${workspaceFolder.name}"`);

    this.cliCommand = new CliCommand(workspaceFolder, contextUri);

    /* If the project has not been already resolved via context path (in `CliCommand` constructor)
     * and if the Angular projects have been correctly resolved from config */

    let template = (await vscode.window.showQuickPick(["module", "solution", "client"], { placeHolder: "what schematics are you going to generate?" }))!;

    if (template == "solution") {
      await vscode.window.showInformationMessage("geex solution will follow convention of '<org>' as project name with a default module named '<org>.<module>' and a default <aggregate> entity.", { modal: true }, "OK");
    }

    if (template == "module") {
      vscode.window.showInformationMessage("geex module will follow convention of '<org>.<module>' as module name with a default <aggregate> entity.", "OK");
    }

    if (template == "client") {
    }

    try {
      let newFileUri: vscode.Uri;
      if (template == "module") {
        await this.inputOrg();
        await this.inputMod();
        await this.inputAggregate();
        await vscode.window.withProgress({
          location: vscode.ProgressLocation.Notification,
          title: `${extensionName}: launching the generation, please wait...`,
        }, async () => {
          newFileUri = (await this.generateModule(contextUri));
          if (newFileUri != undefined) {
            this.updateProjectDependencies(newFileUri);
          }
          newFileUri && this.jumpToFile(newFileUri)
        });
      }
      if (template == "solution") {
        await this.inputOrg();
        await this.inputMod();
        await this.inputAggregate();
        await vscode.window.withProgress({
          location: vscode.ProgressLocation.Notification,
          title: `${extensionName}: launching the generation, please wait...`,
        }, async () => {
          newFileUri = (await this.generateSolution(contextUri));
          newFileUri && this.jumpToFile(newFileUri)
        });
      }
      if (template == "client") {
        await this.inputOrg();
        let clientUiType = (await vscode.window.showQuickPick([{
          label: "landing",
          description: "landing page ui, commonly used as official website"
        }, {
          label: "admin",
          description: "admin ui, commonly used as system management console"
        }, {
          label: "docs",
          description: "docs ui, commonly used as product documentation"
        }, {
          label: "community",
          description: "community ui, commonly used as community forum"
        }, {
          label: "im",
          description: "im ui, commonly used as instant messaging system"
        }, {
          label: "mall",
          description: "mall ui, commonly used as e-commerce platform"
        }, {
          label: "account",
          description: "account ui, commonly used as user center"
        }, {
          label: "event",
          description: "event ui, commonly used for temporary event pages"
        }], {
          placeHolder: `Please confirm the client template type.`,
          ignoreFocusOut: true,
        }))!;
        await vscode.window.withProgress({
          location: vscode.ProgressLocation.Notification,
          title: `${extensionName}: launching the generation, please wait...`,
        }, async () => {
          newFileUri = (await this.generateClient(contextUri, clientUiType.label));
          newFileUri && this.jumpToFile(newFileUri)
        });
      }
    } catch {

      /* Auto-opening the file was not possible, warn the user the command is launched
       * and propose to refresh Explorer to see the generated files */
      this.showUnknownStatus().catch(() => { });
    }

  }
  private async inputAggregate() {
    let aggregateName = (await vscode.window.showInputBox({
      placeHolder: `Please confirm the aggregate name.`,
      ignoreFocusOut: true,
    }))!;

    if (aggregateName) {
      this.aggregateName = aggregateName;
      Output.logInfo(`aggregate used: "${this.aggregateName}"`);
    }
  }

  private async inputMod() {
    let modName = (await vscode.window.showInputBox({
      placeHolder: `Please confirm the module name.`,
      ignoreFocusOut: true,
    }))!;

    if (modName) {
      this.modName = modName;
      Output.logInfo(`mod used: "${this.modName}"`);
    }
  }

  private async inputOrg() {
    let orgName = this.workspaceFolder?.geexConfig?.orgName;

    orgName = (await vscode.window.showInputBox({
      placeHolder: `Please confirm the organization name.`,
      ignoreFocusOut: true,
      value: orgName,
    }))!;

    if (orgName) {
      this.orgName = orgName;
      Output.logInfo(`org used: "${this.orgName}"`);
    }
  }

  updateProjectDependencies(newFileUri: vscode.Uri) {
    const serverFolder = vscode.Uri.joinPath(newFileUri, "../../")
    const segments = newFileUri.path.split("/");
    const projectName = segments[segments.length - 1];
    const terminal = vscode.window.createTerminal({
      name: "geex schematics",
      cwd: serverFolder,
    });
    terminal.sendText(`dotnet sln add ./modules/${projectName}/${projectName}.Core/${projectName}.Core.csproj -s ./modules`);
  }
  private async generateModule(contextUri: vscode.Uri | undefined) {
    const body = {
      query: `mutation generateModule {
                  generateTemplate(
                    template: module,
                    args: {
                      moduleTemplate: {
                        org: "${this.orgName}"
                        moduleName: "${this.modName}"
                        aggregateName: "${this.aggregateName}"
                      }
                    }
                  ) {
                    url
                  }
                }`
    };

    let generate = await axios({
      method: 'post',
      url: 'https://api.dev.geex.tech/graphql/',
      headers: {
        'content-type': 'application/json'
      },
      data: body
    }).catch((error) => {
      Output.showError(`Error generate template: ${error}`);
    }) as AxiosResponse;

    let newFileUri = (await axios({
      method: 'get',
      url: generate.data.data.generateTemplate.url,
      responseType: "arraybuffer",
      headers: {
        'content-type': 'application/json',
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
        "Accept-Encoding": "gzip, deflate, br"
      },
    })
      .then(async (response) => {
        const fileName = response.headers['content-disposition'].split(';')[1].split('=')[1].replace("utf-8''", "") as string;
        const folderName = fileName.replace(".zip", "");
        const buffer = Buffer.from(response.data, 'binary');
        return this.unzipFromBuffer(buffer, vscode.Uri.joinPath(contextUri!, folderName));
      }).catch((error) => {
        Output.showError(`Error generate template: ${error}`);
      })) as vscode.Uri;
    return newFileUri;
  }

  private async generateSolution(contextUri: vscode.Uri | undefined) {
    const body = {
      query: `mutation generateSolution {
                  generateTemplate(
                    template: solution,
                    args: {
                      moduleTemplate: {
                        org: "${this.orgName}"
                        moduleName: "${this.modName}"
                        aggregateName: "${this.aggregateName}"
                      }
                    }
                  ) {
                    url
                  }
                }`
    };

    let generate = await axios({
      method: 'post',
      url: 'https://api.dev.geex.tech/graphql/',
      headers: {
        'content-type': 'application/json'
      },
      data: body
    }).catch((error) => {
      Output.showError(`Error generate template: ${error}`);
    }) as AxiosResponse;

    let newFileUri = (await axios({
      method: 'get',
      url: generate.data.data.generateTemplate.url,
      responseType: "arraybuffer",
      headers: {
        'content-type': 'application/json',
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
        "Accept-Encoding": "gzip, deflate, br"
      },
    })
      .then(async (response) => {
        const buffer = Buffer.from(response.data, 'binary');
        return this.unzipFromBuffer(buffer, contextUri!);
      }).catch((error) => {
        Output.showError(`Error generate template: ${error}`);
      })) as vscode.Uri;
    return newFileUri;
  }

  private async generateClient(contextUri: vscode.Uri | undefined, clientUiType: string) {
    const body = {
      query: `mutation generateClient {
                  generateTemplate(
                    template: client,
                    args: {
                      clientTemplate: {
                        org: "${this.orgName}"
                        clientUiType: ${clientUiType}
                      }
                    }
                  ) {
                    url
                  }
                }`
    };

    let generate = await axios({
      method: 'post',
      url: 'https://api.dev.geex.tech/graphql/',
      headers: {
        'content-type': 'application/json'
      },
      data: body
    }).catch((error) => {
      Output.showError(`Error generate template: ${error}`);
    }) as AxiosResponse;

    let newFileUri = (await axios({
      method: 'get',
      url: generate.data.data.generateTemplate.url,
      responseType: "arraybuffer",
      headers: {
        'content-type': 'application/json',
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
        "Accept-Encoding": "gzip, deflate, br"
      },
    })
      .then(async (response) => {
        const buffer = Buffer.from(response.data, 'binary');
        return this.unzipFromBuffer(buffer, contextUri!);
      }).catch((error) => {
        Output.showError(`Error generate template: ${error}`);
      })) as vscode.Uri;
    return newFileUri;
  }

  async askProjectName() {
    /* If there is only one Angular project, default to it */
    if (this.workspaceFolder.getAngularProjects().size === 1) {

      return Array.from(this.workspaceFolder.getAngularProjects().keys())[0];

    }
    /* Otherwise ask the user */
    else {

      const projectsChoices: vscode.QuickPickItem[] = Array.from(this.workspaceFolder.getAngularProjects())
        .map(([label, project]) => {

          /* Tell if it is an application or a library, and the path */
          const rawDescription = `${this.workspaceFolder.isRootAngularProject(label) ? `root ` : ''}${project.getType()} in ${project.getAppOrLibPath()}`;
          /* Uppercase first letter */
          const description = `${rawDescription.charAt(0).toUpperCase()}${rawDescription.substr(1)}`;

          return {
            label,
            description,
          };

        });

      const projectChoice = await vscode.window.showQuickPick(projectsChoices, {
        placeHolder: `In which your Angular projects do you want to generate?`,
        ignoreFocusOut: true,
      });

      return projectChoice?.label;

    }
  }


  async unzipFromBuffer(buffer: Buffer, targetFolder: vscode.Uri): Promise<vscode.Uri> {
    return new Promise<vscode.Uri>(async (resolve, reject) => {
      try {
        const zip = new JSZip();
        // const tempFileUri = vscode.Uri.joinPath(targetFolder, ".temp.zip");
        // JSZipUtils.getBinaryContent(source.fsPath, async (err: any, fileData: any) => {
        //   if (err) {
        //     reject(err);
        //   } else {

        const data = await zip.loadAsync(buffer, { base64: true });
        const entries = Object.values(data.files);

        for (const entry of entries) {
          const uri = vscode.Uri.joinPath(targetFolder, entry.name);
          if (entry.dir) {
            // Directory file names end with '/'.
            await vscode.workspace.fs.createDirectory(uri);
          } else {
            // File entry
            const content = await entry.async('nodebuffer');
            const parentUri = vscode.Uri.file(path.dirname(uri.fsPath));
            await vscode.workspace.fs.createDirectory(parentUri);
            await vscode.workspace.fs.writeFile(uri, content);
          }
        }

        resolve(targetFolder);
      } catch (error) {
        reject(error)
      }
      // }
      // });
    });
  }

  private async jumpToFile(possibleUri?: vscode.Uri, counter = 0): Promise<void> {

    /* If we don't know the generated file path, we can't know if the command succeeded or not,
     * as we can't react on Terminal output */
    if (!possibleUri) {

      throw new Error();

    }
    /* If the file exists, open it */
    else if (await FileSystem.isReadable(possibleUri, { silent: true })) {

      const document = await vscode.workspace.openTextDocument(possibleUri);

      await vscode.window.showTextDocument(document);

      /* Go back to previously active terminal */
      Terminals.back(this.workspaceFolder);

      Output.logInfo(`Command has succeeded! Check the Terminal for more details.`);

      schematicsProInfo(this.extensionContext).catch(() => { });

      return;

    }
    /* Otherwise retry every half second, 10 times (so 5 seconds maximum) */
    else if (counter < 10) {

      counter += 1;

      await new Promise<void>((resolve, reject) => {
        setTimeout(() => {
          this.jumpToFile(possibleUri, counter).then(() => {
            resolve();
          }).catch(() => {
            reject();
          });
        }, 500);
      });

    }
    /* After 10 failures */
    else {

      throw new Error();

    }

  }

  private async showUnknownStatus(): Promise<void> {

    const refreshLabel = `Refresh Explorer`;

    Output.logInfo(`Command launched.`);

    const action = await vscode.window.showInformationMessage(
      `Command launched, check the Terminal to know its status. You may need to refresh the Explorer to see the generated file(s).`,
      `Refresh Explorer`,
    );

    if (action === refreshLabel) {
      /* Refresh Explorer, otherwise you may not see the generated files */
      vscode.commands.executeCommand('workbench.files.action.refreshFilesExplorer').then(() => { }, () => { });
    }

  }

  async isDirectory(uri: vscode.Uri) {
    let stat = await vscode.workspace.fs.stat(uri);
    return (stat.type & vscode.FileType.Directory) !== 0;
  }
}
