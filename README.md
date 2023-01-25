# extract-schema-coordinates

Statically extract a list of "field coordinates" contained in a GraphQL document

## Install

```bash
$ yarn add --dev extract-schema-coordinates
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
extractSchemaCoordinates(
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

### Usage:

```js
import extractSchemaCoordinates from 'extract-schema-coordinates';
const schemaCoordinates = extractSchemaCoordinates(documentString, schemaText);
```
