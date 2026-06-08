import {DataTypes} from "sequelize";
import DataType from "./DataType";

export default class Uuid extends DataType<DataTypes.AbstractDataTypeConstructor>{

    getType() {
        return DataTypes.UUID
    }
}
