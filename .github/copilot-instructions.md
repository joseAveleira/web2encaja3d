<!-- Use this file to provide workspace-specific custom instructions to Copilot. For more details, visit https://code.visualstudio.com/docs/copilot/copilot-customization#_use-a-githubcopilotinstructionsmd-file -->

# SVG Analyzer Project

Este es un proyecto Node.js + Express para analizar archivos SVG y calcular el tamaño real del dibujo contenido.

## Características principales:
- Subida de archivos SVG mediante drag & drop o selección
- Parsing de elementos vectoriales (path, line, polyline, polygon, rect, circle, ellipse)
- Cálculo de bounding box del contenido real
- Vista previa del SVG
- Interfaz moderna y responsive

## Estructura del proyecto:
- `/client/` - Frontend (HTML, CSS, JS)
- `/server/` - Backend Express con routes
- `/uploads/` - Archivos subidos
- `server/routes/upload.js` - Lógica de análisis SVG

## Tecnologías:
- Backend: Node.js, Express, Multer, svgson
- Frontend: HTML5, CSS3, JavaScript vanilla
- Parsing SVG: svgson para conversión a JSON

## Funcionalidades implementadas:
- Análisis preciso de elementos vectoriales
- Cálculo de bounding box real (ignorando viewBox si es necesario)
- Interfaz intuitiva con feedback visual
- Manejo de errores robusto
