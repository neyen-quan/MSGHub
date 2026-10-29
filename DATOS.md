# Datos locales y compatibilidad

- Identidad Windows: `agency.neyen.msghub`.
- Perfil: `%APPDATA%\MSG Hub`, conservado sin renombrar ni vaciar.
- Origen del tablero: `http://127.0.0.1:5174`, conservado para leer Local Storage.
- Sesiones: particiones `persist:workhub-*` históricas; no se cambian sus nombres.
- WhatsApp: `wa-personal`, `wa-work`. Telegram: `telegram`, `telegram-2`, `telegram-3`, `telegram-4`.
- Tareas: clave `msghub-kanban-v1` del Local Storage existente.
- Preferencias, divisiones, modo laburo y silencios: mismas claves existentes.
- Reloj: `work-timer.json`, respaldo `.bak` y respaldo previo a la migración v5.
- Configuración privada extraída localmente: `private-config.json`, con correos, enlaces y semilla histórica de notas. No se publica.
- Canal online: `update-channel.json` dentro del perfil.
- ZIP pendiente: `updates/downloads` dentro del perfil; se conserva durante confirmación y cancelación.
- Recuperación del programa: `.msghub-updates` junto al ejecutable real abierto.
- Documentos y carpetas elegidas: permanecen fuera del programa; nunca se empaquetan.

Mover la carpeta completa conserva el perfil, el origen y las sesiones. El arranque
repara únicamente accesos propios según AppUserModelID y no toca otros programas.
La transición debe capturar la configuración antigua antes de sustituir fuentes.
