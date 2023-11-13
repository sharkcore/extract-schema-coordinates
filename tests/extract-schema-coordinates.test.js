import fs from 'node:fs';
import path from 'node:path';
import { expect, test } from '@jest/globals';
import { findUpSync } from 'find-up';
import extractSchemaCoordinates from '../src/extract-schema-coordinates';

const ROOT = path.dirname(findUpSync('package.json'));
const PETS_SCHEMA = fs.readFileSync(path.join(ROOT, 'testing/pets.schema.graphql'), 'utf8');

test('basic query', () => {
    const fieldCoordinates = extractSchemaCoordinates(
        /* GraphQL */ `
            {
                animalOwner {
                    name
                    contactDetails {
                        email
                    }
                }
            }
        `,
        PETS_SCHEMA,
    );

    expect([...fieldCoordinates].sort()).toEqual([
        'ContactDetails.email',
        'Human.contactDetails',
        'Human.name',
        'Root.animalOwner',
    ]);
});

test('basic mutation', () => {
    const fieldCoordinates = extractSchemaCoordinates(
        /* GraphQL */ `
            mutation {
                addCat(name: "Palmerston") {
                    name
                    favoriteMilkBrand
                }
            }
        `,
        PETS_SCHEMA,
    );

    expect([...fieldCoordinates].sort()).toEqual(['Cat.favoriteMilkBrand', 'Cat.name', 'Mutation.addCat']);
});

test('extended types', () => {
    const fieldCoordinates = extractSchemaCoordinates(
        /* GraphQL */ `
            {
                animalOwner {
                    name
                    contactDetails {
                        email
                        address {
                            zip
                        }
                    }
                }
            }
        `,
        PETS_SCHEMA,
    );

    expect([...fieldCoordinates].sort()).toEqual([
        'Address.zip',
        'ContactDetails.address',
        'ContactDetails.email',
        'Human.contactDetails',
        'Human.name',
        'Root.animalOwner',
    ]);
});

test('multiple operations', () => {
    const fieldCoordinates = extractSchemaCoordinates(
        /* GraphQL */ `
            {
                animalOwner {
                    name
                }
            }
            {
                animalOwner {
                    contactDetails {
                        email
                    }
                }
            }
        `,
        PETS_SCHEMA,
    );

    expect([...fieldCoordinates].sort()).toEqual([
        'ContactDetails.email',
        'Human.contactDetails',
        'Human.name',
        'Root.animalOwner',
    ]);
});

test('includes non-existant fields (e.g. for outdated schemas) as leaf nodes', () => {
    const fieldCoordinates = extractSchemaCoordinates(
        /* GraphQL */ `
            {
                animalOwner {
                    name
                    I_DONT_EXIST
                    contactDetails {
                        email
                        I_DONT_EXIST
                    }
                }
            }
        `,
        PETS_SCHEMA,
    );
    expect([...fieldCoordinates].sort()).toEqual([
        'ContactDetails.I_DONT_EXIST',
        'ContactDetails.email',
        'Human.I_DONT_EXIST',
        'Human.contactDetails',
        'Human.name',
        'Root.animalOwner',
    ]);
});

test('includes non-existant fields (e.g. for outdated schemas) as non-leaf nodes', () => {
    const fieldCoordinates = extractSchemaCoordinates(
        /* GraphQL */ `
            {
                animalOwner {
                    name
                    contactDetails {
                        email
                        I_DONT_EXIST {
                            foo
                            bar
                        }
                    }
                }
            }
        `,
        PETS_SCHEMA,
    );

    expect([...fieldCoordinates].sort()).toEqual([
        'ContactDetails.I_DONT_EXIST',
        'ContactDetails.email',
        'Human.contactDetails',
        'Human.name',
        'Root.animalOwner',
    ]);
});

test('fragments', () => {
    const fieldCoordinates = extractSchemaCoordinates(
        /* GraphQL */ `
            {
                animalOwner {
                    name
                }
                allSpecies {
                    ...doggoDetails
                    ...catFacts
                }
                pets {
                    ...parrotParticulars
                }
            }

            fragment doggoDetails on Dog {
                breed
            }

            fragment catFacts on Cat {
                favoriteMilkBrand
                name
            }

            fragment parrotParticulars on Parrot {
                wingSpan
            }
        `,
        PETS_SCHEMA,
    );

    expect([...fieldCoordinates].sort()).toEqual([
        'Cat.favoriteMilkBrand',
        'Cat.name',
        'Dog.breed',
        'Human.name',
        'Parrot.wingSpan',
        'Root.allSpecies',
        'Root.animalOwner',
        'Root.pets',
    ]);
});

