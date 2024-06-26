/* eslint-disable @typescript-eslint/no-misused-promises */
import * as vscode from 'vscode';
import * as assert from 'assert';
import { describe, before, it } from 'mocha';
import { angularCollectionName } from '../../defaults';
import { WorkspaceFolderConfig } from '../../workspace';
import { COMPONENT_TYPE } from '../../workspace/shortcuts';
import { rootProjectName, ionicCollectionName, libProjectName, subAppProjectName, materialCollectionName } from './test-config';
describe('Workspace folder config', () => {
    describe('Defaults', () => {
        let workspaceFolder: WorkspaceFolderConfig;
        before(async function () {
            this.timeout(10000);
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            workspaceFolder = new WorkspaceFolderConfig(vscode.workspace.workspaceFolders![0]!);
            await workspaceFolder.init();
        });
        it('Angular default collections', () => {
            assert.strictEqual(angularCollectionName, workspaceFolder.getDefaultUserCollection());
            assert.deepStrictEqual([angularCollectionName], workspaceFolder.getSchematicCollections());
        });
        it('Angular projects', () => {
            assert.strictEqual(1, workspaceFolder.getAngularProjects().size);
            const rootProject = workspaceFolder.getAngularProject(rootProjectName);
            assert.strictEqual('application', rootProject?.getType());
            assert.strictEqual('', rootProject?.getRootPath());
            assert.strictEqual('src', rootProject?.getSourcePath());
            assert.strictEqual('src/app', rootProject?.getAppOrLibPath());
            assert.strictEqual(true, workspaceFolder.isRootAngularProject(rootProjectName));
        });
        it('Geex Angular Schematics defaults', () => {
            assert.strictEqual(undefined, workspaceFolder.getSchematicsOptionDefaultValue(rootProjectName, `${angularCollectionName}:component`, 'flat'));
        });
        it('TSLint component suffixes', () => {
            assert.strictEqual(false, workspaceFolder.hasComponentSuffix(rootProjectName, 'Page'));
        });
        it('Modules types', () => {
            assert.strictEqual(3, workspaceFolder.getModuleTypes().size);
        });
        it('Component types', () => {
            assert.strictEqual(4, workspaceFolder.getComponentTypes(rootProjectName).size);
            const pageComponentType = workspaceFolder.getComponentTypes(rootProjectName).get(COMPONENT_TYPE.PAGE);
            assert.strictEqual(false, pageComponentType?.options.has('type'));
        });
        it('Collections', () => {
            assert.deepStrictEqual([angularCollectionName], workspaceFolder.collections.getCollectionsNames());
            const angularCollection = workspaceFolder.collections.getCollection(angularCollectionName);
            assert.strictEqual(angularCollectionName, angularCollection?.getName());
            assert.strictEqual(true, angularCollection?.getSchematicsNames().includes('component'));
        });
        it('Schematics', () => {
            const angularComponentSchematic = workspaceFolder.collections.getCollection(angularCollectionName)?.getSchematic('component');
            assert.strictEqual('component', angularComponentSchematic?.getName());
            assert.strictEqual(0, angularComponentSchematic?.getRequiredOptions().size);
            assert.strictEqual(true, angularComponentSchematic?.hasNameAsFirstArg());
            assert.strictEqual(true, angularComponentSchematic?.hasOption('changeDetection'));
            assert.strictEqual(false, angularComponentSchematic?.getOptionDefaultValue('flat'));
            assert.strictEqual(1, angularComponentSchematic?.getSomeOptions(['export', 'elmo']).size);
        });
    });
    describe('Customized', () => {
        let workspaceFolder: WorkspaceFolderConfig;
        before(async () => {
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            workspaceFolder = new WorkspaceFolderConfig(vscode.workspace.workspaceFolders![1]!);
            await workspaceFolder.init();
        });
        it('Angular default collections', () => {
            assert.strictEqual(ionicCollectionName, workspaceFolder.getDefaultUserCollection());
            assert.deepStrictEqual([ionicCollectionName, angularCollectionName], workspaceFolder.getSchematicCollections());
        });
        it('Angular projects', () => {
            assert.strictEqual(3, workspaceFolder.getAngularProjects().size);
            const rootProject = workspaceFolder.getAngularProject(rootProjectName);
            assert.strictEqual('application', rootProject?.getType());
            assert.strictEqual('', rootProject?.getRootPath());
            assert.strictEqual('src', rootProject?.getSourcePath());
            assert.strictEqual('src/app', rootProject?.getAppOrLibPath());
            assert.strictEqual(true, workspaceFolder.isRootAngularProject(rootProjectName));
            const libProject = workspaceFolder.getAngularProject(libProjectName);
            assert.strictEqual('library', libProject?.getType());
            assert.strictEqual('projects/my-lib', libProject?.getRootPath());
            assert.strictEqual('projects/my-lib/src', libProject?.getSourcePath());
            assert.strictEqual('projects/my-lib/src/lib', libProject?.getAppOrLibPath());
            assert.strictEqual(false, workspaceFolder.isRootAngularProject(libProjectName));
            const subAppProject = workspaceFolder.getAngularProject(subAppProjectName);
            assert.strictEqual('application', subAppProject?.getType());
            assert.strictEqual('projects/other-app', subAppProject?.getRootPath());
            assert.strictEqual('projects/other-app/src', subAppProject?.getSourcePath());
            assert.strictEqual('projects/other-app/src/app', subAppProject?.getAppOrLibPath());
            assert.strictEqual(false, workspaceFolder.isRootAngularProject(subAppProjectName));
        });
        it('Geex Angular Schematics defaults', () => {
            assert.strictEqual(true, workspaceFolder.getSchematicsOptionDefaultValue(rootProjectName, `${angularCollectionName}:component`, 'flat'));
            assert.strictEqual(true, workspaceFolder.getSchematicsOptionDefaultValue(libProjectName, `${angularCollectionName}:component`, 'flat'));
            assert.strictEqual(false, workspaceFolder.getSchematicsOptionDefaultValue(subAppProjectName, `${angularCollectionName}:component`, 'flat'));
        });
        it('TSLint component suffixes', () => {
            assert.strictEqual(true, workspaceFolder.hasComponentSuffix(rootProjectName, 'Component'));
            assert.strictEqual(true, workspaceFolder.hasComponentSuffix(rootProjectName, 'Page'));
            assert.strictEqual(false, workspaceFolder.hasComponentSuffix(rootProjectName, 'Dialog'));
            assert.strictEqual(true, workspaceFolder.hasComponentSuffix(libProjectName, 'Component'));
            assert.strictEqual(true, workspaceFolder.hasComponentSuffix(libProjectName, 'Page'));
            assert.strictEqual(false, workspaceFolder.hasComponentSuffix(libProjectName, 'Dialog'));
            assert.strictEqual(true, workspaceFolder.hasComponentSuffix(subAppProjectName, 'Component'));
            assert.strictEqual(false, workspaceFolder.hasComponentSuffix(subAppProjectName, 'Page'));
            assert.strictEqual(true, workspaceFolder.hasComponentSuffix(subAppProjectName, 'Dialog'));
        });
        it('Modules types', () => {
            assert.strictEqual(3, workspaceFolder.getModuleTypes().size);
        });
        it('Component types', () => {
            assert.strictEqual(8, workspaceFolder.getComponentTypes(rootProjectName).size);
            const rootPageComponentType = workspaceFolder.getComponentTypes(rootProjectName).get(COMPONENT_TYPE.PAGE);
            assert.strictEqual('page', rootPageComponentType?.options.get('type'));
            const libPageComponentType = workspaceFolder.getComponentTypes(libProjectName).get(COMPONENT_TYPE.PAGE);
            assert.strictEqual('page', libPageComponentType?.options.get('type'));
            const subAppPageComponentType = workspaceFolder.getComponentTypes(subAppProjectName).get(COMPONENT_TYPE.PAGE);
            assert.strictEqual(false, subAppPageComponentType?.options.has('type'));
        });
        it('Collections', () => {
            assert.deepStrictEqual([ionicCollectionName, angularCollectionName, materialCollectionName, '@angular/cdk'], workspaceFolder.collections.getCollectionsNames());
            const angularCollection = workspaceFolder.collections.getCollection(angularCollectionName);
            assert.strictEqual(angularCollectionName, angularCollection?.getName());
            assert.strictEqual(true, angularCollection?.getSchematicsNames().includes('component'));
            const materialCollection = workspaceFolder.collections.getCollection(materialCollectionName);
            assert.strictEqual(materialCollectionName, materialCollection?.getName());
            assert.strictEqual(true, materialCollection?.getSchematicsNames().includes('table'));
            const ionicCollection = workspaceFolder.collections.getCollection(ionicCollectionName);
            assert.strictEqual(ionicCollectionName, ionicCollection?.getName());
            assert.strictEqual(true, ionicCollection?.getSchematicsNames().includes('component'));
            assert.strictEqual(true, ionicCollection?.getSchematicsNames().includes('page'));
        });
        it('Schematics', () => {
            const angularComponentSchematic = workspaceFolder.collections.getCollection(angularCollectionName)?.getSchematic('component');
            assert.strictEqual('component', angularComponentSchematic?.getName());
            assert.strictEqual(0, angularComponentSchematic?.getRequiredOptions().size);
            assert.strictEqual(true, angularComponentSchematic?.hasNameAsFirstArg());
            assert.strictEqual(true, angularComponentSchematic?.hasOption('changeDetection'));
            assert.strictEqual(false, angularComponentSchematic?.getOptionDefaultValue('flat'));
            assert.strictEqual(1, angularComponentSchematic?.getSomeOptions(['export', 'elmo']).size);
            const materialSchematic = workspaceFolder.collections.getCollection(materialCollectionName)?.getSchematic('table');
            assert.strictEqual('table', materialSchematic?.getName());
            assert.strictEqual(true, materialSchematic?.hasNameAsFirstArg());
            assert.strictEqual(true, materialSchematic?.hasOption('inlineTemplate'));
        });
    });
    describe('Angular ESLint', () => {
        let workspaceFolder: WorkspaceFolderConfig;
        before(async () => {
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            workspaceFolder = new WorkspaceFolderConfig(vscode.workspace.workspaceFolders![2]!);
            await workspaceFolder.init();
        });
        it('ESLint component suffixes', () => {
            assert.strictEqual(true, workspaceFolder.hasComponentSuffix(rootProjectName, 'Component'));
            assert.strictEqual(true, workspaceFolder.hasComponentSuffix(rootProjectName, 'Page'));
        });
    });
});
