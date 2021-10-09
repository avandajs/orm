"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const sequelize_1 = require("sequelize");
const DataType_1 = __importDefault(require("./DataType"));
class Int extends DataType_1.default {
    getType() {
        return sequelize_1.DataTypes.INTEGER;
    }
}
exports.default = Int;
