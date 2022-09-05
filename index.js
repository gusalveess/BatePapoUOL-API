import express from 'express';
import { MongoClient, ObjectId } from 'mongodb';
import { stripHtml } from 'string-strip-html';
import cors from 'cors';
import dayjs from 'dayjs';
import joi from 'joi';
import dotenv from 'dotenv';

dotenv.config();

const server = express();
server.use(cors());
server.use(express.json());

const participantSchema = joi.object({
  name: joi.string().required(),
});

const messageSchema = joi.object({
  to: joi.string().required(),
  text: joi.string().required(),
  type: joi.valid('message', 'private_message').required(),
});

const mongoClient = new MongoClient(process.env.MONGO_URI);
let db;
mongoClient.connect(() => {
  db = mongoClient.db("batePapo-uol");
});

setInterval(async () => {
    const participants = await db.collection('participants').find().toArray();
  
    participants.forEach(async participant => {
      if (Date.now() - participant.lastStatus > 10000) {
        await db.collection('participants').deleteOne({ _id: participant._id });
        await db.collection('messages').insertOne({
          from: participant.name,
          to: "Todos",
          text: "sai da sala...",
          type: "status",
          time: dayjs().format('HH:mm:ss')
        });
      }
    });
  }, 15000);
  
  server.post('/participants', async (req, res) => {
    const { name } = req.body;
  
    const validation = participantSchema.validate(req.body, { abortEarly: false });
  
    if (validation.error) {
      return res.status(422).send(validation.error.details.map(error => error.message));
    }
  
    try {
      const isRegistered = await db.collection('participants').findOne({ name: name });
  
      if (isRegistered) {
        return res.sendStatus(409);
      }
  
      await db.collection('participants').insertOne({
        name: stripHtml(name).result.trim(),
        lastStatus: Date.now()
      });
  
      await db.collection('messages').insertOne({
        from: stripHtml(name).result.trim(),
        to: "Todos",
        text: "entra na sala...",
        type: "status",
        time: dayjs().format('HH:mm:ss')
      });
  
      res.sendStatus(201);
  
    } catch (error) {
      console.error(error);
      res.sendStatus(500);
    }
  });
  
  server.get('/participants', async (req, res) => {
    try {
      const participants = await db.collection('participants').find().toArray();
  
      res.status(200).send(participants);
  
    } catch (error) {
      console.error(error);
      res.sendStatus(500);
    }
  });
  
  server.post('/messages', async (req, res) => {
    const { to, text, type } = req.body;
    const { user } = req.headers;
  
    try {
      const isOnline = await db.collection('participants').findOne({ name: user });
  
      if (!isOnline) {
        return res.sendStatus(422);
      }
  
      const validation = messageSchema.validate(req.body, { abortEarly: false });
  
      if (validation.error) {
        return res.status(422).send(validation.error.details.map(error => error.message));
      }
  
      await db.collection('messages').insertOne({
        from: stripHtml(user).result.trim(),
        to: stripHtml(to).result.trim(),
        text: stripHtml(text).result.trim(),
        type: stripHtml(type).result.trim(),
        time: dayjs().format('HH:mm:ss')
      });
  
      res.sendStatus(201);
  
    } catch (error) {
      console.error(error);
      res.sendStatus(500);
    }
  });
  
  server.get('/messages', async (req, res) => {
    const { user } = req.headers;
    const limit = parseInt(req.query.limit);
  
    try {
      const filteredMessages = await db.collection('messages').find({ $or: [{ from: user }, { to: user }, { to: 'Todos' }] }).toArray();
  
      if (limit === undefined) {
        return res.status(200).send(filteredMessages);
      }
  
      res.status(200).send(filteredMessages.slice(filteredMessages.length - limit, filteredMessages.length));
  
    } catch (error) {
      console.error(error);
      res.sendStatus(500);
    }
  });
  
  server.post('/status', async (req, res) => {
    const { user } = req.headers;
  
    try {
      const participants = await db.collection('participants').find({}).toArray();
      const isOnline = participants.find(participant => participant.name === user);
  
      if (!isOnline) {
        return res.sendStatus(404);
      }
  
      await db.collection('participants').updateOne({ name: user }, { $set: { lastStatus: Date.now() } });
  
      res.sendStatus(200);
  
    } catch (error) {
      console.error(error);
      res.sendStatus(500);
    }
  });
  
  server.put('/messages/:id', async (req, res) => {
    const { to, text, type } = req.body;
    const { user } = req.headers;
    const { id } = req.params;
  
    try {
      const validation = messageSchema.validate(req.body, { abortEarly: false });
  
      if (validation.error) {
        return res.status(422).send(validation.error.details.map(error => error.message));
      }
  
      const message = await db.collection('messages').findOne({ _id: new ObjectId(id) });
  
      if (!message) {
        return res.sendStatus(404);
      } else if (message.from !== user) {
        return res.sendStatus(401);
      }
  
      await db.collection('messages').updateOne(
        { _id: message._id },
        {
          $set: {
            to: stripHtml(to).result.trim(),
            text: stripHtml(text).result.trim(),
            type: stripHtml(type).result.trim(),
            time: dayjs().format('HH:mm:ss')
          }
        }
      );
  
      response.sendStatus(200);
  
    } catch (error) {
      console.error(error);
      res.sendStatus(500);
    }
  });
  
  server.delete('/messages/:id', async (req, res) => {
    const { user } = req.headers;
    const { id } = req.params;
  
    try {
      const message = await db.collection('messages').findOne({ _id: new ObjectId(id) });
  
      if (!message) {
        return res.sendStatus(404);
      } else if (message.from !== user) {
        return res.sendStatus(401);
      }
  
      await db.collection('messages').deleteOne({ _id: new ObjectId(id) });
  
      res.sendStatus(200);
  
    } catch (error) {
      console.error(error);
      res.sendStatus(500);
    }
  
  });
  
  server.listen(5000);