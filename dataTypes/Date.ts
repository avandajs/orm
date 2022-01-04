import {DataTypes} from "sequelize";
import DataType from "./DataType";

export default class Date extends DataType<DataTypes.DateDataTypeConstructor>{

    getType() {
        return DataTypes.DATE
    }
}