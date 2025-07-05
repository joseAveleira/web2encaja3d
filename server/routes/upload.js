const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const svgson = require('svgson');

const router = express.Router();

// Configuración de multer para subida de archivos
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, path.join(__dirname, '../../uploads'));
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ 
    storage: storage,
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'image/svg+xml' || path.extname(file.originalname).toLowerCase() === '.svg') {
            cb(null, true);
        } else {
            cb(new Error('Solo se permiten archivos SVG'), false);
        }
    }
});

// Función para calcular bounding box de elementos SVG
function calculateBoundingBox(element) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    let pointCount = 0;
    
    function extractNumbers(str) {
        if (!str) return [];
        return str.match(/-?\d+\.?\d*/g)?.map(Number) || [];
    }
    
    function updateBounds(x, y) {
        if (x !== undefined && y !== undefined && !isNaN(x) && !isNaN(y)) {
            minX = Math.min(minX, x);
            minY = Math.min(minY, y);
            maxX = Math.max(maxX, x);
            maxY = Math.max(maxY, y);
            pointCount++;
        }
    }
    
    // Función para parsear transformaciones matrix
    function parseTransform(transformStr) {
        if (!transformStr) return { scaleX: 1, scaleY: 1, translateX: 0, translateY: 0 };
        
        const matrixMatch = transformStr.match(/matrix\(\s*([^)]+)\s*\)/);
        if (matrixMatch) {
            const values = matrixMatch[1].split(/[,\s]+/).map(Number);
            if (values.length >= 6) {
                return {
                    scaleX: values[0],
                    scaleY: values[3],
                    translateX: values[4],
                    translateY: values[5]
                };
            }
        }
        
        // Parsear translate
        const translateMatch = transformStr.match(/translate\(\s*([^)]+)\s*\)/);
        if (translateMatch) {
            const values = translateMatch[1].split(/[,\s]+/).map(Number);
            return {
                scaleX: 1,
                scaleY: 1,
                translateX: values[0] || 0,
                translateY: values[1] || 0
            };
        }
        
        return { scaleX: 1, scaleY: 1, translateX: 0, translateY: 0 };
    }
    
    function processElement(el, transform = { scaleX: 1, scaleY: 1, translateX: 0, translateY: 0 }) {
        const attrs = el.attributes || {};
        
        // Aplicar transformación del elemento actual
        let currentTransform = transform;
        if (attrs.transform) {
            const elementTransform = parseTransform(attrs.transform);
            currentTransform = {
                scaleX: transform.scaleX * elementTransform.scaleX,
                scaleY: transform.scaleY * elementTransform.scaleY,
                translateX: transform.translateX + elementTransform.translateX * transform.scaleX,
                translateY: transform.translateY + elementTransform.translateY * transform.scaleY
            };
        }
        
        function applyTransform(x, y) {
            return {
                x: x * currentTransform.scaleX + currentTransform.translateX,
                y: y * currentTransform.scaleY + currentTransform.translateY
            };
        }
        
        switch (el.name) {
            case 'path':
                if (attrs.d) {
                    // Análisis más preciso del path data
                    const pathData = attrs.d.replace(/([MmLlHhVvCcSsQqTtAaZz])/g, '|$1 ').split('|').filter(s => s.trim());
                    
                    let currentX = 0, currentY = 0;
                    
                    for (let segment of pathData) {
                        const command = segment.trim().charAt(0);
                        const coords = extractNumbers(segment.substring(1));
                        
                        switch (command.toUpperCase()) {
                            case 'M': // MoveTo
                                if (coords.length >= 2) {
                                    currentX = command === 'M' ? coords[0] : currentX + coords[0];
                                    currentY = command === 'M' ? coords[1] : currentY + coords[1];
                                    const transformed = applyTransform(currentX, currentY);
                                    updateBounds(transformed.x, transformed.y);
                                }
                                break;
                            case 'L': // LineTo
                                for (let i = 0; i < coords.length; i += 2) {
                                    if (coords[i + 1] !== undefined) {
                                        currentX = command === 'L' ? coords[i] : currentX + coords[i];
                                        currentY = command === 'L' ? coords[i + 1] : currentY + coords[i + 1];
                                        const transformed = applyTransform(currentX, currentY);
                                        updateBounds(transformed.x, transformed.y);
                                    }
                                }
                                break;
                            case 'Q': // Quadratic Bezier
                                for (let i = 0; i < coords.length; i += 4) {
                                    if (coords[i + 3] !== undefined) {
                                        // Control point
                                        const cpX = command === 'Q' ? coords[i] : currentX + coords[i];
                                        const cpY = command === 'Q' ? coords[i + 1] : currentY + coords[i + 1];
                                        // End point
                                        currentX = command === 'Q' ? coords[i + 2] : currentX + coords[i + 2];
                                        currentY = command === 'Q' ? coords[i + 3] : currentY + coords[i + 3];
                                        
                                        const cp = applyTransform(cpX, cpY);
                                        const end = applyTransform(currentX, currentY);
                                        updateBounds(cp.x, cp.y);
                                        updateBounds(end.x, end.y);
                                    }
                                }
                                break;
                            default:
                                // Para otros comandos, usar todas las coordenadas como puntos
                                for (let i = 0; i < coords.length; i += 2) {
                                    if (coords[i + 1] !== undefined) {
                                        const x = command === command.toUpperCase() ? coords[i] : currentX + coords[i];
                                        const y = command === command.toUpperCase() ? coords[i + 1] : currentY + coords[i + 1];
                                        const transformed = applyTransform(x, y);
                                        updateBounds(transformed.x, transformed.y);
                                        if (command.toUpperCase() !== 'C' && command.toUpperCase() !== 'S') {
                                            currentX = x;
                                            currentY = y;
                                        }
                                    }
                                }
                        }
                    }
                }
                break;
                
            case 'line':
                const line1 = applyTransform(parseFloat(attrs.x1 || 0), parseFloat(attrs.y1 || 0));
                const line2 = applyTransform(parseFloat(attrs.x2 || 0), parseFloat(attrs.y2 || 0));
                updateBounds(line1.x, line1.y);
                updateBounds(line2.x, line2.y);
                break;
                
            case 'polyline':
            case 'polygon':
                if (attrs.points) {
                    const coords = extractNumbers(attrs.points);
                    for (let i = 0; i < coords.length; i += 2) {
                        if (coords[i + 1] !== undefined) {
                            const transformed = applyTransform(coords[i], coords[i + 1]);
                            updateBounds(transformed.x, transformed.y);
                        }
                    }
                }
                break;
                
            case 'rect':
                const x = parseFloat(attrs.x || 0);
                const y = parseFloat(attrs.y || 0);
                const width = parseFloat(attrs.width || 0);
                const height = parseFloat(attrs.height || 0);
                
                const rect1 = applyTransform(x, y);
                const rect2 = applyTransform(x + width, y + height);
                updateBounds(rect1.x, rect1.y);
                updateBounds(rect2.x, rect2.y);
                break;
                
            case 'circle':
                const cx = parseFloat(attrs.cx || 0);
                const cy = parseFloat(attrs.cy || 0);
                const r = parseFloat(attrs.r || 0);
                
                const circle1 = applyTransform(cx - r, cy - r);
                const circle2 = applyTransform(cx + r, cy + r);
                updateBounds(circle1.x, circle1.y);
                updateBounds(circle2.x, circle2.y);
                break;
                
            case 'ellipse':
                const ecx = parseFloat(attrs.cx || 0);
                const ecy = parseFloat(attrs.cy || 0);
                const rx = parseFloat(attrs.rx || 0);
                const ry = parseFloat(attrs.ry || 0);
                
                const ellipse1 = applyTransform(ecx - rx, ecy - ry);
                const ellipse2 = applyTransform(ecx + rx, ecy + ry);
                updateBounds(ellipse1.x, ellipse1.y);
                updateBounds(ellipse2.x, ellipse2.y);
                break;
        }
        
        // Procesar elementos hijos recursivamente con la transformación acumulada
        if (el.children && el.children.length > 0) {
            el.children.forEach(child => processElement(child, currentTransform));
        }
    }
    
    processElement(element);
    
    if (minX === Infinity || pointCount === 0) {
        return { width: 0, height: 0, minX: 0, minY: 0, maxX: 0, maxY: 0 };
    }
    
    // Aplicar un pequeño ajuste para eliminar márgenes de renderizado
    const MARGIN_ADJUSTMENT = 0.5; // Eliminar pequeño margen
    const adjustedMinX = minX + MARGIN_ADJUSTMENT;
    const adjustedMinY = minY + MARGIN_ADJUSTMENT;
    const adjustedMaxX = maxX - MARGIN_ADJUSTMENT;
    const adjustedMaxY = maxY - MARGIN_ADJUSTMENT;
    
    return {
        width: Math.max(0, adjustedMaxX - adjustedMinX),
        height: Math.max(0, adjustedMaxY - adjustedMinY),
        minX: adjustedMinX,
        minY: adjustedMinY,
        maxX: adjustedMaxX,
        maxY: adjustedMaxY,
        originalWidth: maxX - minX,
        originalHeight: maxY - minY,
        pointCount
    };
}

