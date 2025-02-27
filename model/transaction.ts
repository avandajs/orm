import { Model } from "@avanda/orm";
import sequelize from "sequelize";

export default class Transaction{
    transaction: sequelize.Transaction;
    
    constructor(
        public autoRetryOnError: boolean = false,
    ){

    }
    
    async execute(){
        try{
            await this.transaction.commit()
        } catch(e){
            // if()
            await this.transaction.rollback()
            throw new Error(e.message)
        }
    }


}