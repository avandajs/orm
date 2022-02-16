import {Model as SeqModel, ModelAttributes, ModelCtor, Op, Sequelize, fn, col} from "sequelize";
import {snakeCase} from "lodash"
import ColumnOptions from "../types/ColumnOptions";
import ModelShape from "../types/ModelShape";
import WhereClause from "../types/WhereClause";
import {runtimeError} from "@avanda/error";
import {Fn} from "sequelize/types/utils";
import {Connection,Env} from "@avanda/app"
import moment from 'moment'
import ColumnNames from "../types/ColumnNames";
import DataOf from "../types/DataOf";



/*
* I know i should have a seperate class for query to make building query easier and more nestable,
* I think that's a future
* */

export default abstract class Model{

    protected connection?: Promise<Sequelize>
    protected sequelize?: Sequelize
    private modelName?: string

    protected whereClauses?: WhereClause;
    protected columns?: Array<string|[Fn|string,string]>;
    protected currentPage: number = 1;
    protected totalPages: number = 1;
    protected perPage: number = 10;
    protected totalRows: number = 0;
    protected totalRecords: number = 0;


    protected orders: [string,string][] = [];
    protected tempClauses?: WhereClause;
    protected logicalOp?: symbol
    protected nextedWhereDone: boolean = false
    protected tempColumn?: string
    protected tempSelectColumn?: string | Fn

    private initInstance?: ModelCtor<any>

    constructor() {
        this.connection = Connection({
            dbDialect: Env.get<'mysql' | 'mariadb' | 'postgres' | 'mssql'>('DB_DRIVER','mysql'),
            dbName: Env.get<string>('DB_NAME'),
            dbPassword: Env.get<string>('DB_PASSWORD'),
            dbUser: Env.get<string>('DB_USER','root')
        })
    }

    setPerPage(perPage: number): this {
        this.perPage = perPage;
        return this;
    }

    setModelName(value: string) {
        this.modelName = value;
    }

    private getPropertyTypes(origin: object): ModelShape<any> {

        const properties: { options: ColumnOptions<unknown>,name: string }[] = Reflect.getMetadata(origin.constructor.name, origin);
        const result = {};
        properties.forEach(prop => {
            let options = prop.options
            options.dataType.value = this[prop.name]
            result[prop.name] = options
        });
        return result;
    }

    // query builder wrapper start here

    public select(...columns: ColumnNames<this>[] | string[]){


        if (columns.length == 1 && columns[0] == "")
            return this;

        this.tempSelectColumn = (columns as string[])[columns.length - 1]
        this.columns = (columns as string[])

        return this;
    }

    public sum(column: ColumnNames<this>){
        this.tempSelectColumn = fn('SUM', col(column as string))
        return this;
    }



    public as(alias: string){
        if (!this.tempSelectColumn)
            throw new runtimeError(`'You haven't specified the expression to assign alias for`)
        this.columns.push([this.tempSelectColumn,alias])
        return this;
    }

    public where(condition: DataOf<this> | ColumnNames<this> | ((model: this) => void)){
        return this._where(condition,
            Op.and)
    }

    public whereRaw(condition: string){
        return this._where(
            condition,
            Op.and,
            true
        )
    }

    public orWhere(condition: DataOf<this> | ColumnNames<this> | ((model: this) => void)){
        return this._where(condition, Op.or)
    }

    private closeQuery(){
        if (this.logicalOp && this.nextedWhereDone && this.whereClauses && this.tempClauses){
            //    wrap the last one up
            this.whereClauses[this.logicalOp as unknown as string] = [...this.whereClauses[this.logicalOp as unknown as string],this.tempClauses]
            this.nextedWhereDone = false;
            this.logicalOp = undefined
            this.tempClauses = undefined
            this.tempColumn = undefined
        }
    }

    private static convertRawToArray(query: string): WhereClause{
        ///[^\w\s]/
        let operators = {
            '>': Op.gt,
            '<': Op.lt,
            '=': Op.eq,
            'not': Op.not,
            'is': Op.is,
            '!=': Op.ne,
            '>=': Op.gte,
            '<=': Op.lte,
            'like': Op.like,
            'not like': Op.notLike,
        }

        let aliases: {[key: string]: any} = {
            'null':  null
        }

        let tokens = /(\w+)\s+([^\w\s]+|not|is|LIKE|NOT\s+LIKE)\s+(.+)/i.exec(query)

        if (!tokens)
            return {}

            // console.log({tokens})

        let operator = tokens[2]
        let key = tokens[1];
        let value = tokens[3];
        let ret = {}
        if(operator in operators){
            ret = {[key]: {[operators[operator]]: value in aliases  ? aliases[value]:value}}
        }else{
            ret = {[key]: value in aliases  ? aliases[value] : value}
        }
        // console.log({ret})
        return ret;
    }

