console.log("Hello via Bun!");

import fastifyStatic from '@fastify/static';
import fastifyWebsocket from '@fastify/websocket';
import mqtt from 'mqtt';
import sqlite3 from 'sqlite3';
import { Database, open } from 'sqlite';
import path from 'path';
import { fileURLToPath } from 'url';
import WebSocket from 'ws';
import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import { processBioData } from './processBioData.js';
import { promises as fs } from 'fs';


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MQTT_BROKER_URL = 'mqtt://10.2.216.208';
const MQTT_TOPIC = 'topic/test';
const DB_PATH = path.join(__dirname, 'messages.db');

// Initialize Fastify server
const fastify: FastifyInstance = Fastify({ logger: true });

// Register static file serving plugin
fastify.register(fastifyStatic, {
    root: path.join(__dirname, 'public'),
    prefix: '/public/',
});

// Register WebSocket plugin
fastify.register(fastifyWebsocket);

// Initialize SQLite database
let db: Database;
const initDb = async (): Promise<void> => {
    db = await open({
        filename: DB_PATH,
        driver: sqlite3.Database
    });
    await db.exec(`
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      topic TEXT,
      message TEXT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT,
      start_time DATETIME DEFAULT CURRENT_TIMESTAMP,
      end_time DATETIME
    );
  `);
};

// Initialize MQTT client
const mqttClient = mqtt.connect(MQTT_BROKER_URL);
mqttClient.on('connect', () => {
    console.log('Connected to MQTT broker');
    mqttClient.subscribe(MQTT_TOPIC, (err) => {
        if (!err) {
            console.log(`Subscribed to topic: ${MQTT_TOPIC}`);
        }
    });
});




//let csvCounter = 0;
//let sessionStart: number | null = null;
//
//const getNextCsvFilename = async (): Promise<string> => {
//    csvCounter++;
//    const filename = `output${csvCounter}.csv`;
//    // Check if file exists, if so, increment counter and try again
//    try {
//        await fs.access(filename);
//        return getNextCsvFilename();
//    } catch {
//        // File doesn't exist, we can use this name
//        return filename;
//    }
//};
//
//const handleMessage = async (topic: string, message: Buffer): Promise<void> => {
//    const messageStr = message.toString();
//    console.log(`Received message: ${messageStr} on topic: ${topic}`);
//    try {
//        const parsedMessage = JSON.parse(messageStr);
//
//        // Check for session start
//        if (parsedMessage.message === "Data publishing started") {
//            sessionStart = Date.now();
//            console.log("New session started");
//            // Clear the database for the new session
//            await db.run('DELETE FROM messages');
//        }
//
//        // Store in database
//        await db.run('INSERT INTO messages (topic, message, timestamp) VALUES (?, ?, ?)', [topic, messageStr, Date.now()]);
//
//        // Broadcast to WebSocket clients
//        fastify.websocketServer.clients.forEach((client) => {
//            if (client.readyState === WebSocket.OPEN) {
//                client.send(JSON.stringify({ topic, message: messageStr }));
//            }
//        });
//
//        // Check if the message contains "Data publishing ended"
//        if (parsedMessage.message === "Data publishing ended") {
//            console.log("Received 'Data publishing ended' message. Running processBioData.js");
//            const outputFilename = await getNextCsvFilename();
//            processBioData('messages.db', outputFilename, sessionStart)
//                .then(() => {
//                    console.log(`BioData processed and saved to ${outputFilename}`);
//                    sessionStart = null; // Reset session start
//                })
//                .catch((error: Error) => console.error('Error processing BioData:', error));
//        }
//    } catch (error) {
//        console.error('Error handling message:', error);
//    }
//};
//
//mqttClient.on('message', handleMessage);
//
//// WebSocket route
//fastify.get('/ws', { websocket: true }, (connection) => {
//    console.log('Client connected to WebSocket');
//    connection.socket.on('message', (message: WebSocket.Data) => {
//        console.log(`Received message from client: ${message}`);
//    });
//});
//
//// API route to get all messages
//fastify.get('/api/messages', async (request, reply) => {
//    const messages = await db.all('SELECT * FROM messages ORDER BY timestamp DESC LIMIT 100');
//    return messages;
//});
//
//
//fastify.get('/', async (request, reply) => {
//    reply.type('text/html').send(`
//<!DOCTYPE html>
//<html lang="en">
//<head>
//  <meta charset="UTF-8">
//  <meta name="viewport" content="width=device-width, initial-scale=1.0">
//  <title>MQTT Messages</title>
//  <script src="https://cdn.tailwindcss.com"></script>
//</head>
//<body class="bg-gray-100">
//  <div class="container mx-auto p-4">
//    <h1 class="text-2xl font-bold mb-4">MQTT Messages</h1>
//    <div id="messages" class="space-y-2"></div>
//  </div>
//</body>
//</html>
//    `)
//})



