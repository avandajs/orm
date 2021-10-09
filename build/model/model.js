"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const sequelize_1 = require("sequelize");
const lodash_1 = require("lodash");
const error_1 = require("@avanda/error");
/*
* I know i should have a seperate class for query to make building query easier and more nestable,
* I think that's a future
* */
class Model {
    constructor(connection) {
        this.orders = [];
        this.nextedWhereDone = false;
        this.connection = connection;
    }
    setConnection(connection) {
        this.connection = connection;
    }
    setModelName(value) {
        this.modelName = value;
    }
    getPropertyTypes(origin) {
        const properties = Reflect.getMetadata(this.constructor.name, this);
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
    generateWhereClause() {
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
    convertRawToArray(query) {
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
            this.updateWhereClauses(operand, this.convertRawToArray(condition));
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
    greaterThan(value) {
        if (!this.tempColumn)
            throw new error_1.runtimeError("Specify column to apply greaterThan() to user the where() function");
        this.whereRaw(`${this.tempColumn} > ${value}`);
        return this;
    }
    async find(id) {
        var _a;
        this.closeQuery();
        return (_a = (await this.queryDb('findAll', {
            id
        }))) !== null && _a !== void 0 ? _a : null;
    }
    async findAll(id) {
        return await this.queryDb('findAll', {
            id
        });
    }
    async queryDb(fn, where = {}, fields) {
        return (await this.init()[fn]({
            where: Object.assign(Object.assign({}, this.whereClauses), where),
            attributes: this.columns,
            order: this.orders
        }));
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
        this.orders.push(['id', 'ASC']);
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
    init() {
        if (this.initInstance)
            return this.initInstance;
        this.initInstance = this.convertToSequelize();
        return this.initInstance;
    }
    convertToSequelize() {
        var _a, _b, _c;
        let structure = {};
        let props = this.getPropertyTypes(this);
        for (let prop in props) {
            let value = props[prop];
            let type = (_a = value === null || value === void 0 ? void 0 : value.dataType) === null || _a === void 0 ? void 0 : _a.getType();
            if (!type)
                continue;
            if (value.references)
                value.references.connection = this.connection;
            structure[prop] = Object.assign({ type, defaultValue: (_b = value === null || value === void 0 ? void 0 : value.dataType) === null || _b === void 0 ? void 0 : _b.value, allowNull: typeof value.nullable == 'undefined' ? false : value.nullable }, (value.references && {
                references: {
                    model: (_c = value.references) === null || _c === void 0 ? void 0 : _c.init(),
                    key: 'id'
                }
            }));
        }
        // console.log(structure)
        if (!this.connection)
            this.connection = new sequelize_1.Sequelize();
        return this.connection.define(this.modelName || this.constructor.name, structure, {
            tableName: (0, lodash_1.snakeCase)(this.modelName || this.constructor.name),
            // Other model options go here
        });
    }
    whereColIsNull(column) {
        this.whereRaw(`${column} is null`);
        return this;
    }
    whereColIn(column, values) {
        this.updateWhereClauses(sequelize_1.Op.and, {
            [column]: {
                [sequelize_1.Op.in]: values
            }
        });
        this.whereRaw(`${column} is null`);
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
    //    Writing
    async save() {
        let props = this.getPropertyTypes(this);
        Object.keys(props).map(key => {
            if (this[key])
                props[key] = this[key];
            else
                delete props[key];
        });
        return (await this.init().create(props));
    }
    async truncate() {
        return (await this.init().destroy({
            truncate: true
        }));
    }
    async delete() {
        return (await this.init().destroy({
            where: this.whereClauses
        }));
    }
    async update(data) {
        return (await this.init().update(data, {
            where: this.whereClauses
        }));
    }
    async create(data) {
        return (await this.init().create(data));
    }
    async createBulk(data) {
        return await this.init().bulkCreate(data);
    }
}
exports.default = Model;
