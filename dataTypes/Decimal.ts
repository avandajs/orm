import {DataTypes} from "sequelize";
import DataType from "./DataType";

export default class Decimal extends DataType<DataTypes.DecimalDataType>{
    getType() {
        let size = typeof this.size == 'number' ? [this.size] : this.size;
        return DataTypes.DECIMAL( ...size )
    }
}