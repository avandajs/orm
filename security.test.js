require("reflect-metadata");
const { test } = require("node:test");
const assert = require("node:assert");
const { Sequelize } = require("sequelize");
const { Model, Column, Fnc } = require("./build");

class User extends Model {}
Column.text()(User.prototype, "email");
Column.text()(User.prototype, "password");
Column.text({ nullable: true })(User.prototype, "reset_token");

class Post extends Model {}
Column.int({ references: new User() })(Post.prototype, "user_id");
Column.text()(Post.prototype, "title");
Column.text({ nullable: true })(Post.prototype, "secret_note");

// no database: every statement is captured instead of being sent
const statements = [];
const sequelize = new Sequelize("db", "user", "pass", {
  dialect: "mysql",
  logging: false,
});
sequelize.query = async (sql) => {
  statements.push(typeof sql == "string" ? sql : sql.query);
  return [];
};
Model.setConnection(Promise.resolve(sequelize));

async function sqlOf(run) {
  statements.length = 0;
  await run();
  return statements.join("\n");
}

test("a where condition that can't be read throws instead of matching every row", () => {
  for (const condition of [
    "reset_token = ",
    "reset_token",
    "",
    "NOT deleted = 1",
    "user.id = 5",
    "id <=> 5",
  ])
    assert.throws(() => new User().whereRaw(condition), /where condition/, condition);
});

test("delete() and update() keep their condition for an empty value", async () => {
  const del = await sqlOf(() => new User().where("reset_token").like("").delete());
  assert.match(del, /WHERE .*`reset_token` LIKE ''/);

  const upd = await sqlOf(() =>
    new User().where("email").like("").update({ password: "x" })
  );
  assert.match(upd, /`email` LIKE ''/);
});

test("whereRaw reads operators whatever their case and keeps the whole value", async () => {
  const sql = await sqlOf(() =>
    new User().whereRaw("email LIKE %a b%").whereRaw("reset_token NOT LIKE x%").all()
  );
  assert.match(sql, /`email` LIKE '%a b%'/);
  assert.match(sql, /`reset_token` NOT LIKE 'x%'/);
});

test("column helpers build their clause without going through the parser", async () => {
  const sql = await sqlOf(() =>
    new User()
      .where("email").like("%a%\nb")
      .where("id").greaterThan(5)
      .whereColIsNull("reset_token")
      .whereColIsNotNull("password")
      .all()
  );
  assert.match(sql, /`email` LIKE '%a%\\nb'/);
  assert.match(sql, /`id` > 5/);
  assert.match(sql, /`reset_token` IS NULL/);
  assert.match(sql, /`password` IS NOT NULL/);
});

test("orderBy quotes a column and refuses anything else", async () => {
  const sql = await sqlOf(() => new User().orderBy("email", "ASC").all());
  assert.match(sql, /ORDER BY `User`\.`email` ASC/);

  assert.throws(() => new User().orderBy("id, (SELECT SLEEP(5))", "ASC"));
  assert.throws(() => new User().orderBy("id", "ASC, (SELECT 1)"));

  // an expression has to be asked for explicitly
  const raw = await sqlOf(() => new User().orderBy(Fnc.query("RAND()"), "DESC").all());
  assert.match(raw, /ORDER BY RAND\(\) DESC/);
});

test("whereNotCreatedSince binds a date and refuses an unknown unit", async () => {
  const sql = await sqlOf(() => new User().whereNotCreatedSince(2, "days").all());
  assert.match(sql, /`createdAt` <= '\d{4}-\d{2}-\d{2} /);
  assert.ok(!sql.includes("INTERVAL"));

  assert.throws(() => new User().whereNotCreatedSince(1, "DAY) OR 1=1 -- "));
  assert.throws(() => new User().whereNotCreatedSince("1) OR 1=1", "days"));
});

test("one instance's values never become another instance's column defaults", async () => {
  const a = new Post();
  a.title = "request-A title";
  a.secret_note = "request-A private note";
  const b = new Post();

  const [modelB, modelA] = await Promise.all([b.init(), a.init()]);
  assert.strictEqual(modelB.rawAttributes.title.defaultValue, undefined);
  assert.strictEqual(modelB.rawAttributes.secret_note.defaultValue, undefined);
  // a model's own values are still its defaults
  assert.strictEqual(modelA.rawAttributes.title.defaultValue, "request-A title");
});
