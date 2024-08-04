import { ObjectId } from 'mongodb';
import sha1 from 'sha1';
import dbClient from '../utils/db.js';

class UsersController {
  static async postNew(req, res) {
    const { email, password } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Missing email' });
    }
    if (!password) {
      return res.status(400).json({ error: 'Missing password' });
    }

    const userCollection = dbClient.db.collection('users');
    const existingUser = await userCollection.findOne({ email });

    if (existingUser) {
      return res.status(400).json({ error: 'Already exist' });
    }

    const hashedPassword = sha1(password);
    const newUser = { email, password: hashedPassword };

    const result = await userCollection.insertOne(newUser);
    const userId = result.insertedId;

    return res.status(201).json({ id: userId, email });
  }
}

export default UsersController;