let currentSessionId: string | null = null;

const handleMessage = async (topic: string, message: Buffer): Promise<void> => {
    const messageStr = message.toString();
    console.log(`Received message: ${messageStr} on topic: ${topic}`);
    try {
        const parsedMessage = JSON.parse(messageStr);

        // Check for session start
        if (parsedMessage.message === "Data publishing started") {
            currentSessionId = parsedMessage.sessionId;
            console.log(`New session started: ${currentSessionId}`);
            // Insert new session into database
            await db.run('INSERT INTO sessions (session_id, start_time) VALUES (?, ?)', [currentSessionId, new Date().toISOString()]);
            // Clear the messages for the new session
            await db.run('DELETE FROM messages');
        }

        // Store message in database
        await db.run('INSERT INTO messages (topic, message, timestamp) VALUES (?, ?, ?)', [topic, messageStr, new Date().toISOString()]);

        // Broadcast to WebSocket clients
        fastify.websocketServer.clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify({ topic, message: messageStr }));
            }
        });

        // Check if the message contains "Data publishing ended"
        if (parsedMessage.message === "Data publishing ended") {
            console.log(`Session ${currentSessionId} ended. Running processBioData.js`);
            // Update session end time
            await db.run('UPDATE sessions SET end_time = ? WHERE session_id = ?', [new Date().toISOString(), currentSessionId]);
            processBioData('messages.db', outputFilename, null) // You might need to adjust processBioData to work with sessionId instead of timestamp
                .then(() => {
                    console.log(`BioData processed and saved to ${outputFilename}`);
                    currentSessionId = null; // Reset session ID
                })
                .catch((error: Error) => console.error('Error processing BioData:', error));
        }
    } catch (error) {
        console.error('Error handling message:', error);
    }
};

// ... (WebSocket route remains the same)

// API route to get all messages
fastify.get('/api/messages', async (request, reply) => {
    const messages = await db.all('SELECT * FROM messages ORDER BY timestamp DESC LIMIT 100');
    return messages;
});

// New API route to get all sessions
fastify.get('/api/sessions', async (request, reply) => {
    const sessions = await db.all('SELECT * FROM sessions ORDER BY start_time DESC');
    return sessions;
});

