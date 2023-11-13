module.exports = {
    collectCoverage: true,
    coverageThreshold: {
        global: {
            branches: 100,
            functions: 100,
            lines: 100,
            statements: 100,
        },
    },
    "transform": {
        "\\.ts$": [
            "ts-jest",
            {
                "useESM": true
            }
        ]
    },
    preset: 'ts-jest/presets/default-esm',
    moduleNameMapper: {
        '^(\\.{1,2}/.*)\\.ts$': '$1',
    },
};