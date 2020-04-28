import fs from 'fs';
import path from 'path';
import { extractFieldPaths } from '../src';
const PETS_SCHEMA = fs.readFileSync(path.join(__dirname, '../testing/pets.schema.graphql'), 'utf8');

test('extractFieldPaths works for basic query', () => {
    const fieldPaths = extractFieldPaths(
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

    expect([...fieldPaths].sort()).toEqual([
        'ContactDetails.email',
        'Human.contactDetails',
        'Human.name',
        'Root.animalOwner',
    ]);
});

test('extractFieldPaths works for multiple operations', () => {
    const fieldPaths = extractFieldPaths(
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

    expect([...fieldPaths].sort()).toEqual([
        'ContactDetails.email',
        'Human.contactDetails',
        'Human.name',
        'Root.animalOwner',
    ]);
});

test('includes non-existant fields (e.g. for outdated schemas) as leaf nodes', () => {
    const fieldPaths = extractFieldPaths(
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
    expect([...fieldPaths].sort()).toEqual([
        'ContactDetails.I_DONT_EXIST',
        'ContactDetails.email',
        'Human.I_DONT_EXIST',
        'Human.contactDetails',
        'Human.name',
        'Root.animalOwner',
    ]);
});

test('includes non-existant fields (e.g. for outdated schemas) as non-leaf nodes', () => {
    const fieldPaths = extractFieldPaths(
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

    expect([...fieldPaths].sort()).toEqual([
        'ContactDetails.I_DONT_EXIST',
        'ContactDetails.email',
        'Human.contactDetails',
        'Human.name',
        'Root.animalOwner',
    ]);
});

test('fragments', () => {
    const fieldPaths = extractFieldPaths(
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

    expect([...fieldPaths].sort()).toEqual([
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
    const fieldPaths = extractFieldPaths(
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

    expect([...fieldPaths].sort()).toEqual([
        'Animal.name',
        'Dog.breed',
        'Dog.name',
        'Human.name',
        'Root.allSpecies',
        'Root.animalOwner',
    ]);
});

test('inline fragments', () => {
    const fieldPaths = extractFieldPaths(
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

    expect([...fieldPaths].sort()).toEqual([
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
    const fieldPaths = extractFieldPaths(
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

    expect([...fieldPaths].sort()).toEqual([
        'Animal.name',
        'Dog.breed',
        'Dog.name',
        'Human.name',
        'Root.allSpecies',
        'Root.animalOwner',
    ]);
});

test("copes with types that don't exist in the schema", () => {
    const fieldPaths = extractFieldPaths(
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

    expect([...fieldPaths].sort()).toEqual(['Animal.name', 'Root.allSpecies', 'Snake.skin']);
});
