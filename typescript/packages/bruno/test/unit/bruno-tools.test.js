"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var fs = require("fs");
var path = require("path");
var yaml = require("js-yaml");
describe('bruno tools', function () {
    var toolNames = [
        'bruno_run_collection',
        'bruno_run_request',
        'bruno_list_collections',
        'bruno_get_collection_info',
        'bruno_import_openapi',
        'bruno_create_collection',
        'bruno_add_request'
    ];
    toolNames.forEach(function (toolName) {
        describe(toolName, function () {
            var toolDefinition;
            beforeAll(function () {
                var toolPath = path.join(__dirname, "../../tools/".concat(toolName, "/definition.yaml"));
                var content = fs.readFileSync(toolPath, 'utf-8');
                toolDefinition = yaml.load(content);
            });
            it('should load valid YAML definition', function () {
                expect(toolDefinition).toBeDefined();
                expect(toolDefinition.name).toBe(toolName);
            });
            it('should have required fields', function () {
                expect(toolDefinition.description).toBeDefined();
                expect(toolDefinition.version).toBeDefined();
                expect(toolDefinition.status).toBe('stable');
                expect(toolDefinition.parameters).toBeDefined();
                expect(toolDefinition.execution).toBeDefined();
                expect(toolDefinition.output_schema).toBeDefined();
            });
            it('should have valid authentication config', function () {
                expect(toolDefinition.authentication).toBeDefined();
                expect(['api_key', 'bearer', 'basic', 'oauth2']).toContain(toolDefinition.authentication.type);
            });
            it('should have at least one example', function () {
                expect(toolDefinition.examples).toBeDefined();
                expect(Array.isArray(toolDefinition.examples)).toBe(true);
                expect(toolDefinition.examples.length).toBeGreaterThanOrEqual(1);
            });
            it('should have valid execution config', function () {
                var execution = toolDefinition.execution;
                expect(['command', 'function']).toContain(execution.type);
                // CLI-based tools use command type
                if (execution.type === 'command') {
                    expect(execution.command).toBe('bru');
                    expect(Array.isArray(execution.args)).toBe(true);
                }
                // Programmatic tools use function type
                if (execution.type === 'function') {
                    expect(execution.function).toBeDefined();
                }
            });
        });
    });
});
