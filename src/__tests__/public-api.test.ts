import { Type as t } from '@sinclair/typebox'
import { describe, expect, it } from 'vitest'
import { Norte } from '../norte'
import { Router } from '../router'

describe('Public API', () => {
  describe('Norte class', () => {
    it('should only expose register and fetch as public methods', () => {
      const app = new Norte()

      // Get all property names from the instance and its prototype
      const instanceProps = Object.getOwnPropertyNames(app)
      const prototypeProps = Object.getOwnPropertyNames(
        Object.getPrototypeOf(app),
      )
      const allProps = [...new Set([...instanceProps, ...prototypeProps])]

      // Filter to get only public methods (not starting with private indicators)
      const publicMethods = allProps.filter((prop) => {
        // Skip constructor and private properties
        if (prop === 'constructor') return false

        const descriptor =
          Object.getOwnPropertyDescriptor(app, prop) ||
          Object.getOwnPropertyDescriptor(Object.getPrototypeOf(app), prop)

        // Check if it's a method (function)
        const value = descriptor?.value
        return typeof value === 'function'
      })

      // Expected public methods
      const expectedPublicMethods = ['register', 'fetch']

      // Check that only expected methods are public
      expect(publicMethods.sort()).toEqual(expectedPublicMethods.sort())
    })

    it('should have register method that accepts a Router', () => {
      const app = new Norte()
      const userSchema = t.Object({
        id: t.String(),
        name: t.String(),
      })
      const router = new Router('users', { schema: userSchema })

      expect(() => app.register(router)).not.toThrow()
      expect(typeof app.register).toBe('function')
    })

    it('should have fetch method that accepts a Request', async () => {
      const app = new Norte()
      const userSchema = t.Object({
        id: t.String(),
        name: t.String(),
      })
      const router = new Router('users', { schema: userSchema })
      router.list({}, async () => [])

      app.register(router)

      const req = new Request('http://localhost/v1/users', { method: 'GET' })
      const res = await app.fetch(req)

      expect(typeof app.fetch).toBe('function')
      expect(res).toBeInstanceOf(Response)
    })
  })

  describe('Router class', () => {
    it('should only expose create, custom, list, read, delete and update as public methods', () => {
      const userSchema = t.Object({
        id: t.String(),
        name: t.String(),
      })
      const router = new Router('users', { schema: userSchema })

      // Get all property names from the instance and its prototype
      const instanceProps = Object.getOwnPropertyNames(router)
      const prototypeProps = Object.getOwnPropertyNames(
        Object.getPrototypeOf(router),
      )
      const allProps = [...new Set([...instanceProps, ...prototypeProps])]

      // Filter to get only public methods (not starting with private indicators)
      const publicMethods = allProps.filter((prop) => {
        // Skip constructor and static methods
        if (prop === 'constructor') return false

        const descriptor =
          Object.getOwnPropertyDescriptor(router, prop) ||
          Object.getOwnPropertyDescriptor(Object.getPrototypeOf(router), prop)

        // Check if it's a method (function)
        const value = descriptor?.value
        return typeof value === 'function'
      })

      // Expected public methods
      const expectedPublicMethods = [
        'create',
        'custom',
        'list',
        'read',
        'delete',
        'update',
      ]

      // Check that only expected methods are public
      expect(publicMethods.sort()).toEqual(expectedPublicMethods.sort())
    })

    it('should have all CRUD methods working', () => {
      const userSchema = t.Object({
        id: t.String(),
        name: t.String(),
      })
      const router = new Router('users', { schema: userSchema })

      // Test that all methods exist and return the router instance (for chaining)
      expect(typeof router.list).toBe('function')
      expect(typeof router.create).toBe('function')
      expect(typeof router.read).toBe('function')
      expect(typeof router.update).toBe('function')
      expect(typeof router.delete).toBe('function')
      expect(typeof router.custom).toBe('function')

      // Test method chaining
      const result = router
        .list({}, async () => [])
        .create({}, async () => ({ id: '1', name: 'test' }))
        .read({}, async () => ({ id: '1', name: 'test' }))
        .update({}, async () => ({ id: '1', name: 'test' }))
        .delete({}, async () => ({ id: '1', name: 'test' }))
        .custom('GET', '/custom', {}, async () => ({ id: '1', name: 'test' }))

      expect(result).toBe(router)
    })
  })
})
