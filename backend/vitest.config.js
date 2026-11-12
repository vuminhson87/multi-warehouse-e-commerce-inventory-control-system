import { defineConfig, configDefaults } from 'vitest/config'
export default defineConfig({ test: { exclude: [...configDefaults.exclude, ...(process.env.ACCEPTANCE_DB_TEST === '1' ? [] : ['tests/acceptance/**'])] } })
