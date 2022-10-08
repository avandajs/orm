import { Model } from "@avanda/orm";
import sequelize from "sequelize";

export default class Transaction{
    transaction: sequelize.Transaction;
    
    async execute(){
        try{
            await this.transaction.commit()
        } catch(e){
            await this.transaction.rollback()
            throw new Error(e.message)
        }
    }


}