// @flow

import invariant from 'assert';
import { parse, visit, type SelectionSetNode, type OperationDefinitionNode } from 'graphql';

/**
 * Recursively unwrap a type object to get the human readable type name
 * TODO: Replace this with getNamedType from graphql-js
 */
function getTypeNameFromType(type): string {
    if (type.type != null) {
        return getTypeNameFromType(type.type);
    }

    // Tell flow that we exhausted the search for the NamedType
    invariant(type.kind === 'NamedType');

    return type.name.value;
}

/**
 * Extracts a list of field "paths" contained in a GraphQL document.

 * Example - for the following query:
 * ```graphql
 * query GET_BUSINESS($BizId: String) {
 *     business(id: $BizId) {
 *         name
 *         location {
 *             city
 *         }
 *     }
 * }
 * ```
 *
 * We would return the following:
 * [
 *   "Query.business",
 *   "User.displayName",
 *   "Business.name",
 *   "Business.location",
 *   "Location.city"
 * ]
 */
export default function extractFieldPaths(
    /**
     * The text of the document to analyse, in raw string format
     */
    documentText: string,
    /**
     * The text of your schema, in string SDL format (e.g. as created by printSchema)
     * @see https://graphql.org/graphql-js/utilities/#printschema
     */
    schemaText: string,
): Set<string> {
    // Turn the provided schema text (SDL) into an AST
    const schemaAst = parse(schemaText);

    /**
     * Contruct a map of type names in the schema to the fields they contain.
     *
     * Example:
     * ```js
     * {
     *     Query: [
     *         { field: "business", type: "Business" },
     *         { field: "business_search", type: "Business" },
     *         { field: "event", type: "Event" },
     *     ],
     *     Business: [
     *         { field: "name", type: "String" },
     *         { field: "events", type: "Event" },
     *         { field: "reviews", type: "Review" },
     *     ],
     *     Event: [
     *         { field: "name", type: "String" },
     *         { field: "event_site_url", type: "String" },
     *     ],
     *     ...
     * }
     * ```
     */
    const typeToFieldsMap = {};

    /**
     * Construct a map of operation field name (e.g. "query") -> root type (e.g. "Query")
     * Use the defaults for where to look for the root operations
     * @see http://spec.graphql.org/draft/#sec-Root-Operation-Types.Default-Root-Operation-Type-Names
     * (Values here may be overriden when we parse the AST)
     */
    const operationFieldNameToTypeMap = {
        query: 'Query',
        muration: 'Mutation',
        subscription: 'Subscription',
    };

    visit(schemaAst, {
        leave: {
            ObjectTypeDefinition: (node) => {
                // istanbul ignore else: node.fields is a maybe type
                if (node.fields != null) {
                    typeToFieldsMap[node.name.value] = node.fields.map(({ name, type }) => ({
                        field: name.value,
                        type: getTypeNameFromType(type),
                    }));
                }
            },
            SchemaDefinition: (node) => {
                node.operationTypes.forEach(({ operation, type }) => {
                    operationFieldNameToTypeMap[operation] = type.name.value;
                });
            },
        },
    });

    const documentAst = parse(documentText);
    const fieldPaths = new Set<string>();

    // define a queue for use in our dfs search of the document ast
    const queue: Array<{| type: string, selectionSet: SelectionSetNode |}> = [];

    // enqueue the roots of the document
    documentAst.definitions
        .filter((definition) => definition.kind === 'OperationDefinition')
        .forEach((definition) => {
            invariant(definition.kind === 'OperationDefinition');

            // the name of the operation (e.g. 'query')
            const operationName = definition.operation;
            // the name of the root type in the schema this maps to (e.g. 'Query')
            const operationTypeName = operationFieldNameToTypeMap[operationName];
            // enqueue this root
            queue.push({ type: operationTypeName, selectionSet: definition.selectionSet });
        });

    invariant(queue.length > 0, 'Expected to find a query or mutation operation in the provided document');

    // Start our DFS iteration cycle
    while (queue.length > 0) {
        const { type, selectionSet } = queue.pop();

        /**
         * Check if there are edges on this field to traverse.
         * If not, we've hit a leaf node (e.g. a primative like String or Int) and won't have any fields)
         */
        // istanbul ignore if: TODO work out when this branch is hit
        if (selectionSet.selections == null) {
            continue;
        }

        selectionSet.selections.forEach((selection) => {
            invariant(selection.kind === 'Field');

            // Add this path to the set
            const fieldName = selection.name.value;
            fieldPaths.add(`${type}.${fieldName}`);

            if (selection.selectionSet != null) {
                const fieldType = typeToFieldsMap[type].find(({ field }) => field === fieldName);
                queue.push({
                    type: fieldType.type,
                    selectionSet: selection.selectionSet,
                });
            }
        });
    }

    return fieldPaths;
}
