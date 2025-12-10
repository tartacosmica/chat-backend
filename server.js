const express = require('express');
const { MongoClient, ObjectId } = require('mongodb');
const cors = require('cors');
const bcrypt = require('bcrypt');
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
const USERS_COLLECTION = 'USERS';

let db;
let messagesCollection;
let privateChatsCollection;
let usersCollection;

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
        usersCollection = db.collection(USERS_COLLECTION);
        
        // Crear índice para ordenar por timestamp
        await messagesCollection.createIndex({ timestamp: 1 });
        await messagesCollection.createIndex({ isPremium: 1 });
        await privateChatsCollection.createIndex({ chatId: 1 });
        await privateChatsCollection.createIndex({ timestamp: 1 });
        await usersCollection.createIndex({ username: 1 }, { unique: true });
        
        console.log(`📦 Usando base de datos: ${DB_NAME}, colección: ${COLLECTION_NAME}`);
    } catch (error) {
        console.error('❌ Error conectando a MongoDB:', error);
        process.exit(1);
    }
}

// Rutas de la API

// POST - Registro de usuario
app.post('/api/register', async (req, res) => {
    try {
        const { username, password } = req.body;
        
        if (!username || !password) {
            return res.status(400).json({ error: 'Username y password son requeridos' });
        }
        
        if (username.length < 3) {
            return res.status(400).json({ error: 'El username debe tener al menos 3 caracteres' });
        }
        
        if (password.length < 4) {
            return res.status(400).json({ error: 'La contraseña debe tener al menos 4 caracteres' });
        }
        
        // Verificar si el usuario ya existe
        const existingUser = await usersCollection.findOne({ username: username.trim() });
        if (existingUser) {
            return res.status(409).json({ error: 'El usuario ya existe' });
        }
        
        // Hash de la contraseña
        const hashedPassword = await bcrypt.hash(password, 10);
        
        const newUser = {
            username: username.trim(),
            password: hashedPassword,
            createdAt: Date.now()
        };
        
        await usersCollection.insertOne(newUser);
        
        res.status(201).json({ 
            success: true, 
            username: newUser.username,
            message: 'Usuario registrado exitosamente' 
        });
    } catch (error) {
        console.error('Error registrando usuario:', error);
        res.status(500).json({ error: 'Error al registrar usuario' });
    }
});

// POST - Login de usuario
app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        
        if (!username || !password) {
            return res.status(400).json({ error: 'Username y password son requeridos' });
        }
        
        const user = await usersCollection.findOne({ username: username.trim() });
        
        if (!user) {
            return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
        }
        
        const isPasswordValid = await bcrypt.compare(password, user.password);
        
        if (!isPasswordValid) {
            return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
        }
        
        res.json({ 
            success: true, 
            username: user.username,
            message: 'Login exitoso' 
        });
    } catch (error) {
        console.error('Error en login:', error);
        res.status(500).json({ error: 'Error al iniciar sesión' });
    }
});

// GET - Obtener chats privados del usuario
app.get('/api/user-chats/:username', async (req, res) => {
    try {
        const { username } = req.params;
        
        const chats = await privateChatsCollection.aggregate([
            { $match: { chatId: { $regex: username, $options: 'i' } } },
            { $sort: { timestamp: -1 } },
            { $group: {
                _id: "$chatId",
                lastMessage: { $first: "$message" },
                lastTimestamp: { $first: "$timestamp" },
                lastUsername: { $first: "$username" }
            }},
            { $sort: { lastTimestamp: -1 } }
        ]).toArray();
        
        res.json(chats);
    } catch (error) {
        console.error('Error obteniendo chats del usuario:', error);
        res.status(500).json({ error: 'Error al obtener chats' });
    }
});

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

// GET - Obtener chats privados donde el usuario es destinatario
app.get('/api/my-private-chats/:username', async (req, res) => {
    try {
        const { username } = req.params;
        
        // Buscar todos los chats donde el usuario aparece en el chatId (como primero o segundo)
        const chats = await privateChatsCollection.aggregate([
            { $match: { 
                chatId: { $regex: username, $options: 'i' }
            }},
            { $sort: { timestamp: -1 } },
            { $group: {
                _id: "$chatId",
                lastMessage: { $first: "$message" },
                lastTimestamp: { $first: "$timestamp" },
                lastUsername: { $first: "$username" }
            }},
            { $sort: { lastTimestamp: -1 } }
        ]).toArray();
        
        // Formatear respuesta
        const formattedChats = chats.map(chat => {
            const chatId = chat._id;
            const parts = chatId.split('_');
            // Determinar quién es el otro usuario (el que NO es el usuario actual)
            const otherUsername = parts[0].toLowerCase() === username.toLowerCase() 
                ? parts[1] 
                : parts[0];
            
            return {
                chatId: chatId,
                otherUsername: otherUsername,
                lastMessage: chat.lastMessage,
                lastMessageTime: chat.lastTimestamp,
                unreadCount: 0 // Podrías implementar conteo de no leídos después
            };
        });
        
        res.json(formattedChats);
    } catch (error) {
        console.error('Error obteniendo chats privados:', error);
        res.status(500).json({ error: 'Error al obtener chats privados' });
    }
});

// Ruta raíz
app.get('/', (req, res) => {
    res.json({ 
        message: 'Chat Backend API v2.3 - Private Chats with Notifications',
        version: '2.3.0',
        endpoints: {
            'GET /api/messages': 'Obtener todos los mensajes',
            'POST /api/messages': 'Enviar mensaje (incluir isPremium:true para premium)',
            'DELETE /api/messages': 'Eliminar todos los mensajes',
            'GET /api/premium-message': 'Obtener mensaje premium actual',
            'GET /api/active-users': 'Obtener usuarios activos',
            'GET /api/private-messages/:chatId': 'Obtener mensajes de chat privado',
            'POST /api/private-messages': 'Enviar mensaje a chat privado',
            'GET /api/my-private-chats/:username': 'Obtener lista de chats privados del usuario',
            'POST /api/register': 'Registrar nuevo usuario',
            'POST /api/login': 'Iniciar sesión'
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
