"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class Transaction {
    async execute() {
        try {
            await this.transaction.commit();
        }
        catch (e) {
            await this.transaction.rollback();
            throw new Error(e.message);
        }
    }
}
exports.default = Transaction;
