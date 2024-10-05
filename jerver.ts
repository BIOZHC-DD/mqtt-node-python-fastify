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
import { sendJsonToPythonServer } from './sindex.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MQTT_BROKER_URL = 'mqtt://10.2.216.208';
const MQTT_TOPIC = 'topic/test';
const DB_PATH = path.join(__dirname, 'messagesmessages.db');

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

let csvCounter = 0;
let sessionStart: number | null = null;

const getNextCsvFilename = async (): Promise<string> => {
    csvCounter++;
    const filename = `output${csvCounter}.csv`;
    try {
        await fs.access(filename);
        return getNextCsvFilename();
    } catch {
        return filename;
    }
};

let currentSessionId: string | null = null;

const handleMessage = async (topic: string, message: Buffer): Promise<void> => {
    const messageStr = message.toString();
    console.log(`Received message: ${messageStr} on topic: ${topic}`);
    try {
        const parsedMessage = JSON.parse(messageStr);

        if (parsedMessage.message === "Data publishing started") {
            currentSessionId = parsedMessage.sessionId;
            sessionStart = Date.now();
            console.log("New session started");
            await db.run('INSERT INTO sessions (session_id, start_time) VALUES (?, ?)', [currentSessionId, new Date().toISOString()]);
            await db.run('DELETE FROM messages');
        }

        await db.run('INSERT INTO messages (topic, message, timestamp) VALUES (?, ?, ?)', [topic, messageStr, new Date().toISOString()]);

        fastify.websocketServer.clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify({ topic, message: messageStr }));
            }
        });

        if (parsedMessage.message === "Data publishing ended") {
            console.log("Received 'Data publishing ended' message. Running processBioData.js");
            const outputFilename = await getNextCsvFilename();
            await db.run('UPDATE sessions SET end_time = ? WHERE session_id = ?', [new Date().toISOString(), currentSessionId]);
            processBioData('messagesmessages.db', outputFilename, sessionStart)
                .then(() => {
                    console.log(`BioData processed and saved to ${outputFilename}`);
                    sessionStart = null;
                    currentSessionId = null;
                })
                .catch((error: Error) => console.error('Error processing BioData:', error));
        }
    } catch (error) {
        console.error('Error handling message:', error);
    }
};

mqttClient.on('message', handleMessage);

fastify.get('/ws', { websocket: true }, (connection) => {
    console.log('Client connected to WebSocket');
    connection.socket.on('message', (message: WebSocket.Data) => {
        console.log(`Received message from client: ${message}`);
    });
});

fastify.get('/api/messages', async (request, reply) => {
    const messages = await db.all('SELECT * FROM messages ORDER BY timestamp DESC LIMIT 100');
    return messages;
});

fastify.get('/api/sessions', async (request, reply) => {
    const sessions = await db.all('SELECT * FROM sessions ORDER BY start_time DESC LIMIT 100');
    return sessions;
});


//fastify.post('/api/log', async (request, reply) => {
//    const { message } = request.body as { message: string };
//    console.log('Received message:', message);
//    return { status: 'success', message: 'Message logged' };
//});

let pythonResponses = [];

// POST endpoint to log Python responses
fastify.post('/api/log', async (request, reply) => {
    const jjjjsonData = request.body;
    console.log('Received JSON message:', jjjjsonData);

    // Store the Python response
    pythonResponses.push(jjjjsonData);

    return { status: 'success', message: 'JSON message logged' };
});

// GET endpoint to retrieve Python responses
fastify.get('/api/responses', async (request, reply) => {
    return { status: 'success', responses: pythonResponses };
});


fastify.post('/api/send-json', async (request, reply) => {
    try {
        const { sessionId, modelId } = request.body; // Assuming sessionId is sent in the request body
        if (!sessionId) {
            return reply.status(400).send({ success: false, message: 'Session ID is required' });
        }
        if (!modelId) {
            return reply.status(400).send({ success: false, message: 'Model ID is required' });
        }
        const result = await sendJsonToPythonServer(sessionId, modelId);
        return { success: true, message: 'JSON sent successfully', result };
    } catch (error) {
        console.error('Error sending JSON:', error);
        reply.status(500).send({ success: false, message: 'Error sending JSON' });
    }
});



