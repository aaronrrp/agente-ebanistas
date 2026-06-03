# Agente ebanistas SaaS

## Abrir sin IA real

Abre `index.html` en el navegador. El asistente trabaja en modo local: interpreta medidas, crea muebles, calcula cotizacion y genera cortes, pero no llama a OpenAI.

## Abrir con IA real

Desde esta carpeta:

```bash
OPENAI_API_KEY="tu_llave" npm start
```

Luego abre:

```text
http://localhost:5174
```

Opcionalmente puedes cambiar el modelo:

```bash
OPENAI_API_KEY="tu_llave" OPENAI_MODEL="gpt-5.5" npm start
```

La llave queda en `server.js`; no se expone dentro del navegador.
