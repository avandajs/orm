import {DataTypes} from "sequelize";
import DataType from "./DataType";
import {StringDataType} from "sequelize/types/lib/data-types";

export default class Text extends DataType<StringDataType|DataTypes.TextDataTypeConstructor>{
    getType() {
        if (this.size){
            return DataTypes.STRING(typeof this.size == 'number' ? this.size:undefined)
        }else{
            return DataTypes.TEXT
        }
    }
}