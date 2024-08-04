import { ObjectId } from 'mongodb';
import { promises as fs } from 'fs';
import mime from 'mime-types';
import dbClient from '../utils/db.js';
import redisClient from '../utils/redis.js';
import Bull from 'bull';

const fileQueue = new Bull('fileQueue');

class FilesController {
  static async postUpload(req, res) {
    const token = req.headers['x-token'];
    const { name, type, parentId = 0, isPublic = false, data } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Missing name' });
    }
    if (!type || !['folder', 'file', 'image'].includes(type)) {
      return res.status(400).json({ error: 'Missing type' });
    }
    if (type !== 'folder' && !data) {
      return res.status(400).json({ error: 'Missing data' });
    }

    const userId = await redisClient.get(`auth_${token}`);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const userCollection = dbClient.db.collection('users');
    const user = await userCollection.findOne({ _id: new ObjectId(userId) });
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const fileCollection = dbClient.db.collection('files');
    if (parentId !== 0) {
      const parentFile = await fileCollection.findOne({ _id: new ObjectId(parentId) });
      if (!parentFile) {
        return res.status(400).json({ error: 'Parent not found' });
      }
      if (parentFile.type !== 'folder') {
        return res.status(400).json({ error: 'Parent is not a folder' });
      }
    }

    const fileDocument = {
      userId: new ObjectId(userId),
      name,
      type,
      isPublic,
      parentId: parentId === 0 ? 0 : new ObjectId(parentId),
      localPath: '',
    };

    if (type === 'folder') {
      await fileCollection.insertOne(fileDocument);
      return res.status(201).json({
        id: fileDocument._id,
        userId: fileDocument.userId,
        name: fileDocument.name,
        type: fileDocument.type,
        isPublic: fileDocument.isPublic,
        parentId: fileDocument.parentId,
      });
    }

    const folderPath = process.env.FOLDER_PATH || '/tmp/files_manager';
    await fs.mkdir(folderPath, { recursive: true });

    const fileBuffer = Buffer.from(data, 'base64');
    const fileName = `${folderPath}/${uuidv4()}`;
    await fs.writeFile(fileName, fileBuffer);

    fileDocument.localPath = fileName;
    await fileCollection.insertOne(fileDocument);

    if (type === 'image') {
      await fileQueue.add({ userId, fileId: fileDocument._id.toString() });
    }

    return res.status(201).json({
      id: fileDocument._id,
      userId: fileDocument.userId,
      name: fileDocument.name,
      type: fileDocument.type,
      isPublic: fileDocument.isPublic,
      parentId: fileDocument.parentId,
      localPath: fileDocument.localPath,
    });
  }

  static async getFile(req, res) {
    const { id } = req.params;
    const { size } = req.query;
    const token = req.headers['x-token'];

    if (!ObjectId.isValid(id)) {
      return res.status(404).json({ error: 'Not found' });
    }

    const fileCollection = dbClient.db.collection('files');
    const file = await fileCollection.findOne({ _id: new ObjectId(id) });

    if (!file) {
      return res.status(404).json({ error: 'Not found' });
    }

    if (!file.isPublic) {
      const userId = await redisClient.get(`auth_${token}`);
      if (!userId || userId !== file.userId.toString()) {
        return res.status(404).json({ error: 'Not found' });
      }
    }

    if (file.type === 'folder') {
      return res.status(400).json({ error: "A folder doesn't have content" });
    }

    let filePath = file.localPath;
    if (size) {
      const sizes = [100, 250, 500];
      if (!sizes.includes(parseInt(size))) {
        return res.status(400).json({ error: 'Invalid size' });
      }
      filePath = `${file.localPath}_${size}`;
    }

    try {
      const fileContent = await fs.readFile(filePath);
      const mimeType = mime.lookup(file.name) || 'application/octet-stream';
      res.setHeader('Content-Type', mimeType);
      return res.send(fileContent);
    } catch (error) {
      return res.status(404).json({ error: 'Not found' });
    }
  }
}

export default FilesController;
