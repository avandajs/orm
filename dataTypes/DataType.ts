import Model from "../model/model";

export default abstract class DataType<ReturnType>{
    isNullable?: boolean
    value?: unknown
    references?: Model
    size?: number[] | number
    args?: any[]
    data?: any
    getter?: <T> (value: unknown) => unknown
    setter?: <T> (value: unknown) => unknown
    constructor(default_value?: any) {
        this.data = default_value
        return this;
    }
    abstract getType(): ReturnType
}