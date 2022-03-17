"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const sequelize_1 = require("sequelize");
const lodash_1 = require("lodash");
const error_1 = require("@avanda/error");
const app_1 = require("@avanda/app");
const moment_1 = __importDefault(require("moment"));
/*
* I know i should have a seperate class for query to make building query easier and more nestable,
* I think that's a future
* */
class Model {
    constructor() {
        this.currentPage = 1;
        this.totalPages = 1;
        this.perPage = 10;
        this.totalRows = 0;
        this.totalRecords = 0;
        this.orders = [];
        this.nextedWhereDone = false;
        this.connection = (0, app_1.Connection)({
            dbDialect: app_1.Env.get('DB_DRIVER', 'mysql'),
            dbName: app_1.Env.get('DB_NAME'),
            dbPassword: app_1.Env.get('DB_PASSWORD'),
            dbUser: app_1.Env.get('DB_USER', 'root')
        });
    }
    setPerPage(perPage) {
        this.perPage = perPage;
        return this;
    }
    setModelName(value) {
        this.modelName = value;
    }
    getPropertyTypes(origin) {
        const properties = Reflect.getMetadata(origin.constructor.name, origin);
        const result = {};
        properties.forEach(prop => {
            let options = prop.options;
            options.dataType.value = this[prop.name];
            result[prop.name] = options;
        });
        return result;
    }
    // query builder wrapper start here
    select(...columns) {
        if (columns.length == 1 && columns[0] == "")
            return this;
        this.tempSelectColumn = columns[columns.length - 1];
        this.columns = columns;
        return this;
    }
    sum(column) {
        this.tempSelectColumn = (0, sequelize_1.fn)('SUM', (0, sequelize_1.col)(column));
        return this;
    }
    as(alias) {
        if (!this.tempSelectColumn)
            throw new error_1.runtimeError(`'You haven't specified the expression to assign alias for`);
        this.columns.push([this.tempSelectColumn, alias]);
        return this;
    }
    where(condition) {
        return this._where(condition, sequelize_1.Op.and);
    }
    whereRaw(condition) {
        return this._where(condition, sequelize_1.Op.and, true);
    }
    orWhere(condition) {
        return this._where(condition, sequelize_1.Op.or);
    }
    closeQuery() {
        if (this.logicalOp && this.nextedWhereDone && this.whereClauses && this.tempClauses) {
            //    wrap the last one up
            this.whereClauses[this.logicalOp] = [...this.whereClauses[this.logicalOp], this.tempClauses];
            this.nextedWhereDone = false;
            this.logicalOp = undefined;
            this.tempClauses = undefined;
            this.tempColumn = undefined;
        }
    }
    static convertRawToArray(query) {
        ///[^\w\s]/
        let operators = {
            '>': sequelize_1.Op.gt,
            '<': sequelize_1.Op.lt,
            '=': sequelize_1.Op.eq,
            'not': sequelize_1.Op.not,
            'is': sequelize_1.Op.is,
            '!=': sequelize_1.Op.ne,
            '>=': sequelize_1.Op.gte,
            '<=': sequelize_1.Op.lte,
            'like': sequelize_1.Op.like,
            'not like': sequelize_1.Op.notLike,
        };
        let aliases = {
            'null': null
        };
        let tokens = /(\w+)\s+([^\w\s]+|not|is|LIKE|NOT\s+LIKE)\s+(.+)/i.exec(query);
        if (!tokens)
            return {};
        // console.log({tokens})
        let operator = tokens[2];
        let key = tokens[1];
        let value = tokens[3];
        let ret = {};
        if (operator in operators) {
            ret = { [key]: { [operators[operator]]: value in aliases ? aliases[value] : value } };
        }
        else {
            ret = { [key]: value in aliases ? aliases[value] : value };
        }
        // console.log({ret})
        return ret;
    }
    _where(condition, operand = sequelize_1.Op.and, isRaw = false) {
        this.closeQuery();
        if (typeof condition == 'function') {
            this.logicalOp = operand;
            condition(this);
            this.nextedWhereDone = true;
        }
        else if (typeof condition == 'object') {
            this.updateWhereClauses(operand, condition);
        }
        else if (typeof condition == 'string' && isRaw) {
            this.updateWhereClauses(operand, Model.convertRawToArray(condition));
        }
        else {
            this.tempColumn = condition;
        }
        return this;
    }
    updateWhereClauses(operand, condition) {
        var _a;
        if (this.whereClauses && operand == sequelize_1.Op.or && typeof ((_a = this.whereClauses) === null || _a === void 0 ? void 0 : _a.hasOwnProperty(sequelize_1.Op.and))) {
            this.whereClauses = {
                [operand]: [...this.whereClauses[sequelize_1.Op.and]]
            };
        }
        if (!this.whereClauses) {
            this.whereClauses = {
                [operand]: []
            };
        }
        if (!this.whereClauses[operand])
            this.whereClauses[operand] = [];
        if (this.logicalOp) {
            this.tempClauses = Object.assign(Object.assign({}, this.tempClauses), condition);
            return null;
        }
        if (!this.logicalOp && this.tempClauses) {
            condition = Object.assign(Object.assign({}, condition), this.tempClauses);
        }
        if (!this.logicalOp) {
            this.whereClauses[operand] = [...this.whereClauses[operand], condition];
        }
        if (this.logicalOp) {
            // console.log(this.tempClauses)
        }
        return condition;
    }
    ofId(id) {
        // @ts-ignore
        this.where({ id });
        return this;
    }
    ofUserId(id) {
        // @ts-ignore
        this.where({ user_id: id });
        return this;
    }
    greaterThan(value) {
        if (!this.tempColumn)
            throw new error_1.runtimeError("Specify column to apply greaterThan() to user the where() function");
        this.whereRaw(`${this.tempColumn} > ${value}`);
        return this;
    }
    async find(id) {
        var _a;
        this.closeQuery();
        return (_a = (await this.queryDb('findOne', {
            id
        }))) !== null && _a !== void 0 ? _a : null;
    }
    async findAll(id) {
        return await this.queryDb('findAll', {
            id
        });
    }
    async queryDb(fn, where = {}, fields) {
        var _a, _b, _c;
        let instance = await this.init();
        let page = this.currentPage - 1;
        let offset = this.perPage * page;
        let limit = this.perPage;
        // @ts-ignore
        let result = await instance[fn]({
            where: Object.assign(Object.assign({}, this.whereClauses), where),
            attributes: this.columns,
            order: this.orders,
            limit,
            offset
        });
        this.totalRows = (_b = (_a = result === null || result === void 0 ? void 0 : result.count) !== null && _a !== void 0 ? _a : result === null || result === void 0 ? void 0 : result.length) !== null && _b !== void 0 ? _b : 0;
        console.log({ total: this.totalRows });
        this.totalRecords = this.totalRows;
        this.totalPages = Math.ceil(this.totalRows / this.perPage);
        console.log({ totalPages: this.totalPages });
        return (_c = result === null || result === void 0 ? void 0 : result.rows) !== null && _c !== void 0 ? _c : result;
    }
    async findBy(col, value) {
        return await this.queryDb('findOne', {
            [col]: value
        });
    }
    async findAllBy(col, value) {
        return await this.queryDb('findAll', {
            [col]: value
        });
    }
    async first() {
        var _a;
        this.closeQuery();
        this.orders.push(['id', 'ASC']);
        return (_a = await this.queryDb('findOne')) !== null && _a !== void 0 ? _a : null;
    }
    async last() {
        var _a;
        this.closeQuery();
        this.orders.push(['id', 'DESC']);
        return (_a = await this.queryDb('findOne')) !== null && _a !== void 0 ? _a : null;
    }
    orderBy(column, order = 'DESC') {
        this.orders.push([column, order]);
        return this;
    }
    async all() {
        var _a;
        this.closeQuery();
        return (_a = await this.queryDb('findAll')) !== null && _a !== void 0 ? _a : [];
    }
    // query builder wrapper ends here
    async init() {
        if (this.initInstance)
            return this.initInstance;
        this.initInstance = await this.convertToSequelize();
        return this.initInstance;
    }
    async convertToSequelize() {
        var _a, _b, _c, _d, _e;
        this.sequelize = await this.connection;
        let structure = {};
        let props = this.getPropertyTypes(this);
        for (let prop in props) {
            let value = props[prop];
            let type = (_a = value === null || value === void 0 ? void 0 : value.dataType) === null || _a === void 0 ? void 0 : _a.getType();
            if (!type)
                continue;
            if (value.references)
                value.references.sequelize = this.sequelize;
            structure[prop] = Object.assign(Object.assign(Object.assign(Object.assign(Object.assign({ type, unique: value.unique ? value.unique : undefined, comment: value.comment, defaultValue: (_b = value === null || value === void 0 ? void 0 : value.dataType) === null || _b === void 0 ? void 0 : _b.value, allowNull: typeof value.nullable == 'undefined' ? false : value.nullable }, (value.onDeleted && { onDelete: value.onDeleted })), (value.onUpdated && { onUpdated: value.onUpdated })), (value.references && {
                references: {
                    model: await ((_c = value.references) === null || _c === void 0 ? void 0 : _c.init()),
                    key: 'id'
                }
            })), (((_d = value === null || value === void 0 ? void 0 : value.dataType) === null || _d === void 0 ? void 0 : _d.getter) && {
                get() {
                    var _a, _b;
                    const rawValue = this.getDataValue(prop);
                    return (_b = (_a = value === null || value === void 0 ? void 0 : value.dataType) === null || _a === void 0 ? void 0 : _a.getter) === null || _b === void 0 ? void 0 : _b.call(_a, rawValue);
                }
            })), (((_e = value === null || value === void 0 ? void 0 : value.dataType) === null || _e === void 0 ? void 0 : _e.setter) && {
                async set(val) {
                    var _a, _b;
                    let newValue = await ((_b = (_a = value === null || value === void 0 ? void 0 : value.dataType) === null || _a === void 0 ? void 0 : _a.setter) === null || _b === void 0 ? void 0 : _b.call(_a, val));
                    console.log({ newValue });
                    this.setDataValue('password', newValue);
                }
            }));
        }
        // console.log(structure)
        if (!this.sequelize)
            this.sequelize = new sequelize_1.Sequelize();
        let that = this;
        return this.sequelize.define(this.modelName || this.constructor.name, structure, {
            tableName: (0, lodash_1.snakeCase)(this.modelName || this.constructor.name),
            omitNull: false,
            hooks: {
                beforeCreate: async (model) => {
                    let gl = await this.override(this.getOnlyPropsFromInstance());
                    let newData = await this.overrideInsert(this.getOnlyPropsFromInstance());
                    model.set(Object.assign(Object.assign({}, gl), newData));
                },
                beforeUpdate: async (model) => {
                    let gl = await this.override(this.getOnlyPropsFromInstance());
                    let newData = await this.overrideUpdate(this.getOnlyPropsFromInstance());
                    model.set(Object.assign(Object.assign({}, gl), newData));
                }
            }
            // Other model options go here
        });
    }
    whereColIsNull(column) {
        this.whereRaw(`${column} is null`);
        return this;
    }
    whereNotUpdatedSince(count, unit = 'days') {
        this.updateWhereClauses(sequelize_1.Op.and, {
            ['updatedAt']: {
                [sequelize_1.Op.lt]: (0, moment_1.default)().subtract(count, unit).toDate()
            }
        });
        return this;
    }
    whereHasExpired() {
        this.updateWhereClauses(sequelize_1.Op.and, {
            ['expiresOn']: {
                [sequelize_1.Op.lte]: new Date()
            }
        });
        return this;
    }
    whereHasNotExpired() {
        this.updateWhereClauses(sequelize_1.Op.and, {
            ['expiresOn']: {
                [sequelize_1.Op.gt]: new Date()
            }
        });
        return this;
    }
    whereNotCreatedSince(count, unit = 'days') {
        this.updateWhereClauses(sequelize_1.Op.and, {
            ['createdAt']: {
                [sequelize_1.Op.lt]: (0, moment_1.default)().subtract(count, unit).toDate()
            }
        });
        return this;
    }
    whereColIn(column, values) {
        this.updateWhereClauses(sequelize_1.Op.and, {
            [column]: {
                [sequelize_1.Op.in]: values
            }
        });
        return this;
    }
    whereColIsNotNull(column) {
        this.whereRaw(`${column} not null`);
        return this;
    }
    whereColumns(...column) {
        return this;
    }
    matches(value) {
        return this;
    }
    like(keyword) {
        if (!this.tempColumn)
            throw new error_1.runtimeError(`Chain like() method with where(column: string)`);
        this.whereRaw(`${this.tempColumn} like ${keyword}`);
        return this;
    }
    notLike(keyword) {
        if (!this.tempColumn)
            throw new error_1.runtimeError(`Chain notLike() method with where(column: string)`);
        this.whereRaw(`${this.tempColumn} not like ${keyword}`);
        return this;
    }
    getOnlyPropsFromInstance() {
        let props = this.getPropertyTypes(this);
        Object.keys(props).map(key => {
            if (this[key])
                props[key] = this[key];
            else
                delete props[key];
        });
        return props;
    }
    //    Writing
    async save() {
        return (await (await this.init()).create(this.getOnlyPropsFromInstance()));
    }
    async truncate() {
        return (await (await this.init()).destroy({
            truncate: true
        }));
    }
    async delete() {
        return (await (await this.init()).destroy({
            where: this.whereClauses
        }));
    }
    async update(data) {
        return await (await this.init()).update(data, {
            where: this.whereClauses
        });
    }
    async increment(column, by = 1) {
        return (await (await this.init()).increment({ [column]: by }, {
            where: this.whereClauses
        }));
    }
    async decrement(column, by = 1) {
        return (await (await this.init()).increment({ [column]: -by }, {
            where: this.whereClauses
        }));
    }
    async page(num) {
        var _a;
        this.currentPage = num;
        this.closeQuery();
        return (_a = await this.queryDb('findAndCountAll')) !== null && _a !== void 0 ? _a : [];
    }
    async create(data) {
        return (await (await this.init()).create(data));
    }
    async createBulk(data) {
        return await (await this.init()).bulkCreate(data);
    }
    overrideInsert(data) {
        return {};
    }
    overrideUpdate(data) {
        return {};
    }
    async override(data) {
        return {};
    }
}
exports.default = Model;
