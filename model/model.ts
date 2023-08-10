import {
  DataTypes,
  literal,
  Model as SeqModel,
  ModelAttributes,
  Op,
  QueryTypes,
  Sequelize,
  Transaction,
  WhereOptions
} from "sequelize";
import { ModelIndexesOptions, ModelStatic } from "sequelize/types/model";
import { isObject, snakeCase } from "lodash";
import ColumnOptions from "../types/ColumnOptions";
import ModelShape from "../types/ModelShape";
import WhereClause from "../types/WhereClause";
import { runtimeError } from "@avanda/error";
import { Fn } from "sequelize/lib/utils";
import { Connection, dbConfig, Env } from "@avanda/app";
import moment from "moment";
import ColumnNames from "../types/ColumnNames";
import DataOf from "../types/DataOf";
import { Literal } from "sequelize/lib/utils";
import ModelTransaction from "./transaction";
import { where } from "sequelize";

// type Fn = typeof fn;

/*
 * I know i should have a seperate class for query to make building query easier and more nestable,
 * I think that's a future
 * */

interface Datum {
  [k: string]: any;
}


// Sequelize.where()

export default class Model {
  static connection?: Promise<Sequelize>;
  protected sequelize?: Sequelize;
  private modelName?: string;

  protected whereClauses?: WhereClause;
  protected havingClauses?: WhereClause;
  protected columns?: Array<string | [Fn | string, string]> = [];
  protected group?: Array<string> | string;
  protected currentPage: number = 1;
  protected totalPages: number = 1;
  protected perPage: number = 10;
  protected totalRows: number = 0;
  protected totalRecords: number = 0;

  protected orders: ([string, string] | string | Literal)[] = [];
  protected tempClauses?: WhereClause[] = [];
  protected logicalOp?: symbol;
  protected nextedWhereDone: boolean = false;
  protected tempColumn?: string;
  protected tempTarget?: "having" | "where" = "where";
  protected tempSelectColumn?: string | Fn | Literal;
  protected transaction: ModelTransaction;
  protected bindData: Datum = {};
  private initInstance?: ModelStatic<any>;
  private static logging: boolean | ((q: any) => void);

  static setConnection(connection: Promise<Sequelize>) {
    Model.connection = connection;
    Model.logging = (sql) =>
      Env.get<string>("DB_LOG") ? console.log(sql) : false;
  }

  // constructor() {
  //   if (!Model.connection) {
  //     throw new Error("Model.setConnection not called");
  //   }
  // }

  setPerPage(perPage: number): this {
    this.perPage = perPage;
    return this;
  }

  setModelName(value: string) {
    this.modelName = value;
  }

  private getPropertyTypes(origin: object): ModelShape<any> {
    const properties: { options: ColumnOptions<unknown>; name: string }[] =
      Reflect.getMetadata(origin.constructor.name, origin);
    const result = {};
    properties.forEach((prop) => {
      let options = prop.options;
      options.dataType.value = this[prop.name];
      result[prop.name] = options;
    });
    return result;
  }

  public withTransaction(transaction: ModelTransaction): this {
    this.transaction = transaction;
    return this;
  }

  // query builder wrapper start here

  public select(...columns: ColumnNames<this>[] | string[] | Fn[] | Literal[]) {
    if (columns.length == 1 && columns[0] == "") return this;

    this.tempSelectColumn = (columns as string[])[columns.length - 1];
    this.columns = [...this.columns, ...(columns as string[])];

    // console.log({selecting: this.columns})

    return this;
  }

  public bind(data: Datum) {
    this.bindData = data;
    return this;
  }

  // public sum(column: ColumnNames<this>){
  //     this.tempSelectColumn = fn('SUM', col(column as string))
  //     return this;
  // }

  public as(alias: string) {
    if (!this.tempSelectColumn)
      throw new runtimeError(
        `'You haven't specified the expression to assign alias for`
      );
    this.columns.pop();
    this.columns.push([this.tempSelectColumn, alias]);
    this.tempSelectColumn = null;
    return this;
  }

  public where(
    condition: DataOf<this> | ColumnNames<this> | ((model: this) => void)
  ) {
    return this._where(condition, Op.and);
  }


  public sqWhere(clauses: WhereOptions){
    this.whereClauses = clauses;

    return this;
    // this.sequelize?.where()
  }



