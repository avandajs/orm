export default interface WhereClause{
    [prop: string]: any | WhereClause | WhereClause[] | string[]
}