// Endpoint para subir y analizar archivo SVG
router.post('/upload', upload.single('svgFile'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No se ha subido ningún archivo' });
        }
        
        const filePath = req.file.path;
        
        // Leer el archivo SVG
        const svgContent = fs.readFileSync(filePath, 'utf8');
        
        // Parsear el SVG
        const svgData = await svgson.parse(svgContent);
        
        // Calcular bounding box del contenido
        const bounds = calculateBoundingBox(svgData);
        
        // Conversión aproximada de píxeles a milímetros (96 DPI estándar)
        const PX_TO_MM = 25.4 / 96; // 1 inch = 25.4mm, 96 DPI
        
        // Información del archivo
        const fileInfo = {
            filename: req.file.filename,
            originalName: req.file.originalname,
            size: req.file.size,
            path: `/uploads/${req.file.filename}`
        };
        
        // Respuesta con toda la información
        res.json({
            success: true,
            file: fileInfo,
            dimensions: {
                // Dimensiones ajustadas (sin márgenes)
                width: Math.round(bounds.width * 100) / 100,
                height: Math.round(bounds.height * 100) / 100,
                widthMm: Math.round(bounds.width * PX_TO_MM * 100) / 100,
                heightMm: Math.round(bounds.height * PX_TO_MM * 100) / 100,
                
                // Dimensiones originales (con márgenes)
                originalWidth: Math.round(bounds.originalWidth * 100) / 100,
                originalHeight: Math.round(bounds.originalHeight * 100) / 100,
                originalWidthMm: Math.round(bounds.originalWidth * PX_TO_MM * 100) / 100,
                originalHeightMm: Math.round(bounds.originalHeight * PX_TO_MM * 100) / 100,
                
                minX: Math.round(bounds.minX * 100) / 100,
                minY: Math.round(bounds.minY * 100) / 100,
                maxX: Math.round(bounds.maxX * 100) / 100,
                maxY: Math.round(bounds.maxY * 100) / 100,
                pointCount: bounds.pointCount
            },
            svgInfo: {
                name: svgData.name,
                attributes: svgData.attributes || {}
            }
        });
        
    } catch (error) {
        console.error('Error procesando SVG:', error);
        res.status(500).json({ error: 'Error procesando el archivo SVG: ' + error.message });
    }
});

