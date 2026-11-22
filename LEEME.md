# Prototipo final · Mi Bus UAI (Grupo 5)

Dos páginas web que se hablan en tiempo real:

| Archivo | Para qué |
|---|---|
| `central.html` | Matriz de la UAI en pantalla grande: mapas de Peñalolén y Viña del Mar con todos los buses de subida y bajada en su posición estimada según la **hora real del computador** y el horario de uai.cl. Muestra cupos por bus y los check-ins en vivo. |
| `app.html` | App del alumno para iPhone: próximo bus en su paradero, minutos, cupos, alerta «sal ahora» y check-in con el QR del bus. Se instala como ícono con «Agregar a pantalla de inicio». |
| `qr.html` | Hojas imprimibles: el QR que va en la espalda del «conductor» y el QR para abrir la app. |
| `config.js` | Aquí se pega la configuración de Firebase (paso 1). |
| `horarios.js`, `rutas.js`, `core.js` | Horarios oficiales, recorridos y la lógica compartida. |

**Qué es real y qué es simulado.** Los horarios y paradas son los de uai.cl (20-nov-2026). La posición de cada bus se calcula con la hora y una duración supuesta (Grecia y Dominicos 25 min, F. Castillo Velasco 20 min, Viña del Mar 15 min, 13 Norte 12 min). La ocupación base es simulada. Los check-ins que hagan con los iPhones en la demo son reales y suman en la central.

Sin Firebase todo funciona en **modo local**: la central y la app se sincronizan solo entre pestañas del mismo navegador. Sirve para ensayar en el computador, pero **para que el iPhone actualice la central se necesita Firebase** (gratis, 10 minutos).

---

## Paso 1 · Crear Firebase Realtime Database (gratis)

1. Entra a <https://console.firebase.google.com> con una cuenta de Google del grupo y toca **Crear un proyecto**. Nombre: `mi-bus-uai`. Desactiva Google Analytics (no hace falta).
2. En el menú izquierdo: **Compilación → Realtime Database → Crear base de datos**. Ubicación: la que ofrezca por defecto (Estados Unidos). Elige **Comenzar en modo de prueba** (deja leer y escribir por 30 días, suficiente para el Avance 3 y el Demo Day).
3. Ve al ícono ⚙ **Configuración del proyecto → Tus apps → ícono Web `</>`**. Registra una app con el nombre `mi-bus-uai-web` (no marques Hosting).
4. Firebase muestra un bloque `const firebaseConfig = { ... }`. Copia lo que va entre las llaves y pégalo en `config.js` así:

   ```js
   window.FIREBASE_CONFIG = {
     apiKey: "AIza...",
     authDomain: "mi-bus-uai.firebaseapp.com",
     databaseURL: "https://mi-bus-uai-default-rtdb.firebaseio.com",
     projectId: "mi-bus-uai",
     appId: "1:123:web:abc"
   };
   ```

   Si el bloque no trae `databaseURL`, cópiala desde la página de Realtime Database (es la dirección que aparece arriba de los datos).
5. Abre `central.html`: arriba debe decir **● En línea (Firebase)**.

*Reglas (opcional, más ordenado que el modo de prueba).* En Realtime Database → Reglas:

```json
{
  "rules": {
    "checkins": { ".read": true, "$id": { ".write": "!data.exists()" } },
    "demo": { ".read": true, ".write": true }
  }
}
```

## Paso 2 · Publicar con HTTPS gratis

El iPhone exige HTTPS para la cámara y para instalar la app. Dos opciones:

**GitHub Pages**
1. Crea un repositorio público `mi-bus-uai` en <https://github.com/new>.
2. **Add file → Upload files** y arrastra todos los archivos de esta carpeta. **Commit changes**.
3. **Settings → Pages → Build and deployment → Deploy from a branch → main / (root) → Save**.
4. En 1 a 2 minutos queda en `https://<tu-usuario>.github.io/mi-bus-uai/`.