//fastify.get('/', async (request, reply) => {
//    reply.type('text/html').send(`
//<!DOCTYPE html>
//<html lang="en">
//<head>
//  <meta charset="UTF-8">
//  <meta name="viewport" content="width=device-width, initial-scale=1.0">
//  <title>MQTT Messages and Sessions</title>
//  <script src="https://cdn.tailwindcss.com"></script>
//</head>
//<body class="bg-gray-100">
//  <div class="container mx-auto p-4">
//    <h1 class="text-2xl font-bold mb-4">MQTT Messages and Sessions</h1>
//    <div id="sessions" class="mb-8">
//      <h2 class="text-xl font-semibold mb-2">Sessions</h2>
//      <ul id="sessionList" class="space-y-2"></ul>
//    </div>
//    <div id="messages" class="space-y-2">
//      <h2 class="text-xl font-semibold mb-2">Recent Messages</h2>
//      <ul id="messageList" class="space-y-2"></ul>
//    </div>
//  </div>
//  <script>
//    const sessionList = document.getElementById('sessionList');
//    const messageList = document.getElementById('messageList');
//    
//    // Fetch and display sessions
//    fetch('/api/sessions')
//      .then(response => response.json())
//      .then(sessions => {
//        sessionList.innerHTML = sessions.map(session => `
//          <li class="bg-white p-2 rounded shadow">
//            Session ID: ${session.session_id}<br>
//            Start: ${new Date(session.start_time).toLocaleString()}<br>
//            End: ${session.end_time ? new Date(session.end_time).toLocaleString() : 'Ongoing'}
//          </li>
//        `).join('');
//      });
//    
//    // Fetch and display messages
//    fetch('/api/messages')
//      .then(response => response.json())
//      .then(messages => {
//        messageList.innerHTML = messages.map(msg => `
//          <li class="bg-white p-2 rounded shadow">
//            ${new Date(msg.timestamp).toLocaleString()} - ${msg.topic}: ${msg.message}
//          </li>
//        `).join('');
//      });
//    
//    // Set up WebSocket for real-time updates
//    const ws = new WebSocket('ws://' + window.location.host + '/ws');
//    ws.onmessage = function(event) {
//      const data = JSON.parse(event.data);
//      const newMessage = document.createElement('li');
//      newMessage.className = 'bg-white p-2 rounded shadow';
//      newMessage.textContent = `${new Date().toLocaleString()} - ${data.topic}: ${data.message}`;
//      messageList.insertBefore(newMessage, messageList.firstChild);
//    };
//  </script>
//</body>
//</html>
//    `);
//});
//
//
//
//
fastify.get('/', async (request, reply) => {
    reply.type('text/html').send(`
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>MQTT Messages and Sessions</title>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-gray-100">
  <div class="container mx-auto p-4">
    <h1 class="text-2xl font-bold mb-4">MQTT Messages and Sessions</h1>
    <div id="sessions" class="mb-8">
      <h2 class="text-xl font-semibold mb-2">Sessions</h2>
      <ul id="sessionList" class="space-y-2"></ul>
    </div>
    <div id="messages" class="space-y-2">
      <h2 class="text-xl font-semibold mb-2">Recent Messages</h2>
      <ul id="messageList" class="space-y-2"></ul>
    </div>
  </div>
  <script>
    const sessionList = document.getElementById('sessionList');
    const messageList = document.getElementById('messageList');
    
    // Fetch and display sessions
    fetch('/api/sessions')
      .then(response => response.json())
      .then(sessions => {
        sessionList.innerHTML = sessions.map(session => \`
          <li class="bg-white p-2 rounded shadow">
            Session ID: \${session.session_id}<br>
            Start: \${new Date(session.start_time).toLocaleString()}<br>
            End: \${session.end_time ? new Date(session.end_time).toLocaleString() : 'Ongoing'}
          </li>
        \`).join('');
      });
    
    // Fetch and display messages
    fetch('/api/messages')
      .then(response => response.json())
      .then(messages => {
        messageList.innerHTML = messages.map(msg => \`
          <li class="bg-white p-2 rounded shadow">
            \${new Date(msg.timestamp).toLocaleString()} - \${msg.topic}: \${msg.message}
          </li>
        \`).join('');
      });
    
    // Set up WebSocket for real-time updates
    const ws = new WebSocket('ws://' + window.location.host + '/ws');
    ws.onmessage = function(event) {
      const data = JSON.parse(event.data);
      const newMessage = document.createElement('li');
      newMessage.className = 'bg-white p-2 rounded shadow';
      newMessage.textContent = \`\${new Date().toLocaleString()} - \${data.topic}: \${data.message}\`;
      messageList.insertBefore(newMessage, messageList.firstChild);
    };
  </script>
</body>
</html>
    `);
});

// Start the server
const start = async (): Promise<void> => {
    try {
        await initDb();
        await fastify.listen({ port: 3000 });
        console.log('Server listening on port 3000');
    } catch (err) {
        fastify.log.error(err);
        process.exit(1);
    }
};

start();