    private _where(
        condition: DataOf<this> | ColumnNames<this> | string | ((model: this) => void),
        operand: symbol = Op.and,
        isRaw: boolean = false
    ){
        this.closeQuery();
        if (typeof condition == 'function'){
            this.logicalOp = operand
            condition(this)
            this.nextedWhereDone = true
        }else if (typeof condition == 'object'){
            this.updateWhereClauses(operand, condition);
        }else if (typeof condition == 'string' && isRaw){
            this.updateWhereClauses(operand, Model.convertRawToArray(condition));
        }else{
            this.tempColumn = condition as string
        }
        return this;
    }

    private updateWhereClauses(
        operand: symbol,
        condition: DataOf<this>  | ((model: this) => void) | WhereClause
    ) {
        if (this.whereClauses && operand == Op.or && typeof this.whereClauses?.hasOwnProperty(Op.and)) {
            this.whereClauses = {
                [operand]: [...this.whereClauses[Op.and as unknown as string]]
            }
        }

        if (!this.whereClauses) {
            this.whereClauses = {
                [operand]: []
            }
        }

        if (!this.whereClauses[operand as unknown as string])
            this.whereClauses[operand as unknown as string] = []


        if (this.logicalOp) {
            this.tempClauses = {...this.tempClauses, ...condition}
            return null
        }

        if (!this.logicalOp && this.tempClauses) {
            condition = {...condition, ...this.tempClauses}
        }

        if (!this.logicalOp) {
            this.whereClauses[operand as unknown as string] = [...this.whereClauses[operand as unknown as string], condition]
        }

        if (this.logicalOp) {
            // console.log(this.tempClauses)
        }
        return condition;
    }

    ofId(id: number): this{
        // @ts-ignore
        this.where({id})
        return this
    }

    ofUserId(id: number): this{
        // @ts-ignore
        this.where({user_id: id})
        return this
    }

    greaterThan(value: number){
        if (!this.tempColumn)
            throw new runtimeError("Specify column to apply greaterThan() to user the where() function")

        this.whereRaw(`${this.tempColumn} > ${value}`)

        return this;
    }

    async find(id: number): Promise<DataOf<this>|null>{
        this.closeQuery();
        return (await this.queryDb<DataOf<this>>('findOne',{
            id
        })) ?? null
    }


    async findAll(id: number): Promise<DataOf<this>[]>{
        return await this.queryDb<DataOf<this>[]>('findAll',{
            id
        })
    }

    private async queryDb<ReturnType>(fn: 'findOne' | 'findAll' | 'findAndCountAll',where: WhereClause = {},fields?: string[]): Promise<ReturnType>{
        let instance = await this.init()

        let page = this.currentPage - 1;

        let offset =  this.perPage * page;
        let limit = this.perPage;
        // @ts-ignore
        let result =  await instance[fn]({
            where: {
                ...this.whereClauses,
                ...where,
            },
            attributes: this.columns,
            order:this.orders,
            limit,
            offset
        })

        this.totalRows = result?.count ?? result?.length ?? 0

        console.log({total: this.totalRows})
        this.totalRecords = this.totalRows

        this.totalPages = Math.ceil(this.totalRows / this.perPage);

        console.log({totalPages: this.totalPages})


        return result?.rows ?? result
    }

    async findBy(col: string,value: any): Promise<DataOf<this>> {
        return await this.queryDb<DataOf<this>>('findOne',{
            [col]: value
        })
    }

    async findAllBy(col: string,value: any): Promise<DataOf<this>[]>{
        return await this.queryDb<DataOf<this>[]>('findAll',{
            [col]: value
        })
    }

    async first(): Promise<DataOf<this>|null>{
        this.closeQuery();
        this.orders.push(['id','ASC'])
        return await this.queryDb<DataOf<this>>('findOne') ?? null
    }

    async last(){
        this.closeQuery();
        this.orders.push(['id','DESC'])
        return await this.queryDb<DataOf<this>>('findOne') ?? null

    }

    orderBy(column: ColumnNames<this>,order: 'DESC'|'ASC' = 'DESC'){
        this.orders.push([column as string,order])
        return this;
    }

    public async all(): Promise<DataOf<this>[]>{
        this.closeQuery();
        return await this.queryDb<DataOf<this>[]>('findAll') ?? []
    }

    // query builder wrapper ends here

    public async init(): Promise<ModelCtor<any>>{
        if (this.initInstance)
            return this.initInstance;

        this.initInstance = await this.convertToSequelize()

        return this.initInstance
    }

