import util from 'node:util';
import assert from 'node:assert';
import memoize from 'lodash.memoize';
import {
    parse as _parse,
    buildSchema as _buildSchema,
    GraphQLError,
    Kind,
    isObjectType,
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

const builtInScalars = new Set(['Int', 'Float', 'String', 'Boolean', 'ID']);

/**
 * Recursively unwrap a type object to get the human readable type name
 * TODO: Replace this with getNamedType from graphql-js
 */
function getTypeNameFromType(type: any): string {
    if (type.type != null) {
        return getTypeNameFromType(type.type);
    }

    // Tell flow that we exhausted the search for the NamedType
    assert(type.kind === 'NamedType', `Expected ${util.inspect(type)} to be a NamedType`);

    return type.name.value;
}

/**
 * Extracts a list of schema "coordinates" contained in a GraphQL document.

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
export default function extractSchemaCoordinates(
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
    const typeToFieldsMap: Record<string, Array<{ field: string; type: string }>> = {};

    Object.values(builtSchema.getTypeMap()).forEach(type => {
        if (!isObjectType(type)) return;

        typeToFieldsMap[type.name] = Object.values(type.getFields())
            .filter(field => field.astNode != null) // Not every field has an astNode attatched (e.g. __Schema)
            .map(field => ({
                field: field.name,
                type: getTypeNameFromType(field?.astNode?.type),
            }));
    });

    const documentAst = parse(documentText);
    const schemaCoordinates = new Set<string>();

    // define a queue for use in our dfs search of the document ast
    const queue: Array<{ type: string; selectionSet: SelectionSetNode }> = [];

    // Enqueue the roots of the document
    documentAst.definitions.forEach(definition => {
        /**
         * The root of a query, subscription or mutation operation. Example:
         *
         *     query GET_CAT_FACTS {
         *         ...
         *     }
         */
        if (definition.kind === 'OperationDefinition') {
            const rootType = builtSchema.getRootType(definition.operation);
            if (rootType == null) {
                throw new GraphQLError(`Schema is not configured to execute ${definition.operation} operation.`, {
                    nodes: definition,
                });
            }

            queue.push({ type: rootType.name, selectionSet: definition.selectionSet });

            // Any inputs should show up as a schema coordinate, and will be defined in the operation ast node.
            /* istanbul ignore next: I think the else branch always returns an array, but TS tells me it's nullable. */
            (definition.variableDefinitions ?? []).forEach(variable => {
                const variableTypeName = getTypeNameFromType(variable);
                // don't add built-in scalar input types
                if (!builtInScalars.has(variableTypeName)) {
                    schemaCoordinates.add(variableTypeName);
                }
            });
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

    assert(queue.length > 0, 'Expected to find a query or mutation operation in the provided document');

    // Start our DFS iteration cycle
    while (queue.length > 0) {
        const { type, selectionSet } = queue.pop() as NonNullable<ReturnType<typeof queue.pop>>;

        selectionSet.selections.forEach((selection: SelectionNode) => {
            /**
             * `selection` could be:
             * - Field (e.g. `Parrot.wingSpan`)
             * - InlineFragment (e.g. `... on Parrot`)
             * - FragmentSpread (e.g. `...parrotFacts`)
             *
             * @see https://github.com/graphql/graphql-js/blob/2e29180c0bba/src/language/ast.ts#L373
             */
            if (selection.kind === Kind.FRAGMENT_SPREAD) {
                // we don't care about fragment spreads - the definition of the fragment itself will be parsed elsewhere
                return;
            }

            if (selection.kind === Kind.INLINE_FRAGMENT) {
                // Inline fragments may look like this https://spec.graphql.org/October2021/#example-77377
                if (selection.typeCondition == null) {
                    queue.push({ type, selectionSet: selection.selectionSet });
                } else {
                    queue.push({ type: selection.typeCondition.name.value, selectionSet: selection.selectionSet });
                }
                return;
            }

            const fieldName = selection.name.value;

            if (selection.kind === Kind.FIELD) {
                // Add this path to the set
                schemaCoordinates.add(`${type}.${fieldName}`);
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

    return schemaCoordinates;
}
