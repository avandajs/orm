import {Faker} from "@faker-js/faker"

export default interface Seeder{
    run(faker: Faker): void | Promise<void>
}