**Netlify Drop** (sin repositorio)
1. Entra a <https://app.netlify.com/drop> (requiere cuenta gratuita).
2. Arrastra esta carpeta completa. Netlify entrega una dirección `https://<algo>.netlify.app`.

Cada vez que cambies `config.js` u otro archivo, vuelve a subirlo.

## Paso 3 · Preparar la demo

1. En el computador abre `https://…/qr.html` y **imprime** el QR del bus (va en la espalda del conductor). Para instalar la app basta compartir el enlace de `app.html`.
2. En el computador de la presentación abre `https://…/central.html` y pon pantalla completa (F11).
3. En cada iPhone: escanea el QR de la app con la cámara → se abre Safari → **Compartir → Agregar a pantalla de inicio**. Ábrela desde el ícono y elige recorrido **Grecia → UAI**, paradero **Av. Grecia / Tobalaba** y minutos caminando.
4. Ensaya una vez: con el iPhone, escanea el QR del bus con la **cámara normal** del iPhone y toca el aviso. La app muestra «Check-in listo» y en la central aparece en «Check-ins en vivo» con un destello en el bus.

### Cómo funciona durante la demo

- **La central no tiene botones.** Solo muestra la situación del momento: todos los buses de los dos campus se mueven solos según la hora del computador y el horario oficial de uai.cl, con sus cupos y los check-ins en vivo.
- **El QR del conductor** abre la app con `?checkin=DEMO`. El check-in va al **próximo bus del recorrido y paradero que el alumno eligió en la app** (Grecia, Dominicos o F. Castillo Velasco).
- **Capacidad máxima: 44 pasajeros por bus.** Si ese bus ya va lleno, la app no registra el check-in, avisa «Bus lleno · no se permite ir de pie» y muestra cuándo llega el siguiente. La app también avisa antes de salir de casa si el próximo bus viene lleno.
- **Fin de semana (modo ensayo).** Sábado y domingo no hay buses en Peñalolén, así que la central y la app usan el horario del **lunes** (aparece un aviso amarillo).
- **Fuera de horario** (antes de las 07:10 o después de las 21:00) no hay buses en ruta; la app muestra a qué hora pasa el primero del próximo día hábil.

Para mirar el mapa en otro momento: `central.html?fecha=2026-11-23&hora=07:50` (también sirve en `app.html`). Así se sacaron las capturas del PPT.

## Guion de la demo (unos 2 minutos)

Elijan para la presentación un recorrido con un bus que pase en ese momento (por ejemplo, a las 11:35 sale un Grecia → UAI desde Metro Grecia).

1. **Casa.** El alumno abre la app, elige su recorrido y paradero, y ve en cuántos minutos llega su bus, cuántos cupos tiene y cuándo salir de casa.
2. **Central.** Otro integrante muestra la central: el bus avanza en el mapa hacia el paradero.
3. **Paradero.** El conductor (con el QR en la espalda) llega; el alumno «sube» y escanea el QR con la cámara del iPhone. La central suena, el bus destella y suma un pasajero.
4. **Llegada.** La app muestra el viaje hasta el campus y, al llegar, la promesa: «Sabes cuándo llega tu bus y si hay cupo, antes de salir.»

Plan B si no hay internet en la sala: usen el hotspot de un celular para el computador y los iPhones. Si aun así falla, muestren la app con el check-in que ya hicieron en el ensayo.

## Qué queda por probar en un iPhone real

- Instalar la app desde Safari y abrirla como ícono (pantalla completa, sin barra de Safari).
- Escanear el QR con la cámara nativa: abre Safari (no la app instalada), pero el check-in llega igual a la central porque ambas usan Firebase.
- El lector dentro de la app (botón «Escanear QR del bus»): pide permiso de cámara y solo funciona con HTTPS.
- Tiempo entre el escaneo y el aviso en la central (objetivo: menos de 2 s con buena señal).
- Brillo y tamaño del QR en la espalda: impreso a 14 cm se lee bien a 0,5–1 m.
