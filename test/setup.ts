// Imported first by tests: ES module imports are hoisted, so env must be set in its own module
process.env.DATABASE_PATH = ':memory:'
process.env.CONFIDENCE_THRESHOLD = '0.8'
