import { expect } from 'chai';
import request from 'supertest';
import app from '../server.js';  // Ensure this points to your express app

describe('API Endpoints', () => {
  let token;
  let fileId;
  let userId;

  describe('GET /status', () => {
    it('should return the status of Redis and MongoDB', async () => {
      const res = await request(app).get('/status');
      expect(res.status).to.equal(200);
      expect(res.body).to.have.property('redis');
      expect(res.body).to.have.property('db');
    });
  });

  describe('GET /stats', () => {
    it('should return the number of users and files', async () => {
      const res = await request(app).get('/stats');
      expect(res.status).to.equal(200);
      expect(res.body).to.have.property('users');
      expect(res.body).to.have.property('files');
    });
  });

  describe('POST /users', () => {
    it('should create a new user', async () => {
      const res = await request(app)
        .post('/users')
        .send({ email: 'test@example.com', password: 'password123' });
      expect(res.status).to.equal(201);
      expect(res.body).to.have.property('id');
      expect(res.body).to.have.property('email');
      userId = res.body.id;
    });

    it('should return error if email is missing', async () => {
      const res = await request(app)
        .post('/users')
        .send({ password: 'password123' });
      expect(res.status).to.equal(400);
      expect(res.body).to.have.property('error', 'Missing email');
    });

    it('should return error if password is missing', async () => {
      const res = await request(app)
        .post('/users')
        .send({ email: 'test2@example.com' });
      expect(res.status).to.equal(400);
      expect(res.body).to.have.property('error', 'Missing password');
    });

    it('should return error if email already exists', async () => {
      const res = await request(app)
        .post('/users')
        .send({ email: 'test@example.com', password: 'password123' });
      expect(res.status).to.equal(400);
      expect(res.body).to.have.property('error', 'Already exist');
    });
  });

  describe('GET /connect', () => {
    it('should sign in the user and return a token', async () => {
      const res = await request(app)
        .get('/connect')
        .auth('test@example.com', 'password123');
      expect(res.status).to.equal(200);
      expect(res.body).to.have.property('token');
      token = res.body.token;
    });

    it('should return error if credentials are wrong', async () => {
      const res = await request(app)
        .get('/connect')
        .auth('test@example.com', 'wrongpassword');
      expect(res.status).to.equal(401);
      expect(res.body).to.have.property('error', 'Unauthorized');
    });
  });

  describe('GET /disconnect', () => {
    it('should sign out the user', async () => {
      const res = await request(app)
        .get('/disconnect')
        .set('X-Token', token);
      expect(res.status).to.equal(204);
    });

    it('should return error if user is not signed in', async () => {
      const res = await request(app)
        .get('/disconnect')
        .set('X-Token', 'wrongtoken');
      expect(res.status).to.equal(401);
      expect(res.body).to.have.property('error', 'Unauthorized');
    });
  });

  describe('GET /users/me', () => {
    it('should return the authenticated user', async () => {
      const res = await request(app)
        .get('/users/me')
        .set('X-Token', token);
      expect(res.status).to.equal(200);
      expect(res.body).to.have.property('email', 'test@example.com');
      expect(res.body).to.have.property('id', userId);
    });

    it('should return error if user is not authenticated', async () => {
      const res = await request(app)
        .get('/users/me')
        .set('X-Token', 'wrongtoken');
      expect(res.status).to.equal(401);
      expect(res.body).to.have.property('error', 'Unauthorized');
    });
  });

  describe('POST /files', () => {
    it('should upload a new file', async () => {
      const res = await request(app)
        .post('/files')
        .set('X-Token', token)
        .send({ name: 'testfile', type: 'file', data: 'SGVsbG8gd29ybGQ=' }); // Base64 for "Hello world"
      expect(res.status).to.equal(201);
      expect(res.body).to.have.property('id');
      fileId = res.body.id;
    });

    it('should return error if name is missing', async () => {
      const res = await request(app)
        .post('/files')
        .set('X-Token', token)
        .send({ type: 'file', data: 'SGVsbG8gd29ybGQ=' });
      expect(res.status).to.equal(400);
      expect(res.body).to.have.property('error', 'Missing name');
    });

    it('should return error if type is missing', async () => {
      const res = await request(app)
        .post('/files')
        .set('X-Token', token)
        .send({ name: 'testfile', data: 'SGVsbG8gd29ybGQ=' });
      expect(res.status).to.equal(400);
      expect(res.body).to.have.property('error', 'Missing type');
    });

    it('should return error if data is missing for file type', async () => {
      const res = await request(app)
        .post('/files')
        .set('X-Token', token)
        .send({ name: 'testfile', type: 'file' });
      expect(res.status).to.equal(400);
      expect(res.body).to.have.property('error', 'Missing data');
    });
  });

  describe('GET /files/:id', () => {
    it('should return the file document', async () => {
      const res = await request(app)
        .get(`/files/${fileId}`)
        .set('X-Token', token);
      expect(res.status).to.equal(200);
      expect(res.body).to.have.property('id', fileId);
    });

    it('should return error if file not found', async () => {
      const res = await request(app)
        .get('/files/60c72b2f9b1e8a1b88b8c7b1')
        .set('X-Token', token);
      expect(res.status).to.equal(404);
      expect(res.body).to.have.property('error', 'Not found');
    });
  });

  describe('GET /files', () => {
    it('should return a list of files', async () => {
      const res = await request(app)
        .get('/files')
        .set('X-Token', token);
      expect(res.status).to.equal(404);
    })

  });


  describe('GET /files/:id/data', () => {
    it('should return the file content if it exists and is accessible', async () => {
      // Assuming the file is published and exists locally
      const res = await request(app)
        .get(`/files/${fileId}/data`)
        .set('X-Token', token);
      expect(res.status).to.equal(200);
      expect(res.headers['content-type']).to.equal('application/octet-stream'); // Adjust as needed
      // Check if the file content is as expected, e.g., buffer comparison or text check
    });

    it('should return error if file not found', async () => {
      const res = await request(app)
        .get('/files/60c72b2f9b1e8a1b88b8c7b1/data')
        .set('X-Token', token);
      expect(res.status).to.equal(404);
      expect(res.body).to.have.property('error', 'Not found');
    });

    it('should return error if file is not public and user is not authorized', async () => {
      // Assume the file is unpublished or user is not authorized
      const res = await request(app)
        .get(`/files/${fileId}/data`)
        .set('X-Token', token);
      expect(res.status).to.equal(404);
      expect(res.body).to.have.property('error', 'Not found');
    });

    it('should return error if the type is folder', async () => {
      // Assuming we have a folder type file
      const folderId = 'folder123'; // replace with actual folder ID
      const res = await request(app)
        .get(`/files/${folderId}/data`)
        .set('X-Token', token);
      expect(res.status).to.equal(400);
      expect(res.body).to.have.property('error', "A folder doesn't have content");
    });

    it('should return error if the file is not locally present', async () => {
      // Simulate a situation where the file is not locally present
      const res = await request(app)
        .get(`/files/${fileId}/data`)
        .set('X-Token', token);
      expect(res.status).to.equal(404);
      expect(res.body).to.have.property('error', 'Not found');
    });

    it('should return the file content based on the size query parameter', async () => {
      const sizes = [500, 250, 100];
      for (const size of sizes) {
        const res = await request(app)
          .get(`/files/${fileId}/data?size=${size}`)
          .set('X-Token', token);
        expect(res.status).to.equal(200);
        expect(res.headers['content-type']).to.equal('image/jpeg'); // Adjust MIME type as needed
        // Check the file content if necessary
      }
    });

    it('should return error if the requested size file does not exist', async () => {
      const res = await request(app)
        .get(`/files/${fileId}/data?size=999`)
        .set('X-Token', token);
      expect(res.status).to.equal(404);
      expect(res.body).to.have.property('error', 'Not found');
    });
  });

})
