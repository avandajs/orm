import DataType from "../dataTypes/DataType";
import "reflect-metadata";
import Model from "./model";
import ColumnOptions from "../types/ColumnOptions";
import Text from "../dataTypes/Text";
import Int from "../dataTypes/Int";
import Decimal from "../dataTypes/Decimal";
import Bool from "../dataTypes/Bool";
import Date from "../dataTypes/Date";
import JSON from "../dataTypes/JSON";
import Enum from "../dataTypes/Enum";
import {StringDataType} from "sequelize/types";
import {DataTypes, EnumDataType} from "sequelize";


let column = function <ValueDataType>(dataType: DataType<ValueDataType>,options?: ColumnOptions<ValueDataType>){
    if (!options)
        options = {};

    return (target: Model, propertyKey: string) =>  {
        let metadataKey = target.constructor.name;

        let properties: object[] = Reflect.getMetadata(metadataKey, target);

        dataType.size = options?.masSize
        dataType.isNullable = options?.nullable
        dataType.setter = options?.setter
        dataType.getter = options?.getter
        options.dataType = dataType

        if (properties) {
            properties.push({
                name:  propertyKey,
                options
            });
        } else {
            properties = [{
                name:  propertyKey,
                options
            }];
            Reflect.defineMetadata(metadataKey, properties, target);
        }
    }
}

let text = function (options?: ColumnOptions<StringDataType|DataTypes.TextDataTypeConstructor>){
    return column<StringDataType|DataTypes.TextDataTypeConstructor>(new Text(),options)
}

let int = function (options?: ColumnOptions<DataTypes.IntegerDataTypeConstructor>){
    return column<DataTypes.IntegerDataTypeConstructor>(new Int(), options)
}
let decimal = function (options?: ColumnOptions<DataTypes.DecimalDataType>){
    return column<DataTypes.DecimalDataType>(new Decimal(), options)
}
let boolean = function (options?: ColumnOptions<DataTypes.AbstractDataTypeConstructor>){
    return column<DataTypes.AbstractDataTypeConstructor>(new Bool(), options)
}

let date = function (options?: ColumnOptions<DataTypes.DateDataTypeConstructor>){
    return column< DataTypes.DateDataTypeConstructor>(new Date(), options)
}
let json = function (options?: ColumnOptions<DataTypes.AbstractDataTypeConstructor>){
    return column< DataTypes.AbstractDataTypeConstructor>(new JSON(), options)
}
let _enum = function (acceptedValues: string[] , options?: ColumnOptions<EnumDataType<string>>){
    let e = new Enum();
    e.args = acceptedValues
    return column<EnumDataType<string>>(e, options)
}

export default {
    text,
    int,
    date,
    json,
    decimal,
    enum: _enum,
    boolean
}