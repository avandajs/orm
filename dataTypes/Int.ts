import {DataTypes} from "sequelize";
import DataType from "./DataType";
import Model from "../model/model";

export default class Int extends DataType<number>{

    getType() {
        return DataTypes.INTEGER
    }
}