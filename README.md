# 🧩 Analizador de SVG

Una aplicación web sencilla para subir archivos SVG y calcular el tamaño real del dibujo contenido, útil para validar exportaciones de diseños desde Fusion 360.

## ✨ Características

- **Subida fácil**: Arrastra y suelta o selecciona archivos SVG
- **Análisis preciso**: Calcula el bounding box real del contenido vectorial
- **Vista previa**: Muestra el SVG directamente en el navegador
- **Información detallada**: Dimensiones, coordenadas y metadatos del archivo

## 🚀 Instalación y uso

### Prerrequisitos
- Node.js (versión 14 o superior)
- npm

### Instalación
```bash
# Las dependencias ya están instaladas, pero si necesitas reinstalar:
npm install
```

### Ejecutar la aplicación
```bash
npm start
```

La aplicación estará disponible en: `http://localhost:3000`

## 📁 Estructura del proyecto

```
├── client/                 # Frontend
│   ├── index.html         # Página principal
│   ├── main.js           # Lógica del cliente
│   └── styles.css        # Estilos
├── server/               # Backend
│   ├── index.js         # Servidor Express
│   └── routes/
│       └── upload.js    # Endpoint de subida y análisis
├── uploads/             # Archivos subidos
└── package.json        # Configuración del proyecto
```

## 🔧 Cómo funciona

1. **Subida**: El usuario sube un archivo SVG
2. **Parsing**: Se analiza el SVG con `svgson`
3. **Análisis**: Se extraen coordenadas de todos los elementos vectoriales:
   - `<path>` - Rutas vectoriales
   - `<line>` - Líneas
   - `<polyline>` - Polilíneas
   - `<polygon>` - Polígonos
   - `<rect>` - Rectángulos
   - `<circle>` - Círculos
   - `<ellipse>` - Elipses
4. **Cálculo**: Se determina el bounding box (área mínima que contiene todo el dibujo)
5. **Resultado**: Se muestran las dimensiones reales en píxeles

## 📏 Información proporcionada

- **Tamaño del dibujo**: Ancho × Alto en píxeles
- **Bounding box**: Coordenadas mínimas y máximas
- **Metadatos**: Información del archivo SVG (viewBox, dimensiones declaradas, etc.)

## 🎯 Propósito

Esta herramienta está diseñada para validar que los diseños exportados desde Fusion 360 mantengan las proporciones y dimensiones correctas, calculando el tamaño real del contenido vectorial independientemente de las dimensiones declaradas en el documento SVG.

## 🛠️ Tecnologías utilizadas

- **Backend**: Node.js, Express, Multer, svgson
- **Frontend**: HTML5, CSS3, JavaScript vanilla
- **Funcionalidades**: Drag & drop, análisis vectorial, vista previa
