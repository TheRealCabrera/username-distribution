'use strict'

const assert = require('assert')
const log = require('barelog')
const config = require('../config')
const cache = require('./cache')
const { promisify } = require('util')

const cacheGet = promisify(cache.get).bind(cache);
const cacheSet = promisify(cache.set).bind(cache);
const cacheDel = promisify(cache.del).bind(cache);

/**
 * Data cached for a given User object
 * @typedef {Object} UserCacheEntry
 * @property {Date} assignedTs
 * @property {string} username
 * @property {string} email
 * @property {string} disabled
 * @property {string} ip
 */

class User {
  /**
   * Create a user with the given index/number
   * @param {number} num
   */
  constructor (num) {
    if (num < 10 && config.accounts.padZeroes) {
      this.username = `${config.accounts.prefix}0${num}`
    } else {
      this.username = `${config.accounts.prefix}${num}`;
    }

    this.cacheKey = `user:${this.username}`
  }

  /**
   * @returns {UserCacheEntry|undefined}
   */
  async _getCachedData () {
    const result = await cacheGet(this.cacheKey)

    if (result) {
      const data = JSON.parse(result)

      return data
    } else {
      // Just return some defaults
      return {
        username: this.username
      }
    }
  }

  async _setDisabled (disabled) {
    const data = await this._getCachedData()

    await this._setCachedData(data.assignedTs, data.ip, data.realname, disabled)
  }

  async enable () {
    // This will allow the user to be assigned
    await this._setDisabled(false)
  }

  async disable () {
    // This will force the user to be unassigned and set disabled to true
    await this._setDisabled(true)
  }

  /**
   * Store data for this user in the cache
   * @param {string} assignedTs
   * @param {string} ip
   * @param {string} email
   */
  async _setCachedData (assignedTs, ip, email, disabled) {
    const data = {
      assignedTs,
      ip,
      disabled,
      email,
      username: this.username
    }

    log(`setting cached data for user ${this.username} to:`, data)
    await cacheSet(this.cacheKey, JSON.stringify(data))
  }

  /**
   * Retrieve the data for this user from cache
   * @returns {UserCacheEntry}
   */
  async getUserInfo () {
    const data = await this._getCachedData()

    return {
      ...data
    }
  }

  async isAssignable () {
    const data = await this._getCachedData()
    log(`checking if ${this.username} is assignable`, data)
    if (data && !data.assignedTs && !data.disabled) {
      return true
    } else {
      return false
    }
  }

  /**
   * Determines if this user has been assigned to someone
   */
  async isAssigned () {
    log(`checking if user ${this.username} is assigned`)
    const data = await this._getCachedData()

    if (data && data.assignedTs) {
      log(`${this.username} is assigned`)
      return true
    } else {
      log(`${this.username} is not assigned`)
      return false
    }
  }

  /**
   * Assigns this lab user to an application user requesting an account
   * @param {string} ip
   * @param {string} realname
   */
  async assign (ip, email) {
    assert(ip, 'User assignment requires an IP parameter')
    assert(email, 'User assignment requires an email parameter')

    await this._setCachedData(new Date().toJSON(), ip, email)
  }

  /**
   * Frees this user for reassignment.
   * Reads the user state to ensure the "disabled" flag is respected
   */
  async unassign () {
    const data = await this._getCachedData()

    this._setCachedData(null, null, null, data.disabled || false)
  }
}

module.exports = User
