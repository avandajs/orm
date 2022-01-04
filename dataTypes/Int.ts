import {DataTypes} from "sequelize";
import DataType from "./DataType";

export default class Int extends DataType<DataTypes.IntegerDataTypeConstructor>{

    getType() {
        return DataTypes.INTEGER
    }
}