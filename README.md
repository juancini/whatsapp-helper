# Respuestas Rápidas

Una app chiquita para correr en la compu de tu novia (o de cualquiera del local)
que reemplaza los `/comandos` de respuesta rápida de WhatsApp por botones que:

1. Tienen varias **variaciones** de texto para la misma respuesta.
2. Cada vez que se toca el botón, elige una variación **distinta a la
   anterior**, rotando de forma pareja entre todas — así nunca se manda
   exactamente el mismo texto dos veces seguidas, que es lo que suele activar
   el filtro de "mensajes repetitivos / spam" de WhatsApp.
3. Copia el texto elegido al portapapeles automáticamente (`Ctrl+V` directo
   en WhatsApp Web o la app).
4. Guarda un historial de todo lo que se mandó, y todo queda guardado en un
   archivo local (`data.db`) aunque cierres el programa.

No usa ninguna IA para generar texto — vos (o quien administre) cargás las
variaciones a mano una sola vez, y después es solo tocar un botón.

## Instalación en Windows (una sola vez)

1. Instalá **Python** (3.10 o más nuevo): https://www.python.org/downloads/
   Durante la instalación, marcá la casilla **"Add python.exe to PATH"**.
2. Copiá esta carpeta entera (`whatsapp-helper`) a la compu del local, por
   ejemplo en el Escritorio.
3. Hacé doble clic en **`iniciar.bat`**.
   - La primera vez va a tardar un poco (instala lo necesario).
   - Se va a abrir sola una ventana del navegador con la app.
   - Va a quedar abierta una ventana negra (la "consola") — **no la cierres**
     mientras estés usando la app. Minimizala si molesta.

Las próximas veces, con solo doble clic en `iniciar.bat` alcanza — ya no
vuelve a instalar nada, abre directo.

Para cerrar la app, cerrá la ventana negra (o Ctrl+C dentro de ella).

## Uso diario

- **Pantalla principal**: un botón por cada respuesta armada (ej. "Promo
  Sofá", "Horarios de atención"). Tocás el botón → se elige una variación,
  se copia sola, y aparece grande en pantalla para que la pegues en
  WhatsApp con `Ctrl+V`.
- **Buscador** arriba: escribí cualquier palabra (ej. "sofá", "horario") y
  filtra los botones al toque — como buscar un `/comando`.
- **"Elegir otra variación"**: si no te convence la que salió, tocás este
  botón y prueba otra sin repetir la misma dos veces.
- **"Gestionar"**: para agregar botones nuevos, sumar/editar/borrar
  variaciones de texto, o cambiar el color de un botón.
- **"Historial"**: ver (y borrar) todo lo que se mandó, con fecha y hora.

## Para varias compañeras de trabajo

Cada compu donde corras esto tiene su propio `data.db`. Si querés que **todo
el local comparta los mismos botones e historial**, la forma más simple es
correr esto en **una sola compu** (por ejemplo la de mostrador) y que las
demás la abran desde su navegador usando la IP de esa compu en la red local,
por ejemplo `http://192.168.0.15:5050` en vez de `127.0.0.1:5050`. Avisame
si querés que te arme esa parte (compartir en red local) y te ayudo a
configurarlo.

## Estructura del proyecto (por si querés tocar algo)

```
whatsapp-helper/
├── app.py              # Backend (Flask + SQLite). Toda la lógica vive acá.
├── requirements.txt    # Dependencias de Python
├── iniciar.bat         # Doble clic para arrancar todo en Windows
├── data.db             # Se crea solo al primer uso — acá vive todo lo guardado
├── templates/
│   └── index.html
└── static/
    ├── style.css
    └── app.js
```

## Notas técnicas

- La rotación evita repetir la última variación usada y prioriza las que
  menos se usaron, con algo de azar entre las empatadas — así con el tiempo
  todas las variaciones se usan parejo.
- Es un servidor Flask de desarrollo corriendo solo en `127.0.0.1` (tu propia
  compu), no expone nada a internet.
- Si en algún momento quieren que esto se conecte directo a WhatsApp Web
  (auto-pegar el mensaje sin `Ctrl+V`) o generar variaciones nuevas con IA,
  se puede sumar después — quedó afuera de este prototipo a propósito para
  mantenerlo simple y confiable.
