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
const PREMIUM_COLLECTION_NAME = 'PREMIUM_MESSAGE';

let db;
let messagesCollection;
let premiumMessageCollection;

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
        premiumMessageCollection = db.collection(PREMIUM_COLLECTION_NAME);
        
        // Crear índice para ordenar por timestamp
        await messagesCollection.createIndex({ timestamp: 1 });
        
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
        const { username, message, timestamp } = req.body;
        
        // Validación
        if (!username || !message) {
            return res.status(400).json({ error: 'Username y message son requeridos' });
        }
        
        const newMessage = {
            username: username.trim(),
            message: message.trim(),
            timestamp: timestamp || Date.now()
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
        const premiumMessage = await premiumMessageCollection
            .findOne({}, { sort: { timestamp: -1 } });
        
        res.json(premiumMessage || null);
    } catch (error) {
        console.error('Error obteniendo mensaje premium:', error);
        res.status(500).json({ error: 'Error al obtener mensaje premium' });
    }
});

// POST - Establecer un nuevo mensaje premium
app.post('/api/premium-message', async (req, res) => {
    try {
        const { username, message, timestamp } = req.body;
        
        // Validación
        if (!username || !message) {
            return res.status(400).json({ error: 'Username y message son requeridos' });
        }
        
        const newPremiumMessage = {
            username: username.trim(),
            message: message.trim(),
            timestamp: timestamp || Date.now()
        };
        
        // Eliminar mensaje premium anterior y agregar el nuevo
        await premiumMessageCollection.deleteMany({});
        const result = await premiumMessageCollection.insertOne(newPremiumMessage);
        
        const createdMessage = {
            _id: result.insertedId,
            ...newPremiumMessage
        };
        
        res.status(201).json(createdMessage);
    } catch (error) {
        console.error('Error guardando mensaje premium:', error);
        res.status(500).json({ error: 'Error al guardar mensaje premium' });
    }
});

// Ruta raíz
app.get('/', (req, res) => {
    res.json({ 
        message: 'Chat Backend API funcionando',
        endpoints: {
            'GET /api/messages': 'Obtener todos los mensajes',
            'POST /api/messages': 'Enviar un nuevo mensaje',
            'DELETE /api/messages': 'Eliminar todos los mensajes',
            'GET /api/premium-message': 'Obtener mensaje premium actual',
            'POST /api/premium-message': 'Establecer nuevo mensaje premium'
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
