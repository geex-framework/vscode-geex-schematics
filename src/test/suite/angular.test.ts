import * as assert from 'assert';
import { describe, beforeEach, it } from 'mocha';
import { angularCollectionName } from '../../defaults';
import { AngularConfig } from '../../workspace/angular';
describe('Angular config', () => {
    let angularConfig: AngularConfig;
    const ionicCollection = '@ionic/angular-toolkit';
    beforeEach(() => {
        angularConfig = new AngularConfig();
    });
    describe('Default collections', () => {
        it('with no config', () => {
            const config = angularConfig['validateConfig']({
                version: 1
            });
            angularConfig['initSchematicCollections'](config);
            assert.strictEqual(angularCollectionName, angularConfig.defaultUserCollection);
            assert.deepEqual([angularCollectionName], angularConfig.schematicCollections);
        });
        it('with config', () => {
            const config = angularConfig['validateConfig']({
                version: 1,
                cli: {
                    defaultCollection: ionicCollection
                }
            });
            angularConfig['initSchematicCollections'](config);
            assert.strictEqual(ionicCollection, angularConfig.defaultUserCollection);
            assert.deepEqual([ionicCollection, angularCollectionName], angularConfig.schematicCollections);
        });
    });
    describe('Schematics defaults', () => {
        it('with no config', () => {
            const config = angularConfig['validateConfig']({
                version: 1
            });
            angularConfig['initSchematicsDefaults'](config);
            assert.strictEqual(undefined, angularConfig.getSchematicsOptionDefaultValue(`${angularCollectionName}:component`, 'flat'));
        });
        it('with config', () => {
            const config = angularConfig['validateConfig']({
                version: 1,
                schematics: {
                    [`${angularCollectionName}:component`]: {
                        flat: true
                    }
                }
            });
            angularConfig['initSchematicsDefaults'](config);
            assert.strictEqual(true, angularConfig.getSchematicsOptionDefaultValue(`${angularCollectionName}:component`, 'flat'));
        });
    });
});
