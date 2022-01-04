import Faker from "faker"

export default interface Seeder{
    run(faker: Faker.FakerStatic): void | Promise<void>
}