import ColumnNames from "../types/ColumnNames";

type OmitType<Base, Type> = Pick<Base, ColumnNames<Base>>;
type DataOf<Type> = OmitType<Type, Function>;

export default DataOf