import * as vscode from 'vscode';
import { angularCollectionName, extensionName } from './defaults';
import { isSchematicsProActive, Output, Terminals } from './utils';
import { Workspace } from './workspace';
import { UserJourney } from './generation';
import { SchematicsTreeDataProvider, SchematicsTreeDataProviderEmpty } from './view';
import { GeexUserJourney } from './generation/geex-user-journey';
let treeDataProvider: vscode.TreeView<vscode.TreeItem> | undefined;
/**
 * Function called when the extension is activated, to register new commands.
 * Activation triggers are configured in `package.json`.
 */
export function activate(context: vscode.ExtensionContext): void {
  if (isSchematicsProActive()) {
    return;
  }
  Output.logInfo(`${extensionName} extension has been activated.`);
  /* Enable context menus */
  vscode.commands.executeCommand('setContext', 'inAngularProject', true).then(() => { }, () => { });
  if (isSchematicsProActive()) {
    return;
  }
  /* Initialize all configurations */
  Workspace.init().catch(() => { });
  if (isSchematicsProActive()) {
    return;
  }
  /* Add a new View with the list of all Geex Angular Schematics.
  * Collections must be loaded to be able to load the view */
  Workspace.whenStable().then(() => {
    if (isSchematicsProActive()) {
      return;
    }
    treeDataProvider = vscode.window.createTreeView('geex-schematics', {
      treeDataProvider: new SchematicsTreeDataProviderEmpty(),
    });
  }).catch(() => { });
  if (isSchematicsProActive()) {
    return;
  }
  Terminals.init();
  if (isSchematicsProActive()) {
    return;
  }
  /*
  * Register new commands. Important things:
  * - each id (first parameter of `registerCommand()`) must be configured in `package.json`
  * - the callback parameters' values depends on how the command is trigerred:
  *   - with a right click in Explorer: will a `Uri` object of the file or folder clicked
  *   - with the Command Palette or the dedicated extension panel: `undefined`
  *   - from the dedicated extension panel: `undefined`, clicked schema's name, clicked collection's name
  */
  context.subscriptions.push(
    vscode.commands.registerCommand('geex_schematics.generateComponent', (contextUri?: vscode.Uri) => {
      Output.logInfo(`Starting journey to generate a component.`);
      /* For shortcuts, always use default official collection
      * (default user collection can be set to something else,
      * and this can be an issue when they are buggy like the Ionic ones) */
      (new UserJourney()).start(context, contextUri, angularCollectionName, 'component').catch(() => { });
    }),
    vscode.commands.registerCommand('geex_schematics.generateService', (contextUri?: vscode.Uri) => {
      Output.logInfo(`Starting journey to generate a service.`);
      /* For shortcuts, always use default official collection
      * (default user collection can be set to something else,
      * and this can be an issue when they are buggy like the Ionic ones) */
      (new UserJourney()).start(context, contextUri, angularCollectionName, 'service').catch(() => {});
    }),
    vscode.commands.registerCommand('geex_schematics.generateModule', (contextUri?: vscode.Uri) => {
      Output.logInfo(`Starting journey to generate a module.`);
      /* For shortcuts, always use default official collection
      * (default user collection can be set to something else,
      * and this can be an issue when they are buggy like the Ionic ones) */
      (new UserJourney()).start(context, contextUri, angularCollectionName, 'module').catch(() => { });
    }),
    vscode.commands.registerCommand('geex_schematics.generateGeexSchematics', (contextUri?: vscode.Uri) => {
      Output.logInfo(`Starting journey to generate a geex module.`);
      /* For shortcuts, always use default official collection
      * (default user collection can be set to something else,
      * and this can be an issue when they are buggy like the Ionic ones) */
      (new GeexUserJourney()).start(context, contextUri).catch(() => { });
    }),
    vscode.commands.registerCommand('geex_schematics.generateFrontendSchematics', (contextUri?: vscode.Uri, options?: { collectionName?: string, schematicName?: string }) => {
      Output.logInfo(`Starting journey to generate a schematics.`);
      (new UserJourney()).start(context, contextUri, options?.collectionName, options?.schematicName).catch(() => { });
    }),
    vscode.commands.registerCommand(`geex_schematics.documentation`, () => {
      vscode.commands.executeCommand('workbench.action.openWalkthrough', `lulus.geex-schematics#angularschematics`).then(() => {
        vscode.commands.executeCommand('walkthroughs.selectStep', `documentation`).then(() => { }, () => { });
      }, () => { });
    }),
    vscode.commands.registerCommand(`geex_schematics.showtree`, () => {
      treeDataProvider = vscode.window.createTreeView('geex-schematics', {
        treeDataProvider: new SchematicsTreeDataProvider(),
      });
      treeDataProvider.message = `Below is a list of available schematics. Note
            it's easier to launch a generation with a right-click on a folder in the Explorer,
            as then the extension will infer the workspace folder, path and project.`;
    }),
  );
}
/**
 * Function called when the extension is deactivated, to do cleaning.
 */
export function deactivate(): void {
  for (const [, workspaceFolder] of Workspace.folders) {
    workspaceFolder.disposeWatchers();
  }
  Terminals.disposeAll();
  Output.dispose();
  treeDataProvider?.dispose();
}
