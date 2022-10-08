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
const query = (query) => {
    return (0, sequelize_1.literal)(query);
};
// let range = 10;
// where(Sequelize.fn("ST_DWithin",
// Sequelize.col("location"),
// Sequelize.fn("ST_SetSRID",
// Sequelize.fn("ST_MakePoint",long, lat), 4326),
// +range * 0.016), true)
const point = (longitude, latitude) => {
    return (0, sequelize_1.fn)('ST_SetSRID', (0, sequelize_1.fn)('ST_MakePoint', longitude, latitude), 4326);
};
const within = (column, point, range) => {
    return (0, sequelize_1.fn)('ST_Within', (0, sequelize_1.col)(column), point, +range * 0.016);
};
const latitude = (column) => {
    return (0, sequelize_1.fn)('ST_X', (0, sequelize_1.col)(column));
};
const longitude = (column) => {
    return (0, sequelize_1.fn)('ST_Y', (0, sequelize_1.col)(column));
};
const distance = (column, { latitude, longitude }) => {
    return (0, sequelize_1.fn)('ST_Distance_Sphere', (0, sequelize_1.col)(column), (0, sequelize_1.fn)('ST_PointFromText', `POINT(${latitude} ${longitude})`));
};
exports.default = {
    acos,
    cos,
    radians,
    sin,
    sum,
    within,
    point,
    longitude,
    latitude,
    distance,
    query
};
