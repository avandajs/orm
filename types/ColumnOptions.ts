import Model from "../model/model";
import DataType from "../dataTypes/DataType";
import Constraints from "./Constraints";
import { IndexMethod, IndexType } from "sequelize/types";

export interface ColumnIndex{
    name?: string,
    with?: string[],
    use?: IndexMethod,
    type?: IndexType,
    where?: {[key: string]: any}
}
export default interface ColumnOptions<ValueType>{
    nullable?: boolean,
    unique?: boolean,
    comment?: string,
    references?: Model | string,
    masSize?: number | number[],
    dataType?: DataType<ValueType>,
    getter?: (value: unknown) => unknown
    setter?: <T> (value: unknown) => unknown,
    onDeleted?: Constraints,
    onUpdated?: Constraints,
    srid?: number,
    index?: boolean | ColumnIndex

}