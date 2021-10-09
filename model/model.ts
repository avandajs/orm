import {Model as SeqModel, ModelAttributes, ModelCtor, Op, Sequelize, fn, col} from "sequelize";
import {snakeCase} from "lodash"
import ColumnOptions from "../types/ColumnOptions";
import ModelShape from "../types/ModelShape";
import WhereClause from "../types/WhereClause";
import {runtimeError} from "@avanda/error";
import {Fn} from "sequelize/types/lib/utils";

type FlagExcludedType<Base, Type> = { [Key in keyof Base]: Base[Key] extends Type ? never : Key };
type AllowedNames<Base, Type> = FlagExcludedType<Base, Type>[keyof Base];
type OmitType<Base, Type> = Pick<Base, AllowedNames<Base, Type>>;
type NonFunctionPropertyNames<Type> = OmitType<Type, Function>;

/*
* I know i should have a seperate class for query to make building query easier and more nestable,
* I think that's a future
* */

export default abstract class Model{

    protected connection?: Sequelize
    private modelName?: string

    protected whereClauses?: WhereClause;
    protected columns?: Array<string|[Fn|string,string]>;

    protected orders: [string,string][] = [];
    protected tempClauses?: WhereClause;
    protected logicalOp?: symbol
    protected nextedWhereDone: boolean = false
    protected tempColumn?: string
    protected tempSelectColumn?: string | Fn

    private initInstance?: ModelCtor<any>

    constructor(connection?: Sequelize) {
        this.connection = connection
    }

    setConnection(connection?: Sequelize) {
        this.connection = connection
    }

    setModelName(value: string) {
        this.modelName = value;
    }

    private getPropertyTypes(origin: object): ModelShape<any> {

        const properties: { options: ColumnOptions<unknown>,name: string }[] = Reflect.getMetadata(this.constructor.name, this);
        const result = {};
        properties.forEach(prop => {
            let options = prop.options
            options.dataType.value = this[prop.name]
            result[prop.name] = options
        });
        return result;
    }

    // query builder wrapper start here

    select(...columns: AllowedNames<this,Function>[] | '*'[]){

        if (columns.length == 1 && columns[0] == "")
            return this;

        this.tempSelectColumn = (columns as string[])[columns.length - 1]
        this.columns = (columns as string[])

        return this;
    }

    public sum(column: AllowedNames<this,Function>){
        this.tempSelectColumn = fn('SUM', col(column as string))
        return this;
    }

    public as(alias: string){
        if (!this.tempSelectColumn)
            throw new runtimeError(`'You haven't specified the expression to assign alias for`)
        this.columns.push([this.tempSelectColumn,alias])
        return this;
    }

    generateWhereClause(){

    }