test('fragments with interface fields', () => {
    const fieldCoordinates = extractSchemaCoordinates(
        /* GraphQL */ `
            {
                animalOwner {
                    name
                }
                allSpecies {
                    name
                    ...doggoDetails
                }
            }

            fragment doggoDetails on Dog {
                breed
                name
            }
        `,
        PETS_SCHEMA,
    );

    expect([...fieldCoordinates].sort()).toEqual([
        'Animal.name',
        'Dog.breed',
        'Dog.name',
        'Human.name',
        'Root.allSpecies',
        'Root.animalOwner',
    ]);
});

test('inline fragments', () => {
    const fieldCoordinates = extractSchemaCoordinates(
        /* GraphQL */ `
            {
                animalOwner {
                    name
                }
                allSpecies {
                    ... on Dog {
                        breed
                    }
                    ... on Cat {
                        favoriteMilkBrand
                        name
                    }
                }
                pets {
                    ... on Parrot {
                        wingSpan
                    }
                }
            }
        `,
        PETS_SCHEMA,
    );

    expect([...fieldCoordinates].sort()).toEqual([
        'Cat.favoriteMilkBrand',
        'Cat.name',
        'Dog.breed',
        'Human.name',
        'Parrot.wingSpan',
        'Root.allSpecies',
        'Root.animalOwner',
        'Root.pets',
    ]);
});

test('inline fragments with interface fields', () => {
    const fieldCoordinates = extractSchemaCoordinates(
        /* GraphQL */ `
            {
                animalOwner {
                    name
                }
                allSpecies {
                    name
                    ... on Dog {
                        breed
                        name
                    }
                }
            }
        `,
        PETS_SCHEMA,
    );

    expect([...fieldCoordinates].sort()).toEqual([
        'Animal.name',
        'Dog.breed',
        'Dog.name',
        'Human.name',
        'Root.allSpecies',
        'Root.animalOwner',
    ]);
});

test('inline fragments without a type condition', () => {
    const fieldCoordinates = extractSchemaCoordinates(
        /* GraphQL */ `
            query Foo($expandedInfo: Boolean) {
                allSpecies {
                    ... @include(if: $expandedInfo) {
                        name
                    }
                }
            }
        `,
        PETS_SCHEMA,
    );

    expect([...fieldCoordinates].sort()).toEqual(['Animal.name', 'Root.allSpecies']);
});

test("copes with types that don't exist in the schema", () => {
    const fieldCoordinates = extractSchemaCoordinates(
        /* GraphQL */ `
            {
                allSpecies {
                    name
                    ... on Snake {
                        skin {
                            color
                        }
                    }
                }
            }
        `,
        PETS_SCHEMA,
    );

    expect([...fieldCoordinates].sort()).toEqual(['Animal.name', 'Root.allSpecies', 'Snake.skin']);
});

test('shows inputs', () => {
    const fieldCoordinates = extractSchemaCoordinates(
        /* GraphQL */ `
            mutation AddVet($vetInfo: VetDetailsInput!, $somethingElse: String!) {
                addVet(details: $vetInfo)
            }
        `,
        PETS_SCHEMA,
    );

    expect([...fieldCoordinates].sort()).toEqual(['Mutation.addVet', 'VetDetailsInput']);
});

test('throws error on unsupported operation types', () => {
    const fieldCoordinates = extractSchemaCoordinates(
        /* GraphQL */ `
            mutation AddCat($name: String) {
                addCat(name: $name) {
                    name
                }
            }
        `,
        PETS_SCHEMA,
    );

    expect([...fieldCoordinates].sort()).toEqual(['Cat.name', 'Mutation.addCat']);
});

test('throws error on unsupported operation types', () => {
    expect(() =>
        extractSchemaCoordinates(
            /* GraphQL */ `
                subscription Foo {
                    bar
                }
            `,
            PETS_SCHEMA,
        ),
    ).toThrow(/Schema is not configured to execute subscription/);
});
