import { ObjectId } from 'mongodb';
import dbClient from '../utils/db.js';
import redisClient from '../utils/redis.js';

class FilesController {
  static async postUpload(req, res) {
    const token = req.headers['x-token'];
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const userId = await redisClient.get(`auth_${token}`);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { name, type, parentId = 0, isPublic = false, data } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Missing name' });
    }

    if (!['folder', 'file', 'image'].includes(type)) {
      return res.status(400).json({ error: 'Missing type' });
    }

    if (type !== 'folder' && !data) {
      return res.status(400).json({ error: 'Missing data' });
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

    const newFile = {
      userId,
      name,
      type,
      isPublic,
      parentId,
    };

    if (type === 'folder') {
      await fileCollection.insertOne(newFile);
      return res.status(201).json(newFile);
    }

    const folderPath = process.env.FOLDER_PATH || '/tmp/files_manager';
    const localPath = path.join(folderPath, uuidv4());

    try {
      await fs.mkdir(folderPath, { recursive: true });
      await fs.writeFile(localPath, Buffer.from(data, 'base64'));
    } catch (error) {
      return res.status(500).json({ error: 'Cannot store the file' });
    }

    newFile.localPath = localPath;
    await fileCollection.insertOne(newFile);

    return res.status(201).json(newFile);
  }

  static async getShow(req, res) {
    const token = req.headers['x-token'];
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const userId = await redisClient.get(`auth_${token}`);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(404).json({ error: 'Not found' });
    }

    const fileCollection = dbClient.db.collection('files');
    const file = await fileCollection.findOne({ _id: new ObjectId(id), userId });

    if (!file) {
      return res.status(404).json({ error: 'Not found' });
    }

    return res.status(200).json(file);
  }

  static async getIndex(req, res) {
    const token = req.headers['x-token'];
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const userId = await redisClient.get(`auth_${token}`);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { parentId = 0, page = 0 } = req.query;
    const pageSize = 20;

    const fileCollection = dbClient.db.collection('files');
    const files = await fileCollection.find({ parentId, userId })
      .skip(page * pageSize)
      .limit(pageSize)
      .toArray();

    return res.status(200).json(files);
  }

  static async putPublish(req, res) {
    const token = req.headers['x-token'];
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const userId = await redisClient.get(`auth_${token}`);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(404).json({ error: 'Not found' });
    }

    const fileCollection = dbClient.db.collection('files');
    const file = await fileCollection.findOne({ _id: new ObjectId(id), userId });

    if (!file) {
      return res.status(404).json({ error: 'Not found' });
    }

    await fileCollection.updateOne({ _id: new ObjectId(id) }, { $set: { isPublic: true } });
    const updatedFile = await fileCollection.findOne({ _id: new ObjectId(id), userId });

    return res.status(200).json(updatedFile);
  }

  static async putUnpublish(req, res) {
    const token = req.headers['x-token'];
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const userId = await redisClient.get(`auth_${token}`);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(404).json({ error: 'Not found' });
    }

    const fileCollection = dbClient.db.collection('files');
    const file = await fileCollection.findOne({ _id: new ObjectId(id), userId });

    if (!file) {
      return res.status(404).json({ error: 'Not found' });
    }

    await fileCollection.updateOne({ _id: new ObjectId(id) }, { $set: { isPublic: false } });
    const updatedFile = await fileCollection.findOne({ _id: new ObjectId(id), userId });

    return res.status(200).json(updatedFile);
  }

}

export default FilesController;
