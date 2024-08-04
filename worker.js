import Bull from 'bull';
import { promises as fs } from 'fs';
import imageThumbnail from 'image-thumbnail';
import dbClient from './utils/db.js';

const fileQueue = new Bull('fileQueue');

fileQueue.process(async (job) => {
  const { userId, fileId } = job.data;

  if (!fileId) {
    throw new Error('Missing fileId');
  }
  if (!userId) {
    throw new Error('Missing userId');
  }

  const fileCollection = dbClient.db.collection('files');
  const file = await fileCollection.findOne({
    _id: new ObjectId(fileId),
    userId: new ObjectId(userId),
  });

  if (!file) {
    throw new Error('File not found');
  }

  const sizes = [500, 250, 100];
  const options = { width: 100 };

  for (const size of sizes) {
    try {
      options.width = size;
      const thumbnail = await imageThumbnail(file.localPath, options);
      const thumbnailPath = `${file.localPath}_${size}`;
      await fs.writeFile(thumbnailPath, thumbnail);
    } catch (error) {
      throw new Error(`Error generating thumbnail: ${error.message}`);
    }
  }
});
