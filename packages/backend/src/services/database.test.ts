import { describe, it, expect } from 'vitest'
import { DatabaseService, TestDatabaseService } from './database'
import { Effect as E } from 'effect'

describe('DatabaseService', () => {
  it('should create a test database service', () => {
    expect(TestDatabaseService).toBeDefined()
  })

  it('should have the correct service interface', async () => {
    const program = E.gen(function* () {
      const db = yield* DatabaseService
      const result = yield* db.query('SELECT 1')
      return result
    })

    const result = await E.runPromise(
      program.pipe(E.provide(TestDatabaseService)),
    )

    expect(result).toEqual([])
  })

  it('should handle close operation', async () => {
    const program = E.gen(function* () {
      const db = yield* DatabaseService
      yield* db.close()
      return 'closed'
    })

    const result = await E.runPromise(
      program.pipe(E.provide(TestDatabaseService)),
    )

    expect(result).toBe('closed')
  })
})
