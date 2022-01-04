import {DataTypes} from "sequelize";
import DataType from "./DataType";

export default class Int extends DataType< DataTypes.AbstractDataTypeConstructor>{

    getType() {
        return DataTypes.JSON
    }
}