import 'dotenv/config'
import express from 'express';
import { Server } from 'socket.io';
import { createServer } from 'http';
import User from './model.js';
import uniqid from 'uniqid';
import mongoose from 'mongoose';
import { fileURLToPath } from 'url';
import path from 'path';

const PORT = process.env.PORT || 3000;
const app = express();
const server = createServer(app);

const io = new Server(server);
const userMap = new Map();

const { sin, cos, sqrt, atan2 } = Math;
// Maximum distance between users in kilometers
const proximityThreshold = 1;

function radians(degrees) {
  return degrees * Math.PI / 180;
}

function calculateDistance(lat1, lon1, lat2, lon2) {
  // Convert coordinates to radians
  const lat1Rad = radians(lat1);
  const lon1Rad = radians(lon1);
  const lat2Rad = radians(lat2);
  const lon2Rad = radians(lon2);
  
  // Radius of the Earth in kilometers
  const radius = 6371;
  
  // Haversine formula
  // Shortest distance between two points on a sphere
  const dlat = lat2Rad - lat1Rad;
  const dlon = lon2Rad - lon1Rad;
  const a = sin(dlat / 2) ** 2 + cos(lat1Rad) * cos(lat2Rad) * sin(dlon / 2) ** 2;
  const c = 2 * atan2(sqrt(a), sqrt(1 - a));
  const distance = radius * c;
  
  return distance;
}

mongoose.set('strictQuery', false);
const connectionParams = {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}
const mongoURI = process.env.MONGODB_KEY;

mongoose.connect(mongoURI, connectionParams)
.then(() => {
    console.log('Connected to the database ')
  })
  .catch((err) => {
    console.error(`Error connecting to the database. n${err}`);
  });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(express.static(path.join(__dirname, '/public')));

// app.get('/', (req, res) => {
//  res.sendFile(testURL.slice(3));
// }); 

io.on('connection', (socket) => {
  socket.on('location', async (location) => {
    console.log(location);
    const longitude = location.longitude;
    const latitude = location.latitude;
    const username = location.user
    try {
      let flag = false
      const users = await User.find({})
      const socketId = socket.id
      let room = ''
      users.every(async (u) => {
        if (calculateDistance(latitude, longitude, u.latitude, u.longitude) <= proximityThreshold) {
          // join that users room then break
          // console.log('for the user: ', username);
          // console.log('with the user: ', u.username);
          flag = true
          socket.join(u.room)
          room = u.room
          return false
        }
      })
      if (flag) {
        userMap.set(socket.id, { room, username });
        const user = await User.create({
          username,
          latitude,
          longitude,
          room,
          socketId
        })
        user.save()
        io.emit('room', room)
        io.to(room).emit('new user', { name: username, roomId: room });
        io.to(user.room).emit('count', userMap.size)
      }
      // if none of the users satisfy the condition then create a new room and save it into db
      if (!flag) {
        const room = uniqid()
        socket.join(room)
        userMap.set(socket.id, { room, username });
        const socketId = socket.id
        const user = await User.create({
          username,
          latitude,
          longitude,
          room,
          socketId
        })
        user.save()
        io.emit('room', room)
        io.to(room).emit('new user', { name: username, roomId: room });
        io.to(user.room).emit('count', userMap.size)
      }

    } catch (error) {
      const deletUser = await User.findOneAndDelete({ username: username })
      const user = await User.create({
        username,
        latitude,
        longitude
      })
    }
  })

  // This connection is not being used???
  socket.on('new user', (user) => {
    // console.log('got new user signal');
    // console.log('new user:')
    // console.log(user);
    // io.emit('new user', user);
    // since server is not receiving any roomId its not executing the below code
    io.to(user.room).emit('count', userMap.size)
    io.to(user.room).emit('new user', user);
  })

  socket.on('chat message', (msg) => {
    io.to(msg.room).emit('chat message', msg);
    console.log(msg);
  });
  socket.on('disconnect', async () => {
    const user = userMap.get(socket.id);
    if (user) {
      console.log(`User '${user.username}' disconnected from room: ${user.room}`);
      io.to(user.room).emit('user left', user.username)
      const delUser = await User.deleteMany({ socketId: socket.id })
      delUser
      userMap.delete(socket.id);
      io.to(user.room).emit('count', userMap.size)
    }
  })
});

server.listen(3000 || process.env.PORT, () => {
  console.log('listening on *:3000');
});