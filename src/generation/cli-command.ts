import * as vscode from 'vscode';
import * as path from 'path';
import { angularCollectionName } from '../defaults';
import { FileSystem, Output, Terminals } from '../utils';
import { WorkspaceFolderConfig } from '../workspace';
import { Schematic } from '../workspace/schematics';
import { CliCommandOptions, formatCliCommandOptions } from './cli-options';
interface ContextPath {
    /** Eg. `src/app/some-module` */
    relativeToWorkspaceFolder: string;
    /** Eg. `some-module` */
    relativeToProjectFolder: string;
}
export class CliCommand {
    /* Path details of the right-clicked file or directory */
    private contextPath: ContextPath = {
        relativeToWorkspaceFolder: '',
        relativeToProjectFolder: '',
    };
    private baseCommand = 'npx ng g';
    private projectName = '';
    private collectionName = angularCollectionName;
    private schematicName = '';
    private schematic!: Schematic;
    private nameAsFirstArg = '';
    private options: CliCommandOptions = new Map<string, string | string[]>();
    constructor(
        private workspaceFolder: WorkspaceFolderConfig,
        contextUri?: vscode.Uri,
    ) {
        this.setContextPathAndProject(contextUri);
    }
    /**
     * Get the full generation command, in the shortest form possible.
     */
    getCommand(): string {
        return [
            this.baseCommand,
            this.formatSchematicNameForCommand(),
            this.nameAsFirstArg,
            formatCliCommandOptions(this.options),
        ].join(' ').trim();
    }
    /**
     * Set collection's name
     */
    setCollectionName(name: string): void {
        this.collectionName = name;
    }
    /**
     * Set schematic, and project if relevant.
     */
    setSchematic(schematic: Schematic): void {
        this.schematicName = schematic.getName();
        this.schematic = schematic;
    }
    /**
     * Get project (can be an empty string, in which case the command will be for the root project)
     */
    getProjectName(): string {
        return this.projectName;
    }
    /**
     * Get project's source Uri, or defaut to `src/app`
     */
    getProjectSourceUri(): vscode.Uri {
        return vscode.Uri.joinPath(this.workspaceFolder.uri, this.getRelativeProjectSourcePath());
    }
    /**
     * Set the project's name
     */
    setProjectName(name: string): void {
        this.projectName = name;
    }
    /**
     * Add the project in command if available and relevant, or try to find "app.module.ts" path
     */
    async validateProject(): Promise<boolean> {
        // TODO: `@ngxs/schematics` has an issue, it's guessing just `src` path instead of `src/app`
        /* If a project was detected or chosen by the user */
        if (this.projectName) {
            /* We only need to add it to options if the schematic supports it and it's not the root project */
            if (this.schematic.hasOption('project') && !this.workspaceFolder.isRootAngularProject(this.projectName)) {
                this.options.set('project', this.projectName);
            }
        }
        /* Otherwise try to find the path of "app.module.ts" */
        else {
            const pattern = new vscode.RelativePattern(this.workspaceFolder, '**/app.module.ts');
            const appModulePossibleUris = await vscode.workspace.findFiles(pattern, '**/node_modules/**', 1);
            if (appModulePossibleUris.length > 0) {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                const pathRelativeToWorkspace = FileSystem.relative(this.workspaceFolder.uri, appModulePossibleUris[0]!);
                const commandPath = path.posix.dirname(pathRelativeToWorkspace);
                this.options.set('path', commandPath);
                Output.logInfo(`"app.module.ts" detected in: ${commandPath}`);
            } else {
                Output.logWarning(`No Angular project or "app.module.ts" detected.`);
                return false;
            }
        }
        return true;
    }
    /**
     * Get context path with a trailing slash to prefill first argument option.
     * With a trailing slash so the user can just write the name directly.
     */
    getContextForNameAsFirstArg(): string {
        /* Some schematics do not need a path */
        if ((this.collectionName === angularCollectionName)
        && ['application', 'library'].includes(this.schematicName)) {
            return '';
        }
        /* `ngx-spec` schematics works on a file, and thus need the file part */
        else if ((this.collectionName === 'ngx-spec') && (this.schematicName === 'spec')) {
            return this.contextPath.relativeToProjectFolder;
        }
        else if (this.collectionName === 'ngx-spec') {
            return '';
        }
        /* Otherwise we remove the file part */
        const context = FileSystem.removeFilename(this.contextPath.relativeToProjectFolder);
        /* Add  trailing slash so the user can just write the name directly */
        const contextWithTrailingSlash = !(['', '.'].includes(context)) ? `${context}/` : '';
        return contextWithTrailingSlash;
    }
    /**
     * Get route name from module's path
     */
    getRouteFromFirstArg(): string {
        return path.posix.basename(this.nameAsFirstArg);
    }
    /**
     * Set name as first argument of the command line, eg. `path/to/some-component`
     */
    setNameAsFirstArg(pathToName: string): void {
        this.nameAsFirstArg = pathToName;
    }
    /**
     * Add options
     */
    addOptions(options: CliCommandOptions | [string, string | string[]][]): void {
        for (const [name, option] of options) {
            /* Check they exist in schematic */
            if (this.schematic.hasOption(name)) {
                this.options.set(name, option);
            } else {
                Output.logWarning(`"--${name}" option has been chosen but does not exist in this schematic, so it won't be used.`);
            }
        }
    }
    /**
     * Launch command in a terminal
     */
    launchCommand({ dryRun = false } = {}): void {
        Output.logInfo(`Launching this command: ${this.getCommand()}`);
        const command = `${this.getCommand()}${dryRun ? ` --dry-run` : ''}`;
        Terminals.send(this.workspaceFolder, command);
    }
    /**
     * Try to resolve the generated file fs path
     */
    guessGereratedFileUri(): vscode.Uri | undefined {
        /* Try to resolve the path of the generated file */
        let possibleUri: vscode.Uri | undefined = undefined;
        /* Without a default argument, we cannot know the possible path */
        if (this.nameAsFirstArg) {
            /* Get the project path, or defaut to `src/app` */
            const projectSourceUri = this.getProjectSourceUri();
            /* Default file's suffix is the schematic name (eg. `service`) */
            let suffix = `.${this.schematicName}`;
            /* Official Geex Angular Schematics have some special cases */
            if (this.collectionName === angularCollectionName) {
                /* Component can have a custom suffix via `--type` option */
                if (['component', 'class', 'interface'].includes(this.schematicName) && this.options.has('type')) {
                    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                    suffix = `.${this.options.get('type')! as string}`;
                }
                /* Classes and interfaces do not have suffix */
                else if (['class', 'interface'].includes(this.schematicName)) {
                    suffix = '';
                }
                /* Web workers have not the same suffix as the schematic's name */
                else if (this.schematicName === 'webWorker') {
                    suffix = '.worker';
                }
            }
            /* All Material schematics have a component suffix */
            else if (['@angular/material', '@angular/cdk'].includes(this.collectionName)) {
                suffix = '.component';
            }
            else if (this.collectionName === '@ngrx/schematics') {
                if (['action', 'effect', 'selector'].includes(this.schematicName)) {
                    suffix = `.${this.schematicName}s`;
                } else if (this.schematicName === 'entity') {
                    suffix = '.model';
                } else if (this.schematicName === 'container') {
                    suffix = '.component';
                } else if (this.schematicName === 'data') {
                    suffix = '.service';
                }
            }
            /* `posix` here as it was typed by the user in Linux format (ie. with slashes) */
            const folderName = path.posix.dirname(this.nameAsFirstArg);
            const fileName = path.posix.basename(this.nameAsFirstArg);
            const fileWithSuffixName = `${fileName}${suffix}.ts`;
            /* Schematics are created with or without an intermediate folder */
            let isFlat = true;
            /* Priority 1: user has explicitly set it during the generation journey */
            if (this.options.has('flat')) {
                /* User values are registered as strings */
                isFlat = (this.options.get('flat') === 'false') ? false : true;
            } else {
                /* Priority 2: user has set a default in angular.json */
                const isUserDefaultFlat = this.workspaceFolder.getSchematicsOptionDefaultValue(this.projectName, this.getFullSchematicName(), 'flat');
                if (isUserDefaultFlat !== undefined) {
                    isFlat = isUserDefaultFlat;
                } else {
                    /* Priority 3: the schematic schema has a default */
                    const isSchematicDefaultFlat = this.schematic.getOptionDefaultValue('flat') as boolean | undefined;
                    if (isSchematicDefaultFlat !== undefined) {
                        isFlat = isSchematicDefaultFlat;
                    }
                    /* Priority 4: use hard defaults known for some schematics */
                    else if ((this.collectionName === angularCollectionName) && ['component', 'module'].includes(this.schematicName)) {
                        isFlat = false;
                    } else if (this.collectionName === '@ngxs/schematics') {
                        isFlat = false;
                    }
                }
            }
            /* If not flat, add a intermediate folder, which name is the same as the generated file */
            const generatedFolderUri = isFlat ?
                vscode.Uri.joinPath(projectSourceUri, folderName) :
                vscode.Uri.joinPath(projectSourceUri, folderName, fileName);
            possibleUri = vscode.Uri.joinPath(generatedFolderUri, fileWithSuffixName);
            Output.logInfo(`Guessed generated file path: ${possibleUri.path}`);
        }
        return possibleUri;
    }
    /**
     * Get project's relative source path, or defaut to `src/app`
     */
    private getRelativeProjectSourcePath(): string {
        const project = this.workspaceFolder.getAngularProject(this.projectName);
        return (this.projectName && project) ?
            project.getAppOrLibPath() :
            (this.options.get('path') as string | undefined) ?? 'src/app';
    }
    /**
     * Get full schematic name (eg. `@schematics/angular:component`)
     */
    private getFullSchematicName(): string {
        return `${this.collectionName}:${this.schematicName}`;
    }
    /**
     * Format collection and schematic name for the generation command:
     * - just the schematic name if the collection is already the user default's one (eg. `component`)
     * - otherwise the full scheme (eg. `@schematics/angular:component`)
     */
    private formatSchematicNameForCommand(): string {
        return (this.collectionName !== this.workspaceFolder.getDefaultUserCollection()) ?
            this.getFullSchematicName() : this.schematicName;
    }
    /**
     * Set context path and prject.
     */
    private setContextPathAndProject(contextUri?: vscode.Uri): void {
        if (!contextUri) {
            Output.logInfo(`No context path detected.`);
            return;
        }
        Output.logInfo(`Full context fsPath detected: ${contextUri.path}`);
        if ((this.workspaceFolder.uri.scheme === 'file') && (contextUri.scheme === 'file')) {
            /* Remove workspace folder path from full path,
            * eg. `/Users/Elmo/angular-project/src/app/some-module` => `src/app/some-module`
            * While we need a Posix path, for now we need to start from OS-specific fsPaths because of
            * https://github.com/microsoft/vscode/issues/116298 */
            const relativeToWorkspacePath = path.relative(this.workspaceFolder.uri.fsPath, contextUri.fsPath);
            /* Convert an OS-specific fsPath to a relative Posix path. */
            this.contextPath.relativeToWorkspaceFolder = (path.sep !== path.posix.sep) ? relativeToWorkspacePath.split(path.sep).join(path.posix.sep) : relativeToWorkspacePath;
        } else {
            this.contextPath.relativeToWorkspaceFolder = FileSystem.relative(this.workspaceFolder.uri, contextUri);
        }
        Output.logInfo(`Workspace folder-relative context path detected: ${this.contextPath.relativeToWorkspaceFolder}`);
        /* First try by matching projects *source* path */
        for (const [projectName, projectConfig] of this.workspaceFolder.getAngularProjects()) {
            const appOrLibPath = projectConfig.getAppOrLibPath();
            /* If the relative path starts with the project path */
            if (this.contextPath.relativeToWorkspaceFolder.startsWith(appOrLibPath)) {
                this.projectName = projectName;
                /* Remove source path from workspace folder relative path,
                 * eg. `src/app/some-module` => `some-module` */
                this.contextPath.relativeToProjectFolder = path.posix.relative(appOrLibPath, this.contextPath.relativeToWorkspaceFolder);
                break;
            }
        }
        /* Second try by matching projects *source* path */
        if (!this.projectName) {
            for (const [projectName, projectConfig] of this.workspaceFolder.getAngularProjects()) {
                /* If the relative path starts with the project path */
                if (this.contextPath.relativeToWorkspaceFolder.startsWith(projectConfig.getSourcePath())) {
                    this.projectName = projectName;
                    break;
                }
            }
        }
        /* Third try by matching projects *root* path */
        if (!this.projectName) {
            for (const [projectName, projectConfig] of this.workspaceFolder.getAngularProjects()) {
                /* If the relative path starts with the project path (but not empty) */
                if ((projectConfig.getRootPath() !== '') && this.contextPath.relativeToWorkspaceFolder.startsWith(projectConfig.getRootPath())) {
                    this.projectName = projectName;
                    break;
                }
            }
        }
        if (this.projectName) {
            Output.logInfo(`Source-relative context path detected: ${this.contextPath.relativeToProjectFolder}`);
            Output.logInfo(`Angular project detected from context path: "${this.projectName}"`);
        } else {
            Output.logInfo(`No Angular project detected from context path.`);
        }
    }
}
