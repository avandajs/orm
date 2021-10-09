import {AbstractDataTypeConstructor, StringDataType, TextDataTypeConstructor} from "sequelize/types/lib/data-types";
import Model from "../model/model";

export default abstract class DataType<Type>{
    isNullable?: boolean
    value?: unknown
    references?: Model
    size?: number
    data?: Type
    constructor(default_value?: Type) {
        this.data = default_value
        return this;
    }
    abstract getType(): AbstractDataTypeConstructor | StringDataType | TextDataTypeConstructor | undefined
}