import {DataTypes} from "sequelize";
import DataType from "./DataType";

export default class Bool extends DataType<DataTypes.AbstractDataTypeConstructor>{

    getType() {
        return DataTypes.BOOLEAN
    }
}