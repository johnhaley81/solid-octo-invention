import { describe, it, expect } from 'vitest'
import { User, Post, SchemaUtils } from './index'
import { Schema as S } from '@effect/schema'

describe('Schemas', () => {
  describe('User', () => {
    it('should validate a valid user', () => {
      const validUser = {
        id: 'user_123',
        email: 'test@example.com',
        name: 'Test User',
        createdAt: '2025-06-22T03:00:00.000Z',
        updatedAt: '2025-06-22T03:00:00.000Z',
      }

      const result = S.decodeUnknownSync(User)(validUser)
      expect(result.id).toBe('user_123')
      expect(result.email).toBe('test@example.com')
      expect(result.name).toBe('Test User')
      expect(result.createdAt).toBeInstanceOf(Date)
      expect(result.updatedAt).toBeInstanceOf(Date)
    })

    it('should reject invalid user data', () => {
      const invalidUser = {
        id: 'invalid',
        email: 'not-an-email',
        name: '',
      }

      expect(() => S.decodeUnknownSync(User)(invalidUser)).toThrow()
    })
  })

  describe('Post', () => {
    it('should validate a valid published post', () => {
      const validPost = {
        id: 'post_123',
        title: 'Test Post',
        content: 'This is a test post',
        slug: 'test-post',
        status: 'published' as const,
        authorId: 'user_123',
        publishedAt: '2025-06-22T03:00:00.000Z',
        createdAt: '2025-06-22T03:00:00.000Z',
        updatedAt: '2025-06-22T03:00:00.000Z',
      }

      const result = S.decodeUnknownSync(Post)(validPost)
      expect(result.id).toBe('post_123')
      expect(result.title).toBe('Test Post')
      expect(result.status).toBe('published')
      expect(result.publishedAt).toBeInstanceOf(Date)
    })

    it('should validate a valid draft post', () => {
      const validPost = {
        id: 'post_123',
        title: 'Test Post',
        content: 'This is a test post',
        slug: 'test-post',
        status: 'draft' as const,
        authorId: 'user_123',
        publishedAt: null,
        createdAt: '2025-06-22T03:00:00.000Z',
        updatedAt: '2025-06-22T03:00:00.000Z',
      }

      const result = S.decodeUnknownSync(Post)(validPost)
      expect(result.id).toBe('post_123')
      expect(result.title).toBe('Test Post')
      expect(result.status).toBe('draft')
      expect(result.publishedAt).toBe(null)
    })

    it('should reject invalid post data', () => {
      const invalidPost = {
        id: 'invalid',
        title: '',
        status: 'invalid-status',
      }

      expect(() => S.decodeUnknownSync(Post)(invalidPost)).toThrow()
    })
  })

  describe('SchemaUtils', () => {
    it('should create user IDs', () => {
      const userId = SchemaUtils.createUserId('user_123')
      expect(userId).toBe('user_123')
    })

    it('should create post IDs', () => {
      const postId = SchemaUtils.createPostId('post_123')
      expect(postId).toBe('post_123')
    })
  })
})