  public having(
    condition:
      | DataOf<this>
      | ColumnNames<this>
      | ((model: this) => void)
      | Fn
      | Fn[]
  ) {
    return this._where(condition, Op.and, true, "having");
  }

  public static async rawQuery(
    query: string,
    binds: { [key: string]: unknown } | unknown[]
  ) {
    let sequelize = await Model.connection;
    return await sequelize.query(query, {
      replacements: binds,
      type: QueryTypes.SELECT,
    });
  }

  public whereRaw(condition: string, target: "where" | "having" = "where") {
    return this._where(condition, Op.and, true, target);
  }

  public orWhere(
    condition: DataOf<this> | ColumnNames<this> | ((model: this) => void)
  ) {
    return this._where(condition, Op.or);
  }

  private closeQuery() {
    if (
      this.logicalOp &&
      this.nextedWhereDone &&
      this.whereClauses &&
      this.tempClauses
    ) {
      console.log({
        whereClauses: JSON.stringify(this.whereClauses),
        tempClauses: JSON.stringify(this.tempClauses),
      });
      //    wrap the last one up
      this.whereClauses[this.logicalOp as unknown as string] = [
        ...(this.whereClauses[this.logicalOp as unknown as string] || []),
        this.tempClauses,
      ];
      this.nextedWhereDone = false;
      this.logicalOp = undefined;
      this.tempClauses = undefined;
      this.tempColumn = undefined;
    }
  }

