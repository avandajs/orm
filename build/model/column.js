"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("reflect-metadata");
const Text_1 = __importDefault(require("../dataTypes/Text"));
const Int_1 = __importDefault(require("../dataTypes/Int"));
const Decimal_1 = __importDefault(require("../dataTypes/Decimal"));
const Bool_1 = __importDefault(require("../dataTypes/Bool"));
const Date_1 = __importDefault(require("../dataTypes/Date"));
const JSON_1 = __importDefault(require("../dataTypes/JSON"));
const Enum_1 = __importDefault(require("../dataTypes/Enum"));
const Point_1 = __importDefault(require("../dataTypes/Point"));
const column = function (dataType, options) {
    if (!options)
        options = {};
    return (target, propertyKey) => {
        let metadataKey = target.constructor.name;
        let properties = Reflect.getMetadata(metadataKey, target);
        dataType.size = options === null || options === void 0 ? void 0 : options.masSize;
        dataType.isNullable = options === null || options === void 0 ? void 0 : options.nullable;
        dataType.setter = options === null || options === void 0 ? void 0 : options.setter;
        dataType.getter = options === null || options === void 0 ? void 0 : options.getter;
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
const text = function (options) {
    return column(new Text_1.default(), options);
};
const int = function (options) {
    return column(new Int_1.default(), options);
};
const decimal = function (options) {
    return column(new Decimal_1.default(), options);
};
const boolean = function (options) {
    return column(new Bool_1.default(), options);
};
const date = function (options) {
    return column(new Date_1.default(), options);
};
const json = function (options) {
    return column(new JSON_1.default(), options);
};
const point = function (options) {
    return column(new Point_1.default(), options);
};
const _enum = function (acceptedValues, options) {
    let e = new Enum_1.default();
    e.args = acceptedValues;
    return column(e, options);
};
exports.default = {
    text,
    int,
    date,
    json,
    decimal,
    enum: _enum,
    boolean,
    point
};
