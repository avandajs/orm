import { Model } from "@avanda/orm";
import sequelize from "sequelize";

enum ISOLATION_LEVELS {
  READ_UNCOMMITTED = "READ UNCOMMITTED",
  READ_COMMITTED = "READ COMMITTED",
  REPEATABLE_READ = "REPEATABLE READ",
  SERIALIZABLE = "SERIALIZABLE",
}

export default class Transaction {
  transaction: sequelize.Transaction;

  constructor(
    public isolationLevel: ISOLATION_LEVELS = ISOLATION_LEVELS.READ_COMMITTED,
  ) {}

  async execute() {
    try {
      await this.transaction.commit();
    } catch (e) {
      // if()
      await this.transaction.rollback();
      throw new Error(e.message);
    }
  }
}
