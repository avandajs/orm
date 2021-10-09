import DataType from "../dataTypes/DataType";
import "reflect-metadata";
import Model from "./model";
import ColumnOptions from "../types/ColumnOptions";
import Text from "../dataTypes/Text";
import Int from "../dataTypes/Int";


let column = function <ValueDataType>(dataType: DataType<ValueDataType>,options?: ColumnOptions<ValueDataType>){
    if (!options)
        options = {};

    return (target: Model, propertyKey: string) =>  {
        let metadataKey = target.constructor.name;

        let properties: object[] = Reflect.getMetadata(metadataKey, target);

        dataType.size = options?.masSize
        dataType.isNullable = options?.nullable


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

let text = function (options?: ColumnOptions<string>){
    return column<string>(new Text(),options)
}

let int = function (options?: ColumnOptions<number>){
    return column<number>(new Int(), options)
}

export default {
    text,
    int
}