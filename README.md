# extract-field-coordinates

[![npm](https://img.shields.io/npm/v/extract-field-paths.svg)](https://yarn.pm/extract-field-coordinates)
[![Build Status](https://travis-ci.org/sharkcore/extract-field-paths.svg?branch=master)](https://travis-ci.org/sharkcore/extract-field-coordinates)

Statically extract a list of field "paths" (type and field pairs) contained in a GraphQL document.

## Install

```bash
$ yarn add --dev extract-field-coordinates
```

## Example

e.g. for the following query:

```graphql
query GET_BUSINESS($BizId: String) {
    business(id: $BizId) {
        name
        location {
            city
        }
    }
}
```

We would return the following set of field paths:

```json
["Query.business", "Business.name", "Business.location", "Location.city"]
```

## API

```
extractFieldPaths(
    /**
     * The text of the document to analyse, in raw string format
     */
    documentText: string,
    /**
     * The text of your schema, in string SDL format (e.g. as created by printSchema)
     * @see https://graphql.org/graphql-js/utilities/#printschema
     */
    schemaText: string,
): Set<string>
```

### Sample Usage:

```js
import extractFieldCoordinates from 'extract-field-coordinates';
const fieldCoordinates = extractFieldCoordinates(documentString, schemaText);
```
