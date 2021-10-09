import {DataTypes} from "sequelize";
import DataType from "./DataType";
import Model from "../model/model";

export default class Text extends DataType<string>{
    getType() {
        if (this.size){
            return DataTypes.STRING(this.size)
        }else{
            return DataTypes.TEXT
        }
    }
}