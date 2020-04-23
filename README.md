# graphql-document-tools

Tools to perform analysis on GraphQL documents.

## Install

```bash
$ yarn add --dev graphql-document-tools
```

## Usage

`graphql-document-tools` exports the following functions:

### extractFieldPaths

Extracts a list of field "paths" contained in a GraphQL document.

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

#### API

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

Sample Usage:

```js
import { extractFieldPaths } from 'graphql-document-tools';
const fieldPaths = extractFieldPaths(schemaText, documentString);
```
