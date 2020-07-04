# extract-field-coordinates

[![npm (scoped)](https://img.shields.io/npm/v/extract-field-coordinates.svg)](https://yarnpkg.com/package/extract-field-coordinates)
[![Build Status](https://travis-ci.com/sharkcore/extract-field-coordinates.svg?branch=master)](https://travis-ci.com/sharkcore/extract-field-coordinates)

Statically extract a list of "field coordinates" contained in a GraphQL document

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

We would return the following set of field coordinates:

```json
["Query.business", "Business.name", "Business.location", "Location.city"]
```

## API

```
extractFieldCoordinates(
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
