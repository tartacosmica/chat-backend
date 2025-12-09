const express = require('express');
const { MongoClient, ObjectId } = require('mongodb');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB connection URI
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://tinchobs:tinchobs@node.xipbq4p.mongodb.net/?appName=node';
const DB_NAME = 'CHAT';
const COLLECTION_NAME = 'CHAT';
const PRIVATE_CHATS_COLLECTION = 'PRIVATE_CHATS';

let db;
let messagesCollection;
let privateChatsCollection;

// Conectar a MongoDB
async function connectToMongoDB() {
    try {
        const client = await MongoClient.connect(MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        
        console.log('✅ Conectado a MongoDB Atlas');
        
        db = client.db(DB_NAME);
        messagesCollection = db.collection(COLLECTION_NAME);
        privateChatsCollection = db.collection(PRIVATE_CHATS_COLLECTION);
        
        // Crear índice para ordenar por timestamp
        await messagesCollection.createIndex({ timestamp: 1 });
        await messagesCollection.createIndex({ isPremium: 1 });
        await privateChatsCollection.createIndex({ chatId: 1 });
        await privateChatsCollection.createIndex({ timestamp: 1 });
        
        console.log(`📦 Usando base de datos: ${DB_NAME}, colección: ${COLLECTION_NAME}`);
    } catch (error) {
        console.error('❌ Error conectando a MongoDB:', error);
        process.exit(1);
    }
}

// Rutas de la API

// GET - Obtener todos los mensajes
app.get('/api/messages', async (req, res) => {
    try {
        const messages = await messagesCollection
            .find({})
            .sort({ timestamp: 1 })
            .limit(100) // Limitar a los últimos 100 mensajes
            .toArray();
        
        res.json(messages);
    } catch (error) {
        console.error('Error obteniendo mensajes:', error);
        res.status(500).json({ error: 'Error al obtener mensajes' });
    }
});

// POST - Enviar un nuevo mensaje
app.post('/api/messages', async (req, res) => {
    try {
        const { username, message, timestamp, isPremium, bubbleColor } = req.body;
        
        // Validación
        if (!username || !message) {
            return res.status(400).json({ error: 'Username y message son requeridos' });
        }
        
        // Si es premium, eliminar el mensaje premium anterior
        if (isPremium) {
            await messagesCollection.deleteMany(
                { isPremium: true }
            );
        }
        
        const newMessage = {
            username: username.trim(),
            message: message.trim(),
            timestamp: timestamp || Date.now(),
            isPremium: isPremium || false,
            bubbleColor: bubbleColor || null
        };
        
        const result = await messagesCollection.insertOne(newMessage);
        
        // Devolver el mensaje creado con su ID
        const createdMessage = {
            _id: result.insertedId,
            ...newMessage
        };
        
        res.status(201).json(createdMessage);
    } catch (error) {
        console.error('Error guardando mensaje:', error);
        res.status(500).json({ error: 'Error al guardar mensaje' });
    }
});

// DELETE - Borrar todos los mensajes (útil para testing)
app.delete('/api/messages', async (req, res) => {
    try {
        const result = await messagesCollection.deleteMany({});
        res.json({ message: `${result.deletedCount} mensajes eliminados` });
    } catch (error) {
        console.error('Error eliminando mensajes:', error);
        res.status(500).json({ error: 'Error al eliminar mensajes' });
    }
});

// GET - Obtener el mensaje premium actual
app.get('/api/premium-message', async (req, res) => {
    try {
        const premiumMessage = await messagesCollection
            .findOne({ isPremium: true }, { sort: { timestamp: -1 } });
        
        res.json(premiumMessage || null);
    } catch (error) {
        console.error('Error obteniendo mensaje premium:', error);
        res.status(500).json({ error: 'Error al obtener mensaje premium' });
    }
});

// GET - Obtener mensajes de un chat privado
app.get('/api/private-messages/:chatId', async (req, res) => {
    try {
        const { chatId } = req.params;
        const messages = await privateChatsCollection
            .find({ chatId })
            .sort({ timestamp: 1 })
            .limit(100)
            .toArray();
        
        res.json(messages);
    } catch (error) {
        console.error('Error obteniendo mensajes privados:', error);
        res.status(500).json({ error: 'Error al obtener mensajes privados' });
    }
});

// POST - Enviar mensaje a chat privado
app.post('/api/private-messages', async (req, res) => {
    try {
        const { chatId, username, message, timestamp, bubbleColor } = req.body;
        
        // Validación
        if (!chatId || !username || !message) {
            return res.status(400).json({ error: 'chatId, username y message son requeridos' });
        }
        
        const newMessage = {
            chatId: chatId.trim(),
            username: username.trim(),
            message: message.trim(),
            timestamp: timestamp || Date.now(),
            bubbleColor: bubbleColor || null
        };
        
        const result = await privateChatsCollection.insertOne(newMessage);
        
        const createdMessage = {
            _id: result.insertedId,
            ...newMessage
        };
        
        res.status(201).json(createdMessage);
    } catch (error) {
        console.error('Error guardando mensaje privado:', error);
        res.status(500).json({ error: 'Error al guardar mensaje privado' });
    }
});

// GET - Obtener lista de usuarios activos (últimos mensajes únicos por usuario)
app.get('/api/active-users', async (req, res) => {
    try {
        const users = await messagesCollection
            .aggregate([
                { $match: { isPremium: false } },
                { $sort: { timestamp: -1 } },
                { $group: { 
                    _id: "$username",
                    lastMessage: { $first: "$message" },
                    lastTimestamp: { $first: "$timestamp" }
                }},
                { $sort: { lastTimestamp: -1 } },
                { $limit: 50 }
            ])
            .toArray();
        
        res.json(users);
    } catch (error) {
        console.error('Error obteniendo usuarios activos:', error);
        res.status(500).json({ error: 'Error al obtener usuarios activos' });
    }
});

// Ruta raíz
app.get('/', (req, res) => {
    res.json({ 
        message: 'Chat Backend API v2.2 - Private Chats',
        version: '2.2.0',
        endpoints: {
            'GET /api/messages': 'Obtener todos los mensajes',
            'POST /api/messages': 'Enviar mensaje (incluir isPremium:true para premium)',
            'DELETE /api/messages': 'Eliminar todos los mensajes',
            'GET /api/premium-message': 'Obtener mensaje premium actual',
            'GET /api/active-users': 'Obtener usuarios activos',
            'GET /api/private-messages/:chatId': 'Obtener mensajes de chat privado',
            'POST /api/private-messages': 'Enviar mensaje a chat privado'
        }
    });
});

// Iniciar servidor
async function startServer() {
    await connectToMongoDB();
    
    app.listen(PORT, () => {
        console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
        console.log(`📱 Para usar con Android Emulator, usa: http://10.0.2.2:${PORT}`);
    });
}

startServer();
