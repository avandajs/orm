import ColumnOptions from "./ColumnOptions";

export default interface ModelShape<ValueType> {
    [prop: string]: ColumnOptions<ValueType>
}