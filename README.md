# Chat Backend

Backend simple con Express y MongoDB para la aplicación de chat Android.

## Instalación

```bash
npm install
```

## Configuración

1. Abre el archivo `.env`
2. Reemplaza `TU_CONTRASEÑA_AQUI` con tu contraseña real de MongoDB
3. La URI completa debería verse así:
   ```
   MONGODB_URI=mongodb+srv://tinchobs:tucontraseña@node.xipbq4p.mongodb.net/?appName=node
   ```

## Ejecutar

```bash
# Modo normal
npm start

# Modo desarrollo (con auto-restart)
npm run dev
```

El servidor se ejecutará en `http://localhost:3000`

## Endpoints

- `GET /api/messages` - Obtener todos los mensajes
- `POST /api/messages` - Enviar un nuevo mensaje
- `DELETE /api/messages` - Eliminar todos los mensajes

## Usar con Android Emulator

En el emulador de Android, usa la IP: `http://10.0.2.2:3000`

Esta IP está configurada en `RetrofitClient.kt` en la app Android.

## Estructura de Datos

### Message
```json
{
  "_id": "ObjectId generado por MongoDB",
  "username": "Nombre del usuario",
  "message": "Texto del mensaje",
  "timestamp": 1234567890123
}
```