    public where(condition: NonFunctionPropertyNames<this> | AllowedNames<this,Function> | ((model: this) => void)){
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

    public orWhere(condition: NonFunctionPropertyNames<this> | AllowedNames<this,Function> | ((model: this) => void)){
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

    private convertRawToArray(query: string): WhereClause{
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
        condition: NonFunctionPropertyNames<this> | AllowedNames<this,Function> | string | ((model: this) => void),
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
            this.updateWhereClauses(operand, this.convertRawToArray(condition));
        }else{
            this.tempColumn = condition as string
        }
        return this;
    }

    private updateWhereClauses(
        operand: symbol,
        condition: NonFunctionPropertyNames<this>  | ((model: this) => void) | WhereClause
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

    greaterThan(value: number){
        if (!this.tempColumn)
            throw new runtimeError("Specify column to apply greaterThan() to user the where() function")

        this.whereRaw(`${this.tempColumn} > ${value}`)

        return this;
    }

    async find(id: number): Promise<NonFunctionPropertyNames<this>|null>{
        this.closeQuery();
        return (await this.queryDb<NonFunctionPropertyNames<this>>('findAll',{
            id
        })) ?? null
    }

    async findAll(id: number): Promise<NonFunctionPropertyNames<this>[]>{
        return await this.queryDb<NonFunctionPropertyNames<this>[]>('findAll',{
            id
        })
    }
    private async queryDb<ReturnType>(fn: 'findOne' | 'findAll',where: WhereClause = {},fields?: string[]): Promise<ReturnType>{
        return (await this.init()[fn]({
            where: {
                ...this.whereClauses,
                ...where,
            },
            attributes: this.columns,
            order:this.orders
        }))
    }

    async findBy(col: string,value: any): Promise<NonFunctionPropertyNames<this>> {
        return await this.queryDb<NonFunctionPropertyNames<this>>('findOne',{
            [col]: value
        })
    }

    async findAllBy(col: string,value: any): Promise<NonFunctionPropertyNames<this>[]>{
        return await this.queryDb<NonFunctionPropertyNames<this>[]>('findAll',{
            [col]: value
        })
    }

    async first(): Promise<NonFunctionPropertyNames<this>|null>{
        this.closeQuery();
        this.orders.push(['id','ASC'])
        return await this.queryDb<NonFunctionPropertyNames<this>>('findOne') ?? null
    }

    async last(){
        this.closeQuery();
        this.orders.push(['id','ASC'])
        return await this.queryDb<NonFunctionPropertyNames<this>>('findOne') ?? null

    }

    orderBy(column: AllowedNames<this,Function>,order: 'DESC'|'ASC' = 'DESC'){
        this.orders.push([column as string,order])
        return this;
    }

    public async all(): Promise<NonFunctionPropertyNames<this>[]>{
        this.closeQuery();
        return await this.queryDb<NonFunctionPropertyNames<this>[]>('findAll') ?? []
    }

    // query builder wrapper ends here

    public init(): ModelCtor<any>{
        if (this.initInstance)
            return this.initInstance;

        this.initInstance = this.convertToSequelize()

        return this.initInstance
    }

    private convertToSequelize(): ModelCtor<any>{

        let structure: ModelAttributes<SeqModel> = {};

        let props = this.getPropertyTypes(this);


        for (let prop in props){

            let value = props[prop];
            let type = value?.dataType?.getType();

            if (!type)
                continue

            if (value.references)
                value.references.connection = this.connection

            structure[prop] = {
                type,
                defaultValue: value?.dataType?.value,
                allowNull: typeof value.nullable == 'undefined' ? false: value.nullable,
                ...(value.references && {
                    references: {
                        model: value.references?.init(),
                        key: 'id'
                    }
                })
            }
        }


        // console.log(structure)

        if (!this.connection)
            this.connection = new Sequelize();

        return this.connection.define(this.modelName || this.constructor.name, structure, {
            tableName: snakeCase(this.modelName || this.constructor.name),
            // Other model options go here
        })
    }

    whereColIsNull<T>(column: AllowedNames<this,Function> | T) {
        this.whereRaw(`${column} is null`)
        return this;
    }

    whereColIn(column: AllowedNames<this,Function>,values: any[]) {
        this.updateWhereClauses(Op.and, {
            [column as string]: {
                [Op.in]: values
            }
        })
        this.whereRaw(`${column} is null`)
        return this;
    }

    whereColIsNotNull<T>(column: AllowedNames<this,Function> | T) {
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

//    Writing
    public async save(): Promise<NonFunctionPropertyNames<this>>{
        let props = this.getPropertyTypes(this);
        Object.keys(props).map(key => {
            if (this[key])
                props[key] = this[key]
            else
                delete props[key];
        })

        return (await this.init().create(props))
    }

    public async truncate(){
        return (await this.init().destroy({
            truncate: true
        }))
    }

    public async delete(){
        return (await this.init().destroy({
            where: this.whereClauses
        }))
    }

    public async update(data: NonFunctionPropertyNames<this>){
        return (await this.init().update(data, {
            where: this.whereClauses
        }))
    }

    public async create(data: NonFunctionPropertyNames<this>){
        return (await this.init().create(data))
    }

    public async createBulk(data: NonFunctionPropertyNames<this>[]): Promise<NonFunctionPropertyNames<this>[]>{
        return await this.init().bulkCreate(data)
    }
}