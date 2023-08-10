"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const sequelize_1 = require("sequelize");
const lodash_1 = require("lodash");
const error_1 = require("@avanda/error");
const utils_1 = require("sequelize/lib/utils");
const app_1 = require("@avanda/app");
const moment_1 = __importDefault(require("moment"));
const transaction_1 = __importDefault(require("./transaction"));
// Sequelize.where()
class Model {
    constructor() {
        this.columns = [];
        this.currentPage = 1;
        this.totalPages = 1;
        this.perPage = 10;
        this.totalRows = 0;
        this.totalRecords = 0;
        this.orders = [];
        this.tempClauses = [];
        this.nextedWhereDone = false;
        this.tempTarget = "where";
        this.bindData = {};
    }
    static setConnection(connection) {
        Model.connection = connection;
        Model.logging = (sql) => app_1.Env.get("DB_LOG") ? console.log(sql) : false;
    }
    // constructor() {
    //   if (!Model.connection) {
    //     throw new Error("Model.setConnection not called");
    //   }
    // }
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
        properties.forEach((prop) => {
            let options = prop.options;
            options.dataType.value = this[prop.name];
            result[prop.name] = options;
        });
        return result;
    }
    withTransaction(transaction) {
        this.transaction = transaction;
        return this;
    }
    // query builder wrapper start here
    select(...columns) {
        if (columns.length == 1 && columns[0] == "")
            return this;
        this.tempSelectColumn = columns[columns.length - 1];
        this.columns = [...this.columns, ...columns];
        // console.log({selecting: this.columns})
        return this;
    }
    bind(data) {
        this.bindData = data;
        return this;
    }
    // public sum(column: ColumnNames<this>){
    //     this.tempSelectColumn = fn('SUM', col(column as string))
    //     return this;
    // }
    as(alias) {
        if (!this.tempSelectColumn)
            throw new error_1.runtimeError(`'You haven't specified the expression to assign alias for`);
        this.columns.pop();
        this.columns.push([this.tempSelectColumn, alias]);
        this.tempSelectColumn = null;
        return this;
    }
    where(condition) {
        return this._where(condition, sequelize_1.Op.and);
    }
    sqWhere(clauses) {
        this.whereClauses = clauses;
        return this;
        // this.sequelize?.where()
    }
    having(condition) {
        return this._where(condition, sequelize_1.Op.and, true, "having");
    }
    static async rawQuery(query, binds) {
        let sequelize = await Model.connection;
        return await sequelize.query(query, {
            replacements: binds,
            type: sequelize_1.QueryTypes.SELECT,
        });
    }
    whereRaw(condition, target = "where") {
        return this._where(condition, sequelize_1.Op.and, true, target);
    }
    orWhere(condition) {
        return this._where(condition, sequelize_1.Op.or);
    }
    closeQuery() {
        if (this.logicalOp &&
            this.nextedWhereDone &&
            this.whereClauses &&
            this.tempClauses) {
            console.log({
                whereClauses: JSON.stringify(this.whereClauses),
                tempClauses: JSON.stringify(this.tempClauses),
            });
            //    wrap the last one up
            this.whereClauses[this.logicalOp] = [
                ...(this.whereClauses[this.logicalOp] || []),
                this.tempClauses,
            ];
            this.nextedWhereDone = false;
            this.logicalOp = undefined;
            this.tempClauses = undefined;
            this.tempColumn = undefined;
        }
    }
    static convertRawToArray(query) {
        ///[^\w\s]/
        let operators = {
            ">": sequelize_1.Op.gt,
            "<": sequelize_1.Op.lt,
            "=": sequelize_1.Op.eq,
            not: sequelize_1.Op.not,
            is: sequelize_1.Op.is,
            "!=": sequelize_1.Op.ne,
            ">=": sequelize_1.Op.gte,
            "<=": sequelize_1.Op.lte,
            like: sequelize_1.Op.like,
            "not like": sequelize_1.Op.notLike,
        };
        let aliases = {
            null: null,
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
            ret = {
                [key]: {
                    [operators[operator]]: value in aliases ? aliases[value] : value,
                },
            };
        }
        else {
            ret = { [key]: value in aliases ? aliases[value] : value };
        }
        // console.log({ret})
        return ret;
    }
    _where(condition, operand = sequelize_1.Op.and, isRaw = false, target = "where") {
        if (condition instanceof utils_1.Fn) {
            this.updateClauses(operand, { [operand]: condition }, target);
        }
        else if (typeof condition == "function") {
            this.logicalOp = operand;
            condition(this);
            this.nextedWhereDone = true;
            this.closeQuery();
        }
        else if (typeof condition == "object") {
            this.updateClauses(operand, condition, target);
        }
        else if (typeof condition == "string" && isRaw) {
            this.updateClauses(operand, Model.convertRawToArray(condition), target);
        }
        else {
            this.tempColumn = condition;
        }
        return this;
    }
    updateClauses(operand, condition, target = "where") {
        // console.log({target})
        let constraintTarget = target == "where" ? this.whereClauses : this.havingClauses;
        if (constraintTarget &&
            operand == sequelize_1.Op.or &&
            typeof (constraintTarget === null || constraintTarget === void 0 ? void 0 : constraintTarget.hasOwnProperty(sequelize_1.Op.and))) {
            constraintTarget = {
                [operand]: [...constraintTarget[sequelize_1.Op.and]],
            };
        }
        if (!constraintTarget) {
            constraintTarget = {
                [operand]: [],
            };
        }
        if (!constraintTarget[operand])
            constraintTarget[operand] = [];
        if (this.logicalOp) {
            this.tempClauses = [...this.tempClauses, condition];
            return null;
        }
        if (!this.logicalOp && this.tempClauses) {
            condition = [condition, ...this.tempClauses];
        }
        if (!this.logicalOp) {
            constraintTarget[operand] = [
                ...constraintTarget[operand],
                condition,
            ];
        }
        if (this.logicalOp) {
            // console.log(this.tempClauses)
        }
        if (target == "where") {
            this.whereClauses = constraintTarget;
        }
        else {
            console.log("setting having");
            this.havingClauses = constraintTarget;
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
        this.whereRaw(`${this.tempColumn} > ${value}`, this.tempTarget);
        return this;
    }
    lessThan(value) {
        if (!this.tempColumn)
            throw new error_1.runtimeError("Specify column to apply greaterThan() to user the where() function");
        this.whereRaw(`${this.tempColumn} < ${value}`, this.tempTarget);
        return this;
    }
    async find(id) {
        var _a;
        this.closeQuery();
        return ((_a = (await this.queryDb("findOne", {
            id,
        }))) !== null && _a !== void 0 ? _a : null);
    }
    async findAll(id) {
        return await this.queryDb("findAll", {
            id,
        });
    }
    async queryDb(fn, where = {}, count = false) {
        var _a;
        let instance = await this.init();
        let page = this.currentPage - 1;
        let offset = this.perPage * page;
        let limit = this.perPage;
        // console.log({having: this.havingClauses})
        // console.log({columns: this.columns})
        // @ts-ignore
        let options = {
            where: Object.assign(Object.assign({}, this.whereClauses), where),
            having: this.havingClauses,
            attributes: this.columns.length > 0 ? this.columns : undefined,
            order: this.orders,
            limit,
            offset,
            bind: this.bindData,
            logging: Model.logging,
        };
        // @ts-ignore
        let result = await instance[fn](Object.assign(Object.assign({}, options), {
            group: this.group,
        }));
        //
        this.totalRows = count ? await instance.count(options) : this.perPage;
        this.totalRecords = this.totalRows;
        this.totalPages = Math.ceil(this.totalRows / this.perPage);
        return JSON.parse(JSON.stringify((_a = result === null || result === void 0 ? void 0 : result.rows) !== null && _a !== void 0 ? _a : result));
    }
    groupBy(group) {
        this.group = group;
        return this;
    }
    async count() {
        let instance = await this.init();
        let options = {
            where: Object.assign({}, this.whereClauses),
            having: this.havingClauses,
            attributes: [],
        };
        return await instance.count(options);
    }
    async findBy(col, value) {
        return await this.queryDb("findOne", {
            [col]: value,
        });
    }
    async findAllBy(col, value) {
        return await this.queryDb("findAll", {
            [col]: value,
        });
    }
    async first() {
        var _a;
        this.closeQuery();
        this.orders.push(["id", "ASC"]);
        return (_a = (await this.queryDb("findOne"))) !== null && _a !== void 0 ? _a : null;
    }
    async last() {
        var _a;
        this.closeQuery();
        this.orders.push(["id", "DESC"]);
        return (_a = (await this.queryDb("findOne"))) !== null && _a !== void 0 ? _a : null;
    }
    orderBy(column, order = "DESC") {
        this.orders.push((0, sequelize_1.literal)(`${column} ${order}`));
        return this;
    }
    async all() {
        var _a;
        this.closeQuery();
        return (_a = (await this.queryDb("findAll"))) !== null && _a !== void 0 ? _a : [];
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
        this.sequelize = await Model.connection;
        let structure = {};
        let indexes = [];
        let props = this.getPropertyTypes(this);
        for (let prop in props) {
            let value = props[prop];
            let type = (_a = value === null || value === void 0 ? void 0 : value.dataType) === null || _a === void 0 ? void 0 : _a.getType();
            if (!type)
                continue;
            if (value.references && typeof value.references != "string")
                value.references.sequelize = this.sequelize;
            // push index
            if (typeof value.index == "boolean") {
                indexes.push({
                    fields: [prop],
                });
            }
            else if (typeof value.index != "undefined") {
                indexes.push(Object.assign(Object.assign(Object.assign(Object.assign(Object.assign({}, (value.index.use && { using: value.index.use })), { fields: [
                        prop,
                        ...(typeof value.index.with != "undefined" ? value.index.with : []),
                    ] }), (value.index.name && { name: value.index.name })), (value.index.type && { type: value.index.type })), (value.index.where && { where: value.index.where })));
            }
            structure[prop] = Object.assign(Object.assign(Object.assign(Object.assign(Object.assign({ type, unique: value.unique ? value.unique : undefined, comment: value.comment, defaultValue: (_b = value === null || value === void 0 ? void 0 : value.dataType) === null || _b === void 0 ? void 0 : _b.value, allowNull: typeof value.nullable == "undefined" ? false : value.nullable }, (value.onDeleted && { onDelete: value.onDeleted })), (value.onUpdated && { onUpdated: value.onUpdated })), (value.references && {
                references: {
                    model: typeof value.references == "string"
                        ? value.references
                        : await ((_c = value.references) === null || _c === void 0 ? void 0 : _c.init()),
                    key: "id",
                },
            })), (((_d = value === null || value === void 0 ? void 0 : value.dataType) === null || _d === void 0 ? void 0 : _d.getter) && {
                get() {
                    var _a, _b;
                    const rawValue = this.getDataValue(prop);
                    return (_b = (_a = value === null || value === void 0 ? void 0 : value.dataType) === null || _a === void 0 ? void 0 : _a.getter) === null || _b === void 0 ? void 0 : _b.call(_a, rawValue);
                },
            })), (((_e = value === null || value === void 0 ? void 0 : value.dataType) === null || _e === void 0 ? void 0 : _e.setter) && {
                async set(val) {
                    var _a, _b;
                    let newValue = await ((_b = (_a = value === null || value === void 0 ? void 0 : value.dataType) === null || _a === void 0 ? void 0 : _a.setter) === null || _b === void 0 ? void 0 : _b.call(_a, val));
                    this.setDataValue("password", newValue);
                },
            }));
        }
        // console.log(structure)
        if (!this.sequelize)
            this.sequelize = new sequelize_1.Sequelize();
        let that = this;
        return this.sequelize.define(this.modelName || this.constructor.name, structure, {
            tableName: (0, lodash_1.snakeCase)(this.modelName || this.constructor.name),
            omitNull: false,
            paranoid: true,
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
                },
            },
            indexes,
            // Other model options go here
        });
    }
    whereColIsNull(column) {
        this.whereRaw(`${column} is null`);
        return this;
    }
    whereNotUpdatedSince(count, unit = "days", dateCol = "updatedAt") {
        this.updateClauses(sequelize_1.Op.and, {
            [dateCol]: {
                [sequelize_1.Op.or]: {
                    [sequelize_1.Op.lt]: (0, moment_1.default)().subtract(count, unit).toDate(),
                    [sequelize_1.Op.eq]: null,
                },
            },
        });
        return this;
    }
    whereHasExpired() {
        this.updateClauses(sequelize_1.Op.and, {
            ["expiresOn"]: {
                [sequelize_1.Op.lte]: new Date(),
            },
        });
        return this;
    }
    whereHasNotExpired() {
        this.updateClauses(sequelize_1.Op.and, {
            ["expiresOn"]: {
                [sequelize_1.Op.gt]: new Date(),
            },
        });
        return this;
    }
    whereNotCreatedSince(count, unit = "days") {
        this.updateClauses(sequelize_1.Op.and, {
            ["createdAt"]: {
                [sequelize_1.Op.lte]: sequelize_1.Sequelize.literal(`(NOW() - INTERVAL ${count} ${unit === null || unit === void 0 ? void 0 : unit.toUpperCase()})`),
            },
        });
        return this;
    }
    whereCreatedSince(count, unit = "days") {
        this.updateClauses(sequelize_1.Op.and, {
            ["createdAt"]: {
                [sequelize_1.Op.gt]: (0, moment_1.default)().add(count, unit).toDate(),
            },
        });
        return this;
    }
    whereColIn(column, values) {
        this.updateClauses(sequelize_1.Op.and, {
            [column]: {
                [sequelize_1.Op.in]: values,
            },
        });
        return this;
    }
    whereColNotIn(column, values) {
        this.updateClauses(sequelize_1.Op.and, {
            [column]: {
                [sequelize_1.Op.notIn]: values,
            },
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
        Object.keys(props).map((key) => {
            if (this[key])
                props[key] = this[key];
            else
                delete props[key];
        });
        return props;
    }
    //    Writing
    async save() {
        await this.loadTransaction();
        return await (await this.init()).create(this.getOnlyPropsFromInstance(), Object.assign({}, (this.transaction && { transaction: this.transaction.transaction })));
    }
    async loadTransaction() {
        if (this.transaction instanceof transaction_1.default &&
            !this.transaction.transaction) {
            let sequelize = await Model.connection;
            this.transaction.transaction = await sequelize.transaction({});
        }
    }
    async truncate() {
        await this.loadTransaction();
        return await (await this.init()).destroy(Object.assign({ truncate: true }, (this.transaction && { transaction: this.transaction.transaction })));
    }
    async delete() {
        await this.loadTransaction();
        return await (await this.init()).destroy(Object.assign({ where: this.whereClauses, force: true }, (this.transaction && { transaction: this.transaction.transaction })));
    }
    async softDelete() {
        await this.loadTransaction();
        return await (await this.init()).destroy(Object.assign({ where: this.whereClauses }, (this.transaction && { transaction: this.transaction.transaction })));
    }
    async update(data) {
        await this.loadTransaction();
        return (await (await this.init()).update(data, Object.assign({ where: this.whereClauses }, (this.transaction && { transaction: this.transaction.transaction }))));
    }
    async increment(column, by = 1) {
        await this.loadTransaction();
        return await (await this.init()).increment({ [column]: by }, Object.assign({ where: this.whereClauses }, (this.transaction && { transaction: this.transaction.transaction })));
    }
    async decrement(column, by = 1) {
        await this.loadTransaction();
        return await (await this.init()).increment({ [column]: -by }, Object.assign({ where: this.whereClauses }, (this.transaction && { transaction: this.transaction.transaction })));
    }
    async page(num, count = true) {
        var _a;
        this.currentPage = num;
        this.closeQuery();
        return (_a = (await this.queryDb("findAll", {}, count))) !== null && _a !== void 0 ? _a : [];
    }
    async create(data) {
        await this.loadTransaction();
        let created = await (await this.init()).create(data, Object.assign({}, (this.transaction && { transaction: this.transaction.transaction })));
        return created;
    }
    async createBulk(data) {
        await this.loadTransaction();
        return await (await this.init()).bulkCreate(data, Object.assign({}, (this.transaction && { transaction: this.transaction.transaction })));
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
