"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("reflect-metadata");
const Text_1 = __importDefault(require("../dataTypes/Text"));
const Int_1 = __importDefault(require("../dataTypes/Int"));
let column = function (dataType, options) {
    if (!options)
        options = {};
    return (target, propertyKey) => {
        let metadataKey = target.constructor.name;
        let properties = Reflect.getMetadata(metadataKey, target);
        dataType.size = options === null || options === void 0 ? void 0 : options.masSize;
        dataType.isNullable = options === null || options === void 0 ? void 0 : options.nullable;
        options.dataType = dataType;
        if (properties) {
            properties.push({
                name: propertyKey,
                options
            });
        }
        else {
            properties = [{
                    name: propertyKey,
                    options
                }];
            Reflect.defineMetadata(metadataKey, properties, target);
        }
    };
};
let text = function (options) {
    return column(new Text_1.default(), options);
};
let int = function (options) {
    return column(new Int_1.default(), options);
};
exports.default = {
    text,
    int
};
