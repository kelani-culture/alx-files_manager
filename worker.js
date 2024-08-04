#!/usr/bin/node
import Bull from 'bull';
import { dbClient } from './utils/db.js';
import redisClient from './utils/redis.js';
import imageThumbnail from 'image-thumbnail';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

// Define queues
const fileQueue = new Bull('fileQueue', {
  redis: {
    host: 'localhost',
    port: 6379
  }
});

const userQueue = new Bull('userQueue', {
  redis: {
    host: 'localhost',
    port: 6379
  }
});

// Process the fileQueue for thumbnail generation
fileQueue.process(async (job) => {
  const { userId, fileId } = job.data;

  if (!fileId || !userId) {
    throw new Error('Missing fileId or userId');
  }

  const file = await dbClient.db.collection('files').findOne({ _id: new ObjectId(fileId), userId });
  
  if (!file) {
    throw new Error('File not found');
  }

  if (file.type !== 'image') {
    throw new Error('File is not an image');
  }

  const { localPath } = file;

  try {
    const thumbnailSizes = [500, 250, 100];
    const promises = thumbnailSizes.map(async (size) => {
      const thumbnail = await imageThumbnail(localPath, { width: size });
      const thumbnailPath = `${localPath}_${size}`;
      fs.writeFileSync(thumbnailPath, thumbnail);
    });
    
    await Promise.all(promises);
  } catch (error) {
    throw new Error('Error generating thumbnails: ' + error.message);
  }
});

// Process the userQueue for sending welcome emails
userQueue.process(async (job) => {
  const { userId } = job.data;

  if (!userId) {
    throw new Error('Missing userId');
  }

  const user = await dbClient.db.collection('users').findOne({ _id: new ObjectId(userId) });
  
  if (!user) {
    throw new Error('User not found');
  }

  console.log(`Welcome ${user.email}!`);
});

export { fileQueue, userQueue };
