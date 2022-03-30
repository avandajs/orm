"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const sequelize_1 = require("sequelize");
const acos = (value) => {
    return (0, sequelize_1.fn)('ACOS', value);
};
const cos = (value) => {
    return (0, sequelize_1.fn)('COS', value);
};
const radians = (value) => {
    return (0, sequelize_1.fn)('RADIANS', value);
};
const sin = (value) => {
    return (0, sequelize_1.fn)('SIN', value);
};
const sum = (value) => {
    return (0, sequelize_1.fn)('SIN', value);
};
exports.default = {
    acos,
    cos,
    radians,
    sin,
    sum
};
