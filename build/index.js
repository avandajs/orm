"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Column = exports.Model = void 0;
const model_1 = __importDefault(require("./model/model"));
exports.Model = model_1.default;
const column_1 = __importDefault(require("./model/column"));
exports.Column = column_1.default;
