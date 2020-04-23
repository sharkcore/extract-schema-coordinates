module.exports = {
    collectCoverage: true,
    collectCoverageFrom: ['<rootDir>/src/**/*.js', '!<rootDir>/src/index.js'],
    coverageThreshold: {
        global: {
            branches: 100,
            functions: 100,
            lines: 100,
            statements: 100,
        },
    },
};
