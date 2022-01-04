type FlagExcludedType<Base, Type> = { [Key in keyof Base]: Base[Key] extends Type ? never : Key };
type ColumnNames<Base> = FlagExcludedType<Base, Function>[keyof Base];

export default ColumnNames