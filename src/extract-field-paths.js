// @flow

import util from 'util';
import invariant from 'assert';
import memoize from 'lodash.memoize';
import {
    getOperationRootType,
    parse as _parse,
    buildSchema as _buildSchema,
    type SelectionNode,
    type SelectionSetNode,
} from 'graphql';

/**
 * A memoized version of graphql's parse function
 * @see https://graphql.org/graphql-js/language/#parse
 */
const parse = memoize(_parse);

/**
 * A memoized version of graphql's parse function
 * @see https://graphql.org/graphql-js/utilities/#buildschema
 */
const buildSchema = memoize(_buildSchema);

/**
 * Recursively unwrap a type object to get the human readable type name
 * TODO: Replace this with getNamedType from graphql-js
 */
function getTypeNameFromType(type): string {
    if (type.type != null) {
        return getTypeNameFromType(type.type);
    }

    // Tell flow that we exhausted the search for the NamedType
    invariant(type.kind === 'NamedType', `Expected ${util.inspect(type)} to be a NamedType`);

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
    // Turn the provided schema text (SDL) into a GraphQLSchema object and AST
    const builtSchema = buildSchema(schemaText);

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

    for (const typeName in builtSchema.getTypeMap()) {
        // Awkwardly using for...in syntax instead of Object.entires or something functional to preserve typing
        // (`Object.entires` et al currently gobbles up in type information in Flow)
        const type = builtSchema.getTypeMap()[typeName];

        // Initialize the entry for the type in typeToFieldsMap
        typeToFieldsMap[type.name] = [];

        // Check if the field has types
        if (typeof type.getFields !== 'function') {
            continue;
        }

        // Loop through the fields on the type to add to the fields array in typeToFieldsMap
        for (let fieldName in type.getFields()) {
            // Awkwardly using for...in syntax instead of Object.entires or something functional to preserve typing
            // (`Object.entires` et al currently gobbles up in type information in Flow)
            const field = type.getFields()[fieldName];

            // Not every field has an astNode attatched (e.g. __Schema's fields)
            if (field.astNode != null) {
                typeToFieldsMap[type.name].push({
                    field: field.name,
                    type: getTypeNameFromType(field.astNode.type),
                });
            }
        }
    }

    const documentAst = parse(documentText);
    const fieldPaths = new Set<string>();

    // define a queue for use in our dfs search of the document ast
    const queue: Array<{| type: string, selectionSet: SelectionSetNode |}> = [];

    // Enqueue the roots of the document
    documentAst.definitions.forEach((definition) => {
        /**
         * The root of a query, subscription or mutation operation. Example:
         *
         *     query GET_CAT_FACTS {
         *         ...
         *     }
         */
        if (definition.kind === 'OperationDefinition') {
            const { name: typeName } = getOperationRootType(builtSchema, definition);
            queue.push({ type: typeName, selectionSet: definition.selectionSet });
        }

        /**
         * A fragment definition. We will also add this root to the queue. Example:
         *
         *     fragment doggoDetails on Dog {
         *         name
         *         breed
         *     }
         */
        if (definition.kind === 'FragmentDefinition') {
            const typeName = definition.typeCondition.name.value;
            queue.push({ type: typeName, selectionSet: definition.selectionSet });
        }
    });

    invariant(queue.length > 0, 'Expected to find a query or mutation operation in the provided document');

    // Start our DFS iteration cycle
    while (queue.length > 0) {
        const { type, selectionSet } = queue.pop();

        selectionSet.selections.forEach((selection: SelectionNode) => {
            /**
             * `selection` could be:
             * - Field (e.g. `Parrot.wingSpan`)
             * - InlineFragment (e.g. `... on Parrot`)
             * - FragmentSpread (e.g. `...parrotFacts`)
             *
             * @see https://github.com/graphql/graphql-js/blob/278bd/src/language/ast.js#L287
             */

            if (selection.kind === 'InlineFragment') {
                /**
                 * TODO: Work out if this will ever not be the case?
                 * It's unclear why typeCondition is a maybe type.
                 * @see https://github.com/graphql/graphql-js/blob/278bde/src/language/ast.js#L318
                 */
                invariant(
                    selection.typeCondition != null,
                    "Inline fragment doesn't appear to have a type conition set",
                );
                queue.push({ type: selection.typeCondition.name.value, selectionSet: selection.selectionSet });
                return;
            }

            const fieldName = selection.name.value;

            // TODO: Add an option to allow fragment names to show up as attributes?
            if (selection.kind !== 'FragmentSpread') {
                // Add this path to the set
                fieldPaths.add(`${type}.${fieldName}`);
            }

            if (selection.selectionSet != null) {
                /**
                 * Now that we have a field path - e.g `Business.reviews`, we need to look at
                 * `typeToFieldsMap`, to see what attributes `Business` has. This will tell us
                 * what _type_ the `reviews` resolver will return (`Review`).
                 */
                const typeAttributes = typeToFieldsMap[type];

                /**
                 * It's possible that nothing exists in the lookup map we created from the schema.
                 * This means either:
                 * - The schema is invalid for this document (could be outdated)
                 * - The document is invalid for this schema (could be outdated)
                 *
                 * We're going to default to coping with this and ignoring it.
                 *
                 * TODO: add an option to throw an error in this case, rather than gobble this up.
                 */
                if (typeAttributes == null) {
                    return;
                }

                /**
                 * Check what _type_ `Foo.bar` returns
                 */
                const fieldType = typeAttributes.find(({ field }) => field === fieldName);

                if (fieldType == null) {
                    /**
                     * If `fieldType` is null, that means we couldn't find the attribute 'bar' of 'Foo' in `typeToFieldsMap`.
                     * This means that the field we're referencing doesn't exist in the schema.
                     *
                     * This means either:
                     * - The schema is invalid for this document (could be outdated)
                     * - The document is invalid for this schema (could be outdated)
                     *
                     * TODO: add an option to throw an error in this case
                     */
                } else {
                    /**
                     * Check if there are edges on this field to traverse.
                     * If not, we've hit a leaf node (e.g. a primative like String or Int) and won't have any fields)
                     */
                    /* istanbul ignore else: is the else branch ever hit?? */
                    if (selection.selectionSet != null) {
                        queue.push({
                            type: fieldType.type,
                            selectionSet: selection.selectionSet,
                        });
                    }
                }
            }
        });
    }

    return fieldPaths;
}
