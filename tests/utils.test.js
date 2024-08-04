import { expect } from 'chai';
import sinon from 'sinon';
import redisClient from '../utils/redis.js';
import dbClient from '../utils/db.js';

describe('Redis Client', () => {
  it('should return true if Redis is alive', async () => {
    const isAlive = await redisClient.isAlive();
    expect(isAlive).to.be.true;
  });

  it('should set and get values from Redis', async () => {
    await redisClient.set('test_key', 'test_value', 10);
    const value = await redisClient.get('test_key');
    expect(value).to.equal('test_value');
  });

  it('should delete values from Redis', async () => {
    await redisClient.set('test_key', 'test_value', 10);
    await redisClient.del('test_key');
    const value = await redisClient.get('test_key');
    expect(value).to.be.null;
  });
});

describe('DB Client', () => {
  it('should return true if MongoDB is alive', async () => {
    const isAlive = await dbClient.isAlive();
    expect(isAlive).to.be.true;
  });

  it('should return the number of users in the database', async () => {
    const nbUsers = await dbClient.nbUsers();
    expect(nbUsers).to.be.a('number');
  });

  it('should return the number of files in the database', async () => {
    const nbFiles = await dbClient.nbFiles();
    expect(nbFiles).to.be.a('number');
  });
});
