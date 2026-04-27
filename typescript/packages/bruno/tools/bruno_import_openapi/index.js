"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.execute = execute;
var core_1 = require("@matimo/core");
var child_process_1 = require("child_process");
var logger = (0, core_1.getGlobalMatimoLogger)();
function execute(params) {
    return __awaiter(this, void 0, void 0, function () {
        var specSource, outputDirectory, args, command, output, parsed;
        return __generator(this, function (_a) {
            specSource = params.spec_source;
            outputDirectory = params.output_directory;
            if (!specSource || !outputDirectory) {
                throw new Error('spec_source and output_directory parameters are required');
            }
            try {
                logger.info("Importing OpenAPI from: ".concat(specSource, " to ").concat(outputDirectory));
                args = ['import', 'openapi', '--source', specSource, '--output', outputDirectory];
                if (params.collection_name)
                    args.push('--collection-name', params.collection_name);
                if (params.collection_format)
                    args.push('--collection-format', params.collection_format);
                if (params.group_by)
                    args.push('--group-by', params.group_by);
                if (params.insecure === true)
                    args.push('--insecure');
                command = "bru ".concat(args.join(' '));
                logger.debug("Executing: ".concat(command));
                output = (0, child_process_1.execSync)(command, { encoding: 'utf-8', stdio: 'pipe' });
                logger.info('OpenAPI import completed');
                parsed = void 0;
                try {
                    parsed = JSON.parse(output);
                }
                catch (_b) {
                    parsed = { raw_output: output };
                }
                return [2 /*return*/, {
                        success: true,
                        collection_path: outputDirectory,
                        collection_name: params.collection_name || 'Imported Collection',
                        requests_created: 0,
                        message: 'Collection imported successfully',
                        errors: [],
                        details: parsed
                    }];
            }
            catch (error) {
                logger.error("OpenAPI import failed: ".concat(error instanceof Error ? error.message : String(error)));
                return [2 /*return*/, {
                        success: false,
                        collection_path: outputDirectory,
                        collection_name: '',
                        requests_created: 0,
                        message: 'Import failed',
                        errors: [error instanceof Error ? error.message : String(error)]
                    }];
            }
            return [2 /*return*/];
        });
    });
}
