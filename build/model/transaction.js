"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class Transaction {
    constructor(autoRetryOnError = false) {
        this.autoRetryOnError = autoRetryOnError;
    }
    async execute() {
        try {
            await this.transaction.commit();
        }
        catch (e) {
            // if()
            await this.transaction.rollback();
            throw new Error(e.message);
        }
    }
}
exports.default = Transaction;