// Endpoint para redimensionar SVG
router.post('/resize', async (req, res) => {
    try {
        const { filePath, newWidthMm, newHeightMm, originalWidthMm, originalHeightMm } = req.body;
        
        if (!filePath || !newWidthMm || !newHeightMm || !originalWidthMm || !originalHeightMm) {
            return res.status(400).json({ error: 'Parámetros de redimensionado incompletos' });
        }
        
        // Leer el SVG original
        const originalPath = path.join(__dirname, '../..', filePath);
        const svgContent = fs.readFileSync(originalPath, 'utf8');
        
        // Parsear el SVG
        const svgData = await svgson.parse(svgContent);
        
        // Calcular factor de escala
        const scaleX = newWidthMm / originalWidthMm;
        const scaleY = newHeightMm / originalHeightMm;
        
        console.log('Escalando contenido del path:', {
            originalWidthMm,
            originalHeightMm,
            newWidthMm,
            newHeightMm,
            scaleX,
            scaleY
        });
        
        // Función para escalar coordenadas en el path data correctamente
        function scalePathData(pathData, scaleX, scaleY) {
            // Separar comandos y coordenadas
            const pathSegments = pathData.replace(/([MmLlHhVvCcSsQqTtAaZz])/g, '|$1 ').split('|').filter(s => s.trim());
            
            let scaledPath = '';
            
            for (let segment of pathSegments) {
                const command = segment.trim().charAt(0);
                const coordsStr = segment.substring(1).trim();
                
                if (!coordsStr) {
                    scaledPath += command;
                    continue;
                }
                
                const coords = coordsStr.match(/-?\d+\.?\d*/g)?.map(Number) || [];
                let scaledCoords = [];
                
                // Escalar coordenadas según el tipo de comando
                switch (command.toUpperCase()) {
                    case 'M': // MoveTo
                    case 'L': // LineTo
                        for (let i = 0; i < coords.length; i += 2) {
                            if (coords[i + 1] !== undefined) {
                                scaledCoords.push((coords[i] * scaleX).toFixed(2));
                                scaledCoords.push((coords[i + 1] * scaleY).toFixed(2));
                            }
                        }
                        break;
                    case 'Q': // Quadratic Bezier
                        for (let i = 0; i < coords.length; i += 4) {
                            if (coords[i + 3] !== undefined) {
                                scaledCoords.push((coords[i] * scaleX).toFixed(2));     // control x
                                scaledCoords.push((coords[i + 1] * scaleY).toFixed(2)); // control y
                                scaledCoords.push((coords[i + 2] * scaleX).toFixed(2)); // end x
                                scaledCoords.push((coords[i + 3] * scaleY).toFixed(2)); // end y
                            }
                        }
                        break;
                    default:
                        // Para otros comandos, alternar entre X e Y
                        for (let i = 0; i < coords.length; i += 2) {
                            if (coords[i + 1] !== undefined) {
                                scaledCoords.push((coords[i] * scaleX).toFixed(2));
                                scaledCoords.push((coords[i + 1] * scaleY).toFixed(2));
                            }
                        }
                }
                
                scaledPath += command + ' ' + scaledCoords.join(' ') + ' ';
            }
            
            return scaledPath.trim();
        }
        
        // Función recursiva para escalar elementos
        function scaleElement(element) {
            if (element.name === 'path' && element.attributes && element.attributes.d) {
                // Escalar las coordenadas del path directamente
                element.attributes.d = scalePathData(element.attributes.d, scaleX, scaleY);
            }
            
            // Procesar elementos hijos
            if (element.children && element.children.length > 0) {
                element.children.forEach(scaleElement);
            }
        }
        
        // Aplicar escalado a todos los elementos
        scaleElement(svgData);
        
        // ELIMINAR la transformación matrix existente ya que hemos escalado el contenido directamente
        function removeTransforms(element) {
            if (element.attributes && element.attributes.transform) {
                delete element.attributes.transform;
            }
            if (element.children && element.children.length > 0) {
                element.children.forEach(removeTransforms);
            }
        }
        
        removeTransforms(svgData);
        
        // Calcular el bounding box del contenido escalado
        const scaledBounds = calculateBoundingBox(svgData);
        
        // Usar las dimensiones exactas solicitadas por el usuario
        const MM_TO_PX = 96 / 25.4;
        const docWidthPx = Math.round(newWidthMm * MM_TO_PX);
        const docHeightPx = Math.round(newHeightMm * MM_TO_PX);
        
        // Calcular el centrado necesario para posicionar el contenido en el centro del documento
        const offsetX = (docWidthPx - scaledBounds.width) / 2 - scaledBounds.minX;
        const offsetY = (docHeightPx - scaledBounds.height) / 2 - scaledBounds.minY;
        
        console.log('Centrado calculado:', { 
            offsetX: offsetX.toFixed(2), 
            offsetY: offsetY.toFixed(2),
            docSize: `${docWidthPx}x${docHeightPx}px`,
            contentSize: `${scaledBounds.width.toFixed(1)}x${scaledBounds.height.toFixed(1)}px`,
            contentPosition: `${scaledBounds.minX.toFixed(1)},${scaledBounds.minY.toFixed(1)}`
        });
        
        // Aplicar centrado creando un grupo contenedor
        if (svgData.children && svgData.children.length > 0) {
            const centeredGroup = {
                name: 'g',
                type: 'element',
                attributes: {
                    transform: `translate(${offsetX.toFixed(2)}, ${offsetY.toFixed(2)})`
                },
                children: [...svgData.children]
            };
            
            // Reemplazar los hijos del SVG con el grupo centrado
            svgData.children = [centeredGroup];
        }
        
        // Actualizar atributos del SVG raíz
        svgData.attributes.width = `${docWidthPx}px`;
        svgData.attributes.height = `${docHeightPx}px`;
        svgData.attributes.viewBox = `0 0 ${docWidthPx} ${docHeightPx}`;
        
        // Convertir de vuelta a SVG
        const resizedSvgContent = svgson.stringify(svgData);
        
        // Crear nombre de archivo para la versión redimensionada
        const timestamp = Date.now();
        const resizedFilename = `resized_${timestamp}_${newWidthMm}x${newHeightMm}mm.svg`;
        const resizedPath = path.join(__dirname, '../../uploads', resizedFilename);
        
        // Guardar el SVG redimensionado
        fs.writeFileSync(resizedPath, resizedSvgContent, 'utf8');
        
        res.json({
            success: true,
            resizedSvgPath: `/uploads/${resizedFilename}`,
            scaleX: scaleX.toFixed(4),
            scaleY: scaleY.toFixed(4),
            newDimensions: {
                widthMm: newWidthMm,
                heightMm: newHeightMm,
                widthPx: docWidthPx,
                heightPx: docHeightPx,
                contentWidthPx: Math.round(scaledBounds.width),
                contentHeightPx: Math.round(scaledBounds.height),
                offsetX: Math.round(offsetX * 100) / 100,
                offsetY: Math.round(offsetY * 100) / 100,
                centered: true
            }
        });
        
    } catch (error) {
        console.error('Error redimensionando SVG:', error);
        res.status(500).json({ error: 'Error redimensionando el archivo SVG: ' + error.message });
    }
});

module.exports = router;
