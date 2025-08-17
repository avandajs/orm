export default interface Seeder {
  run(faker: any): void | Promise<void>;
}