    private async convertToSequelize(): Promise<ModelCtor<any>>{
        this.sequelize = await this.connection
        let structure: ModelAttributes<SeqModel> = {};

        let props = this.getPropertyTypes(this);


        for (let prop in props){

            let value = props[prop];
            let type = value?.dataType?.getType();

            if (!type)
                continue



            if (value.references)
                value.references.sequelize = this.sequelize

            structure[prop] = {
                type,
                unique: value.unique ? value.unique : undefined,
                comment: value.comment,
                defaultValue: value?.dataType?.value,
                allowNull: typeof value.nullable == 'undefined' ? false: value.nullable,
                ...(value.references && {
                    references: {
                        model: await value.references?.init(),
                        key: 'id'
                    }
                }),
                ...(value?.dataType?.getter && {
                    get(){
                        const rawValue = this.getDataValue(prop);
                        return value?.dataType?.getter?.(rawValue)
                    }
                }),
                ...(value?.dataType?.setter && {
                    async set(val){
                        let newValue = await value?.dataType?.setter?.(val)
                        console.log({newValue})
                        this.setDataValue('password', newValue);
                    }
                })
            }
        }


        // console.log(structure)

        if (!this.sequelize)
            this.sequelize = new Sequelize();

        let that = this;

        return this.sequelize.define(this.modelName || this.constructor.name, structure, {
            tableName: snakeCase(this.modelName || this.constructor.name),
            omitNull: false,
            hooks:{
                beforeCreate: async (model) => {
                    let gl = await this.override(this.getOnlyPropsFromInstance())
                    let newData = await this.overrideInsert(this.getOnlyPropsFromInstance())
                    model.set({...gl,...newData})
                },
                beforeUpdate: async (model) => {
                    let gl = await this.override(this.getOnlyPropsFromInstance())
                    let newData = await this.overrideUpdate(this.getOnlyPropsFromInstance())
                    model.set({...gl,...newData})
                }
            }
            // Other model options go here
        })
    }

    whereColIsNull<T>(column: ColumnNames<this> | T) {
        this.whereRaw(`${column} is null`)
        return this;
    }

    whereNotUpdatedSince(count: number, unit: 'days' | 'hours' | 'minutes' |'months' | 'years' = 'days') {
        this.updateWhereClauses(Op.and, {
            ['updatedAt']: {
                [Op.lt]: moment().subtract(count,unit).toDate()
            }
        })
        return this;
    }

    whereHasExpired(){
        this.updateWhereClauses(Op.and, {
            ['expiresOn']: {
                [Op.lte]: new Date()
            }
        })
        return this;
    }
    whereHasNotExpired(){
        this.updateWhereClauses(Op.and, {
            ['expiresOn']: {
                [Op.gt]: new Date()
            }
        })
        return this;
    }

    whereNotCreatedSince(count: number, unit: 'days' | 'hours' | 'minutes' |'months' | 'years' = 'days') {
        this.updateWhereClauses(Op.and, {
            ['createdAt']: {
                [Op.lt]: moment().subtract(count,unit).toDate()
            }
        })
        return this;
    }

    whereColIn(column: ColumnNames<this>,values: any[]) {
        this.updateWhereClauses(Op.and, {
            [column as string]: {
                [Op.in]: values
            }
        })
        return this;
    }

    whereColIsNotNull<T>(column: ColumnNames<this> | T) {
        this.whereRaw(`${column} not null`)

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
            throw new runtimeError(`Chain like() method with where(column: string)`)

        this.whereRaw(`${this.tempColumn} like ${keyword}`)

        return this;
    }

    notLike(keyword: string) {

        if (!this.tempColumn)
            throw new runtimeError(`Chain notLike() method with where(column: string)`)

        this.whereRaw(`${this.tempColumn} not like ${keyword}`)

        return this;
    }

    private getOnlyPropsFromInstance(): DataOf<this>{
        let props = this.getPropertyTypes(this);
        Object.keys(props).map(key => {
            if (this[key])
                props[key] = this[key]
            else
                delete props[key];
        })

        return props as DataOf<this>
    }

//    Writing
    public async save(): Promise<DataOf<this>>{
        return (await (await this.init()).create(this.getOnlyPropsFromInstance()))
    }

    public async truncate(){
        return (await (await this.init()).destroy({
            truncate: true
        }))
    }

    public async delete(){
        return (await (await this.init()).destroy({
            where: this.whereClauses
        }))
    }

    public async update(data: DataOf<this>): Promise<DataOf<this>>{
        return await (await this.init()).update(data, {
            where: this.whereClauses
        }) as unknown as Promise<DataOf<this>>
    }

    public async increment<T>(column: ColumnNames<this> | T, by: number = 1){
        return (await (await this.init()).increment({[column as string]: by}, {
            where: this.whereClauses
        }))
    }

    public async decrement<T>(column: ColumnNames<this> | T, by: number = 1){
        return (await (await this.init()).increment({[column as string]: -by}, {
            where: this.whereClauses
        }))
    }

    public async page(num: number): Promise<DataOf<this>[]>{
        this.currentPage = num
        this.closeQuery();
        return await this.queryDb<DataOf<this>[]>('findAndCountAll') ?? []
    }

    public async create(data: DataOf<this>): Promise<DataOf<this>>{
        return (await (await this.init()).create(data))
    }

    public async createBulk(data: DataOf<this>[]): Promise<DataOf<this>[]>{
        return await (await this.init()).bulkCreate(data)
    }

    protected overrideInsert(data: DataOf<this>){
        return {};
    }
    protected overrideUpdate(data: DataOf<this>){
        return {};
    }
    protected async override(data: DataOf<this>){
        return {};
    }
}