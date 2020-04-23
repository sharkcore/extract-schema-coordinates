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
