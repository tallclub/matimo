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
        var collectionPath, requestName, args, command, output, parsed;
        return __generator(this, function (_a) {
            collectionPath = params.collection_path;
            requestName = params.request_name;
            if (!collectionPath || !requestName) {
                throw new Error('collection_path and request_name parameters are required');
            }
            try {
                logger.info("Running request: ".concat(requestName, " from ").concat(collectionPath));
                args = ['run', "".concat(collectionPath, "/").concat(requestName, ".bru")];
                if (params.environment)
                    args.push('--env', params.environment);
                if (params.env_file)
                    args.push('--env-file', params.env_file);
                args.push('--sandbox', params.sandbox_mode || 'safe');
                command = "bru ".concat(args.join(' '));
                logger.debug("Executing: ".concat(command));
                output = (0, child_process_1.execSync)(command, { encoding: 'utf-8', stdio: 'pipe' });
                logger.info('Request execution completed');
                parsed = void 0;
                try {
                    parsed = JSON.parse(output);
                }
                catch (_b) {
                    logger.warn('Could not parse output as JSON');
                    parsed = { raw_output: output };
                }
                return [2 /*return*/, {
                        success: true,
                        request: { method: '', url: '', headers: {}, body: {} },
                        response: { status: 200, headers: {}, body: {}, duration_ms: 0 },
                        assertions: [],
                        errors: [],
                        details: parsed
                    }];
            }
            catch (error) {
                logger.error("Request execution failed: ".concat(error instanceof Error ? error.message : String(error)));
                return [2 /*return*/, {
                        success: false,
                        request: { method: '', url: '', headers: {}, body: {} },
                        response: { status: 0, headers: {}, body: {}, duration_ms: 0 },
                        assertions: [],
                        errors: [error instanceof Error ? error.message : String(error)]
                    }];
            }
            return [2 /*return*/];
        });
    });
}
