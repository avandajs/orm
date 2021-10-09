import Model from "../model/model";
import DataType from "../dataTypes/DataType";

export default interface ColumnOptions<ValueType>{
    nullable?: boolean,
    references?: Model,
    masSize?: number,
    dataType?: DataType<ValueType>
}