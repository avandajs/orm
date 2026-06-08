"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var ISOLATION_LEVELS;
(function (ISOLATION_LEVELS) {
    ISOLATION_LEVELS["READ_UNCOMMITTED"] = "READ UNCOMMITTED";
    ISOLATION_LEVELS["READ_COMMITTED"] = "READ COMMITTED";
    ISOLATION_LEVELS["REPEATABLE_READ"] = "REPEATABLE READ";
    ISOLATION_LEVELS["SERIALIZABLE"] = "SERIALIZABLE";
})(ISOLATION_LEVELS || (ISOLATION_LEVELS = {}));
class Transaction {
    constructor(isolationLevel = ISOLATION_LEVELS.READ_COMMITTED) {
        this.isolationLevel = isolationLevel;
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
