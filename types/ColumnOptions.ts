import Model from "../model/model";
import DataType from "../dataTypes/DataType";
import Constraints from "./Constraints";

export default interface ColumnOptions<ValueType>{
    nullable?: boolean,
    unique?: boolean,
    comment?: string,
    references?: Model,
    masSize?: number | number[],
    dataType?: DataType<ValueType>,
    getter?: (value: unknown) => unknown
    setter?: <T> (value: unknown) => unknown,
    onDeleted?: Constraints,
    onUpdated?: Constraints
}