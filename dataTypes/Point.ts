import {DataTypes} from "sequelize";
import DataType from "./DataType";

export default class Point extends DataType<DataTypes.GeographyDataType>{
    getType() {
        return DataTypes.GEOMETRY( 'POINT', 4326)
    }
}