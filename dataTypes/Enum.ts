import {DataTypes, EnumDataType} from "sequelize";
import DataType from "./DataType";

export default class Enum extends DataType<EnumDataType<string>>{
    getType() {
        return DataTypes.ENUM(...this.args)
    }
}