  private static convertRawToArray(query: string): WhereClause {
    ///[^\w\s]/
    let operators = {
      ">": Op.gt,
      "<": Op.lt,
      "=": Op.eq,
      not: Op.not,
      is: Op.is,
      "!=": Op.ne,
      ">=": Op.gte,
      "<=": Op.lte,
      like: Op.like,
      "not like": Op.notLike,
    };

    let aliases: { [key: string]: any } = {
      null: null,
    };

    let tokens = /(\w+)\s+([^\w\s]+|not|is|LIKE|NOT\s+LIKE)\s+(.+)/i.exec(
      query
    );

    if (!tokens) return {};

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
    } else {
      ret = { [key]: value in aliases ? aliases[value] : value };
    }
    // console.log({ret})
    return ret;
  }

  private _where(
    condition:
      | DataOf<this>
      | ColumnNames<this>
      | string
      | ((model: this) => void)
      | Fn
      | Fn[],
    operand: symbol = Op.and,
    isRaw: boolean = false,
    target: "where" | "having" = "where"
  ) {
    if (condition instanceof Fn) {
      this.updateClauses(operand, { [operand]: condition }, target);
    } else if (typeof condition == "function") {
      this.logicalOp = operand;
      condition(this);
      this.nextedWhereDone = true;
      this.closeQuery();
    } else if (typeof condition == "object") {
      this.updateClauses(operand, condition, target);
    } else if (typeof condition == "string" && isRaw) {
      this.updateClauses(operand, Model.convertRawToArray(condition), target);
    } else {
      this.tempColumn = condition as string;
    }
    return this;
  }
  private updateClauses(
    operand: symbol,
    condition: DataOf<this> | ((model: this) => void) | WhereClause | Fn,
    target: "where" | "having" = "where"
  ) {
    // console.log({target})
    let constraintTarget =
      target == "where" ? this.whereClauses : this.havingClauses;

    if (
      constraintTarget &&
      operand == Op.or &&
      typeof constraintTarget?.hasOwnProperty(Op.and)
    ) {
      constraintTarget = {
        [operand]: [...constraintTarget[Op.and as unknown as string]],
      };
    }

    if (!constraintTarget) {
      constraintTarget = {
        [operand]: [],
      };
    }

    if (!constraintTarget[operand as unknown as string])
      constraintTarget[operand as unknown as string] = [];

    if (this.logicalOp) {
      this.tempClauses = [...this.tempClauses, condition];
      return null;
    }

    if (!this.logicalOp && this.tempClauses) {
      condition = [condition, ...this.tempClauses];
    }

    if (!this.logicalOp) {
      constraintTarget[operand as unknown as string] = [
        ...constraintTarget[operand as unknown as string],
        condition,
      ];
    }

    if (this.logicalOp) {
      // console.log(this.tempClauses)
    }

    if (target == "where") {
      this.whereClauses = constraintTarget;
    } else {
      console.log("setting having");
      this.havingClauses = constraintTarget;
    }
    return condition;
  }

  ofId(id: number): this {
    // @ts-ignore
    this.where({ id });
    return this;
  }

  ofUserId(id: number): this {
    // @ts-ignore
    this.where({ user_id: id });
    return this;
  }

  greaterThan(value: number) {
    if (!this.tempColumn)
      throw new runtimeError(
        "Specify column to apply greaterThan() to user the where() function"
      );

    this.whereRaw(`${this.tempColumn} > ${value}`, this.tempTarget);

    return this;
  }
  lessThan(value: number) {
    if (!this.tempColumn)
      throw new runtimeError(
        "Specify column to apply greaterThan() to user the where() function"
      );

    this.whereRaw(`${this.tempColumn} < ${value}`, this.tempTarget);
    return this;
  }

  async find(id: number): Promise<DataOf<this> | null> {
    this.closeQuery();
    return (
      (await this.queryDb<DataOf<this>>("findOne", {
        id,
      })) ?? null
    );
  }

  async findAll(id: number): Promise<DataOf<this>[]> {
    return await this.queryDb<DataOf<this>[]>("findAll", {
      id,
    });
  }

  private async queryDb<ReturnType>(
    fn: "findOne" | "findAll" | "findAndCountAll",
    where: WhereClause = {},
    count: boolean = false
  ): Promise<ReturnType> {
    let instance = await this.init();

    let page = this.currentPage - 1;

    let offset = this.perPage * page;
    let limit = this.perPage;
    // console.log({having: this.havingClauses})
    // console.log({columns: this.columns})

    // @ts-ignore
    let options = {
      where: {
        ...this.whereClauses,
        ...where,
      },
      having: this.havingClauses,
      attributes: this.columns.length > 0 ? this.columns : undefined,
      order: this.orders,
      limit,
      offset,
      bind: this.bindData,
      logging: Model.logging,
    };
    // @ts-ignore
    let result = await instance[fn]({
      ...options,
      ...{
        group: this.group,
      },
    });
    //
    this.totalRows = count ? await instance.count(options) : this.perPage;
    this.totalRecords = this.totalRows;

    this.totalPages = Math.ceil(this.totalRows / this.perPage);

    return JSON.parse(JSON.stringify(result?.rows ?? result));
  }

  groupBy(group: string | string[]): this {
    this.group = group;
    return this;
  }

  async count(): Promise<number> {
    let instance = await this.init();
    let options = {
      where: {
        ...this.whereClauses,
      },
      having: this.havingClauses,
      attributes: [],
    };
    return await instance.count(options);
  }

  async findBy(col: string, value: any): Promise<DataOf<this>> {
    return await this.queryDb<DataOf<this>>("findOne", {
      [col]: value,
    });
  }

  async findAllBy(col: string, value: any): Promise<DataOf<this>[]> {
    return await this.queryDb<DataOf<this>[]>("findAll", {
      [col]: value,
    });
  }

  async first(): Promise<DataOf<this> | null> {
    this.closeQuery();
    this.orders.push(["id", "ASC"]);
    return (await this.queryDb<DataOf<this>>("findOne")) ?? null;
  }

  async last() {
    this.closeQuery();
    this.orders.push(["id", "DESC"]);
    return (await this.queryDb<DataOf<this>>("findOne")) ?? null;
  }

  orderBy(column: ColumnNames<this>, order: "DESC" | "ASC" = "DESC") {
    this.orders.push(literal(`${column as string} ${order}`));
    return this;
  }

  public async all(): Promise<DataOf<this>[]> {
    this.closeQuery();
    return (await this.queryDb<DataOf<this>[]>("findAll")) ?? [];
  }

  // query builder wrapper ends here

  public async init(): Promise<ModelStatic<any>> {
    if (this.initInstance) return this.initInstance;

    this.initInstance = await this.convertToSequelize();

    return this.initInstance;
  }

  private async convertToSequelize(): Promise<ModelStatic<any>> {
    this.sequelize = await Model.connection;
    let structure: ModelAttributes<SeqModel> = {};
    let indexes: ModelIndexesOptions[] = [];

    let props = this.getPropertyTypes(this);

    for (let prop in props) {
      let value = props[prop];
      let type = value?.dataType?.getType();

      if (!type) continue;

      if (value.references && typeof value.references != "string")
        value.references.sequelize = this.sequelize;

      // push index
      if (typeof value.index == "boolean") {
        indexes.push({
          fields: [prop],
        });
      } else if (typeof value.index != "undefined") {
        indexes.push({
          ...(value.index.use && { using: value.index.use }),
          fields: [
            prop,
            ...(typeof value.index.with != "undefined" ? value.index.with : []),
          ],
          ...(value.index.name && { name: value.index.name }),
          ...(value.index.type && { type: value.index.type }),
          ...(value.index.where && { where: value.index.where }),
        });
      }

      structure[prop] = {
        type,
        unique: value.unique ? value.unique : undefined,
        comment: value.comment,
        defaultValue: value?.dataType?.value,
        allowNull:
          typeof value.nullable == "undefined" ? false : value.nullable,
        ...(value.onDeleted && { onDelete: value.onDeleted }),
        ...(value.onUpdated && { onUpdated: value.onUpdated }),
        ...(value.references && {
          references: {
            model:
              typeof value.references == "string"
                ? value.references
                : await value.references?.init(),
            key: "id",
          },
        }),
        ...(value?.dataType?.getter && {
          get() {
            const rawValue = this.getDataValue(prop);
            return value?.dataType?.getter?.(rawValue);
          },
        }),
        ...(value?.dataType?.setter && {
          async set(val) {
            let newValue = await value?.dataType?.setter?.(val);
            this.setDataValue("password", newValue);
          },
        }),
      };
    }

    // console.log(structure)

    if (!this.sequelize) this.sequelize = new Sequelize();

    let that = this;

    return this.sequelize.define(
      this.modelName || this.constructor.name,
      structure,
      {
        tableName: snakeCase(this.modelName || this.constructor.name),
        omitNull: false,
        paranoid: true,
        hooks: {
          beforeCreate: async (model) => {
            let gl = await this.override(this.getOnlyPropsFromInstance());
            let newData = await this.overrideInsert(
              this.getOnlyPropsFromInstance()
            );
            model.set({ ...gl, ...newData });
          },
          beforeUpdate: async (model) => {
            let gl = await this.override(this.getOnlyPropsFromInstance());
            let newData = await this.overrideUpdate(
              this.getOnlyPropsFromInstance()
            );
            model.set({ ...gl, ...newData });
          },
          
        },
        indexes,
        // Other model options go here
      }
    );
  }

  whereColIsNull<T>(column: ColumnNames<this> | T) {
    this.whereRaw(`${column} is null`);
    return this;
  }

  whereNotUpdatedSince(
    count: number,
    unit: "days" | "hours" | "minutes" | "months" | "years" = "days",
    dateCol: string = "updatedAt"
  ) {
    this.updateClauses(Op.and, {
      [dateCol]: {
        [Op.or]: {
          [Op.lt]: moment().subtract(count, unit).toDate(),
          [Op.eq]: null,
        },
      },
    });
    return this;
  }

  whereHasExpired() {
    this.updateClauses(Op.and, {
      ["expiresOn"]: {
        [Op.lte]: new Date(),
      },
    });
    return this;
  }
  whereHasNotExpired() {
    this.updateClauses(Op.and, {
      ["expiresOn"]: {
        [Op.gt]: new Date(),
      },
    });
    return this;
  }

  whereNotCreatedSince(
    count: number,
    unit: "days" | "hours" | "minutes" | "months" | "years" = "days"
  ) {
    this.updateClauses(Op.and, {
      ["createdAt"]: {
        [Op.lte]: Sequelize.literal(
          `(NOW() - INTERVAL ${count} ${unit?.toUpperCase()})`
        ),
      },
    });
    return this;
  }

  whereCreatedSince(
    count: number,
    unit: "days" | "hours" | "minutes" | "months" | "years" = "days"
  ) {
    this.updateClauses(Op.and, {
      ["createdAt"]: {
        [Op.gt]: moment().add(count, unit).toDate(),
      },
    });
    return this;
  }

  whereColIn(column: ColumnNames<this>, values: any[]) {
    this.updateClauses(Op.and, {
      [column as string]: {
        [Op.in]: values,
      },
    });
    return this;
  }

  whereColNotIn(column: ColumnNames<this>, values: any[]) {
    this.updateClauses(Op.and, {
      [column as string]: {
        [Op.notIn]: values,
      },
    });
    return this;
  }

  whereColIsNotNull<T>(column: ColumnNames<this> | T) {
    this.whereRaw(`${column} not null`);
    return this;
  }

  whereColumns(...column: string[]) {
    return this;
  }

  matches(value: string) {
    return this;
  }

  like(keyword: string) {
    if (!this.tempColumn)
      throw new runtimeError(`Chain like() method with where(column: string)`);

    this.whereRaw(`${this.tempColumn} like ${keyword}`);

    return this;
  }

  notLike(keyword: string) {
    if (!this.tempColumn)
      throw new runtimeError(
        `Chain notLike() method with where(column: string)`
      );

    this.whereRaw(`${this.tempColumn} not like ${keyword}`);

    return this;
  }

  private getOnlyPropsFromInstance(): DataOf<this> {
    let props = this.getPropertyTypes(this);
    Object.keys(props).map((key) => {
      if (this[key]) props[key] = this[key];
      else delete props[key];
    });

    return props as unknown as DataOf<this>;
  }

  //    Writing
  public async save(): Promise<DataOf<this>> {
    await this.loadTransaction();
    return await (
      await this.init()
    ).create(this.getOnlyPropsFromInstance(), {
      ...(this.transaction && { transaction: this.transaction.transaction }),
    });
  }

  private async loadTransaction() {
    if (
      this.transaction instanceof ModelTransaction &&
      !this.transaction.transaction
    ) {
      let sequelize = await Model.connection;
      this.transaction.transaction = await sequelize.transaction({
        
      });
    }
  }

  public async truncate() {
    await this.loadTransaction();
    return await (
      await this.init()
    ).destroy({
      truncate: true,
      ...(this.transaction && { transaction: this.transaction.transaction }),
    });
  }

  public async delete() {
    await this.loadTransaction();
    return await (
      await this.init()
    ).destroy({
      where: this.whereClauses,
      force: true,
      ...(this.transaction && { transaction: this.transaction.transaction }),
    });
  }


  public async softDelete() {
    await this.loadTransaction();
    return await (
      await this.init()
    ).destroy({
      where: this.whereClauses,
      ...(this.transaction && { transaction: this.transaction.transaction }),
    });
  }

  public async update(data: DataOf<this>): Promise<DataOf<this>> {
    await this.loadTransaction();
    return (await (
      await this.init()
    ).update(data, {
      where: this.whereClauses,
      ...(this.transaction && { transaction: this.transaction.transaction }),
    })) as unknown as Promise<DataOf<this>>;
  }

  public async increment<T>(column: ColumnNames<this> | T, by: number = 1) {
    await this.loadTransaction();
    return await (
      await this.init()
    ).increment(
      { [column as string]: by },
      {
        where: this.whereClauses,
        ...(this.transaction && { transaction: this.transaction.transaction }),
      }
    );
  }

  public async decrement<T>(column: ColumnNames<this> | T, by: number = 1) {
    await this.loadTransaction();
    return await (
      await this.init()
    ).increment(
      { [column as string]: -by },
      {
        where: this.whereClauses,
        ...(this.transaction && { transaction: this.transaction.transaction }),
      }
    );
  }

  public async page(
    num: number,
    count: boolean = true
  ): Promise<DataOf<this>[]> {
    this.currentPage = num;
    this.closeQuery();
    return (await this.queryDb<DataOf<this>[]>("findAll", {}, count)) ?? [];
  }

  public async create(data: DataOf<this>): Promise<DataOf<this>> {
    await this.loadTransaction();
    let created = await (
      await this.init()
    ).create(data, {
      ...(this.transaction && { transaction: this.transaction.transaction }),
    });



    return created
  }

  public async createBulk(data: DataOf<this>[]): Promise<DataOf<this>[]> {
    await this.loadTransaction();
    return await (
      await this.init()
    ).bulkCreate(data, {
      ...(this.transaction && { transaction: this.transaction.transaction }),
    });
  }

  protected overrideInsert(data: DataOf<this>) {
    return {};
  }
  protected overrideUpdate(data: DataOf<this>) {
    return {};
  }
  protected async override(data: DataOf<this>) {
    return {};
  }
}
