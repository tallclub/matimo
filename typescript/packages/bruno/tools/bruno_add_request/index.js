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
exports.brunoAddRequest = brunoAddRequest;
var fs_1 = require("fs");
var path = require("path");
/**
 * Generate Bruno .bru file content from parameters
 */
function generateBruContent(input) {
    var method = input.method, url = input.url, headers = input.headers, body = input.body, tests = input.tests, documentation = input.documentation;
    var content = '';
    // Metadata
    if (documentation) {
        content += "meta {\n  name: ".concat(input.request_name, "\n  type: http\n  seq: 1\n}\n\ndocs {\n  ").concat(documentation, "\n}\n\n");
    }
    else {
        content += "meta {\n  name: ".concat(input.request_name, "\n  type: http\n  seq: 1\n}\n\n");
    }
    // Method and URL
    content += "".concat(method, " {\n  url: ").concat(url, "\n  body: ").concat(body ? 'json' : 'none', "\n  auth: inherit\n}\n\n");
    // Headers
    if (headers && Object.keys(headers).length > 0) {
        content += "headers {\n";
        for (var _i = 0, _a = Object.entries(headers); _i < _a.length; _i++) {
            var _b = _a[_i], key = _b[0], value = _b[1];
            content += "  ".concat(key, ": ").concat(value, "\n");
        }
        content += "}\n\n";
    }
    // Body
    if (body) {
        content += "body:json {\n".concat(body
            .split('\n')
            .map(function (line) { return "  ".concat(line); })
            .join('\n'), "\n}\n\n");
    }
    // Tests
    if (tests) {
        content += "tests {\n".concat(tests
            .split('\n')
            .map(function (line) { return "  ".concat(line); })
            .join('\n'), "\n}\n");
    }
    return content;
}
/**
 * Add a request to a Bruno collection
 */
function brunoAddRequest(input) {
    return __awaiter(this, void 0, void 0, function () {
        var collection_path, request_name, requestsDir, error_1, filename, requestPath, content, error_2, errorMessage;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 6, , 7]);
                    collection_path = input.collection_path, request_name = input.request_name;
                    // Validate inputs
                    if (!collection_path || !request_name) {
                        return [2 /*return*/, {
                                success: false,
                                request_path: '',
                                request_name: '',
                                message: 'collection_path and request_name are required'
                            }];
                    }
                    requestsDir = path.join(collection_path, 'requests');
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, fs_1.promises.mkdir(requestsDir, { recursive: true })];
                case 2:
                    _a.sent();
                    return [3 /*break*/, 4];
                case 3:
                    error_1 = _a.sent();
                    return [3 /*break*/, 4];
                case 4:
                    filename = "".concat(request_name.toLowerCase().replace(/\s+/g, '-'), ".bru");
                    requestPath = path.join(requestsDir, filename);
                    content = generateBruContent(input);
                    // Write file
                    return [4 /*yield*/, fs_1.promises.writeFile(requestPath, content, 'utf-8')];
                case 5:
                    // Write file
                    _a.sent();
                    return [2 /*return*/, {
                            success: true,
                            request_path: requestPath,
                            request_name: request_name,
                            message: "Request '".concat(request_name, "' added to collection successfully")
                        }];
                case 6:
                    error_2 = _a.sent();
                    errorMessage = error_2 instanceof Error ? error_2.message : String(error_2);
                    return [2 /*return*/, {
                            success: false,
                            request_path: '',
                            request_name: input.request_name,
                            message: "Failed to add request: ".concat(errorMessage)
                        }];
                case 7: return [2 /*return*/];
            }
        });
    });
}
