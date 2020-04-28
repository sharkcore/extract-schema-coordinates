import fs from 'fs';
import path from 'path';
import { extractFieldPaths } from '../src';
const SWAPI_SCHEMA = fs.readFileSync(path.join(__dirname, '../testing/swapi.schema.graphql'), 'utf8');

test('extractFieldPaths works for basic SWAPI query', () => {
    const fieldPaths = extractFieldPaths(
        /* GraphQL */ `
            {
                allFilms {
                    films {
                        title
                        director
                        planetConnection {
                            planets {
                                name
                            }
                        }
                    }
                }
            }
        `,
        SWAPI_SCHEMA,
    );

    expect([...fieldPaths].sort()).toEqual([
        'Film.director',
        'Film.planetConnection',
        'Film.title',
        'FilmPlanetsConnection.planets',
        'FilmsConnection.films',
        'Planet.name',
        'Root.allFilms',
    ]);
});

test('includes non-existant fields (e.g. for outdated schemas) as leaf nodes', () => {
    const fieldPaths = extractFieldPaths(
        /* GraphQL */ `
            {
                allFilms {
                    films {
                        I_DONT_EXIST
                        title
                        director
                        planetConnection {
                            planets {
                                name
                                I_DONT_EXIST
                            }
                        }
                    }
                }
            }
        `,
        SWAPI_SCHEMA,
    );

    expect([...fieldPaths].sort()).toEqual([
        'Film.I_DONT_EXIST',
        'Film.director',
        'Film.planetConnection',
        'Film.title',
        'FilmPlanetsConnection.planets',
        'FilmsConnection.films',
        'Planet.I_DONT_EXIST',
        'Planet.name',
        'Root.allFilms',
    ]);
});

test('includes non-existant fields (e.g. for outdated schemas) as non-leaf nodes', () => {
    const fieldPaths = extractFieldPaths(
        /* GraphQL */ `
            {
                allFilms {
                    films {
                        I_DONT_EXIST {
                            foo
                            bar
                        }
                        title
                        director
                    }
                }
            }
        `,
        SWAPI_SCHEMA,
    );

    expect([...fieldPaths].sort()).toEqual([
        'Film.I_DONT_EXIST',
        'Film.director',
        'Film.title',
        'FilmsConnection.films',
        'Root.allFilms',
    ]);
});
