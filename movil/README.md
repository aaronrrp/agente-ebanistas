# PiLLA — App móvil (Capacitor)

App móvil de PiLLA para **Android e iOS**. **No duplica nada**: envuelve la MISMA web
(`../index.html`, `../app.js`, `../styles.css`) y consume el MISMO backend en la nube.
Una sola lógica de negocio para web y móvil.

## Cómo funciona (arquitectura)
- La web es la **fuente única**. `sync-web.mjs` la copia a `www/` (artefacto de build).
- `../mobile-bridge.js` detecta si corre dentro de la app (Capacitor). En la app,
  redirige las llamadas `fetch("/api/...")` al backend en la nube
  (`https://agente-ebanistas.onrender.com`). En la web no hace nada.
- Capacitor empaqueta `www/` en un shell nativo y da acceso a cámara, push, storage
  seguro, splash, etc. mediante plugins.

## Requisitos
- **Node 18+**
- **Android:** Android Studio + JDK 17 (se puede en Windows). Genera el `.aab`.
- **iOS:** **requiere una Mac** con Xcode (o un build en la nube tipo Ionic Appflow).
  En Windows solo se deja preparado el proyecto; la compilación final es en Mac.

## Primer arranque
```bash
cd movil
npm install
npm run sync-web          # copia la web a www/
```

### Android (genera el App Bundle .aab)
```bash
npm run add:android       # sync-web + npx cap add android + sync
npm run open:android      # abre Android Studio
# En Android Studio: Build > Generate Signed Bundle/APK > Android App Bundle (.aab)
```

### iOS (en Mac)
```bash
npm run add:ios
npm run open:ios          # abre Xcode → Product > Archive → distribuir
```

### Íconos y splash (desde ../pilla-logo.png)
```bash
# Necesita un logo de 1024x1024 px en resources/ (ver docs de @capacitor/assets)
npm run assets
```

## Después de cada cambio en la web
```bash
npm run sync             # regenera www/ y hace npx cap sync (Android + iOS)
```

## Identidad de la app (editable en capacitor.config.json)
- **appId:** `com.pilla.app`  · **appName:** `PiLLA` · color de marca `#1A1346`
- Cámbialos por tu dominio propio antes de publicar en las tiendas.

## Pendiente antes de un lanzamiento "de producción"
El backend hoy corre en Render free: datos efímeros (se borran en cada deploy),
sesiones en memoria (cierran sesión al reiniciar) y "sleep" con arranque frío.
Para una app seria hay que: disco/BD persistente, tokens firmados (JWT) y plan
always-on. La app se puede construir y probar ya, pero el lanzamiento depende de eso.