fastify.get('/', async (request, reply) => {
    reply.type('text/html').send(`
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>MQTT Messages and Sessions</title>
  <script src="https://cdn.tailwindcss.com"></script>
      <script>
    tailwind.config = {
      darkMode: 'class',
      theme: {
        extend: {
          colors: {
            dark: {
              100: '#374151',
              200: '#1F2937',
              300: '#111827',
            }
          }
        }
      }
    }
  </script>
       <style>
       body {
      background-color: #111827;
      color: #E5E7EB;
    }
    /* Styles for session and model list items */
    #sessionList li, #modelList li, #messageList {
      transition: 0.3s ease;
    }

    /* Hover effect: turns blue when hovering over the item */
    #sessionList li:hover, #modelList li:hover {
      background-color: #4B5563;
      transform: translateY(-2px);
    }
  </style>
</head>
<body class="dark">
  <div class="container mx-auto p-4">

    <h1 class="text-3xl font-bold mb-8">MQTT Dashboard</h1>

    <div class="grid grid-cols-1 md:grid-cols-2 gap-8">

    <div id="sessions" class="mb-8">
      <h2 class="text-2xl font-semibold mb-4 text-blue-300">Sessions</h2>
      <ul id="sessionList" class="space-y-3"></ul>
    </div>

    <div id="models" class="mb-8">
      <h2 class="text-2xl font-semibold mb-4 text-blue-300">Models</h2>
      <ul id="modelList" class="space-y-3">
        <li class="bg-dark-200 p-3 rounded-lg shadow-md hover:shadow-lg" data-model-id="1">Model 1</li>
        <li class="bg-dark-200 p-3 rounded-lg shadow-md hover:shadow-lg" data-model-id="2">Model 2</li>
        <li class="bg-dark-200 p-3 rounded-lg shadow-md hover:shadow-lg" data-model-id="3">Model 3</li>
      </ul>
    </div>

    </div>

     <div class="flex justify-center my-8">
      <button id="sendJsonButton" class="bg-dark-200 shadow-md hover:shadow-lg  text-white font-bold py-4 px-8 rounded-lg text-2xl transition duration-300 ease-in-out transform hover:scale-105">
      Run
      </button>
    </div>

 <div class="mb-8">
            <h2 class="text-2xl font-semibold mb-4 text-blue-300">Flask server response</h2>
            <button id="fetchDataButton" class="bg-gray-800 text-white font-bold py-2 px-4 rounded-lg mb-4">
                Fetch Data
            </button>
            <div id="responseContainer" class="bg-gray-800 p-3 rounded-lg shadow-md"></div>
        </div>

    <div id="messages" class="space-y-3">
      <h2 class="text-2xl font-semibold mb-4 text-blue-300">Recent Messages</h2>
      <ul id="messageList" class="space-y-2"></ul>
    </div>

  </div>

  <script>
    const sessionList = document.getElementById('sessionList');
    const messageList = document.getElementById('messageList');
    
    document.addEventListener('DOMContentLoaded', function() {
  const modelList = document.getElementById('modelList');
  let selectedModel = null;

  modelList.addEventListener('click', function(event) {
    const clickedModel = event.target.closest('li');
    if (!clickedModel) return;

    // If there's a previously selected model, remove its highlight
    if (selectedModel) {
      selectedModel.classList.remove('bg-blue-600');
    }

    // If the clicked model is not the previously selected one, highlight it
    if (clickedModel !== selectedModel) {
      clickedModel.classList.add('bg-blue-600');
      selectedModel = clickedModel;
      window.selectedModelId = clickedModel.dataset.modelId;
    } else {
      // If it's the same model, deselect it
      selectedModel = null;
      window.selectedModelId = null;
    }
  });
});

  function fetchAndDisplaySessions() {
  fetch('/api/sessions')
    .then(response => response.json())
    .then(sessions => {
      sessionList.innerHTML = sessions.map(session => \`
        <li class="bg-dark-200 p-3 rounded-lg shadow-md hover:shadow-lg cursor-pointer transition-colors duration-300" data-session-id="\${session.session_id}">
          Session ID: \${session.session_id}<br>
          Start: \${new Date(session.start_time).toLocaleString()}<br>
          End: \${session.end_time ? new Date(session.end_time).toLocaleString() : 'Ongoing'}
        </li>
      \`).join('');
      
      let selectedSession = null;

      // Add click event listeners to each session item
      document.querySelectorAll('#sessionList li').forEach(item => {
        item.addEventListener('click', function() {
          // If there's a previously selected session, remove its highlight
          if (selectedSession) {
            selectedSession.classList.remove('bg-blue-600');
          }

          // If the clicked session is not the previously selected one, highlight it
          if (this !== selectedSession) {
            this.classList.add('bg-blue-600');
            selectedSession = this;
            window.selectedSessionId = this.dataset.sessionId;
          } else {
            // If it's the same session, deselect it
            selectedSession = null;
            window.selectedSessionId = this.dataset.sessionId; 
          }
        });
      });
    });
}
    
    function fetchAndDisplayMessages() {
      fetch('/api/messages')
        .then(response => response.json())
        .then(messages => {
          messageList.innerHTML = messages.map(msg => \`
            <li class="bg-dark-200 p-3 rounded-lg shadow-md hover:shadow-lg">
              \${new Date(msg.timestamp).toLocaleString()} - \${msg.topic}: \${msg.message}
            </li>
          \`).join('');
        });
    }
    
    fetchAndDisplaySessions();
    fetchAndDisplayMessages();
    
    const ws = new WebSocket('ws://' + window.location.host + '/ws');
    ws.onmessage = function(event) {
      const data = JSON.parse(event.data);
      const newMessage = document.createElement('li');
      newMessage.className = 'bg-white p-2 rounded shadow';
      newMessage.textContent = \`\${new Date().toLocaleString()} - \${data.topic}: \${data.message}\`;
      messageList.insertBefore(newMessage, messageList.firstChild);
      
      // Refresh sessions list when a new message is received
      fetchAndDisplaySessions();
    };

document.getElementById('sendJsonButton').addEventListener('click', () => {

    if (!window.selectedSessionId) {
    alert('Please select a session first.');
    return;
  }

  fetch('/api/send-json', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ 
        sessionId: parseInt(window.selectedSessionId), 
        modelId: parseInt(window.selectedModelId) 
    })
  })
    .then(response => response.json())
    .then(data => {
      if (data.success) {
        alert('JSON sent successfully: ' + data.message);
      } else {
        alert('Error sending JSON: ' + data.message);
      }
    })
    .catch(error => {
      console.error('Error:', error);
      alert('An error occurred while sending JSON');
    });
});
async function fetchData() {
            try {
                const response = await fetch('/api/responses');
                if (!response.ok) {
                    throw new Error('Network response was not ok ' + response.statusText);
                }
                const data = await response.json();
                const message = data.responses[0].message;
                document.getElementById('responseContainer').innerText = message;
            } catch (error) {
                document.getElementById('responseContainer').innerText = 'Error: ' + error.message;
            }
        }
        document.getElementById('fetchDataButton').addEventListener('click', fetchData);
     </script>
</body>
</html>
    `);
});

// Start the server
const start = async (): Promise<void> => {
    try {
        await initDb();
        await fastify.listen({ port: 3000, host: '0.0.0.0' });
        console.log('Server listening on port 3000');
    } catch (err) {
        fastify.log.error(err);
        process.exit(1);
    }
};

start();
