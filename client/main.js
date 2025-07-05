// Variables globales
const fileInput = document.getElementById('fileInput');
const uploadZone = document.getElementById('uploadZone');
const resultsSection = document.getElementById('resultsSection');
const loading = document.getElementById('loading');
const errorMessage = document.getElementById('errorMessage');
const errorText = document.getElementById('errorText');

// Variables para redimensionado
let currentSvgData = null;
let originalDimensions = null;
let currentFilePath = null;

// Event listeners
fileInput.addEventListener('change', handleFileSelect);
uploadZone.addEventListener('click', () => fileInput.click());
uploadZone.addEventListener('dragover', handleDragOver);
uploadZone.addEventListener('dragleave', handleDragLeave);
uploadZone.addEventListener('drop', handleDrop);

// Event listeners para redimensionado
document.getElementById('newWidth').addEventListener('input', handleDimensionChange);
document.getElementById('newHeight').addEventListener('input', handleDimensionChange);
document.getElementById('applyResize').addEventListener('click', applyResize);
document.getElementById('downloadSvg').addEventListener('click', downloadResizedSvg);

// Drag and drop handlers
function handleDragOver(e) {
    e.preventDefault();
    uploadZone.classList.add('dragover');
}

function handleDragLeave(e) {
    e.preventDefault();
    uploadZone.classList.remove('dragover');
}

function handleDrop(e) {
    e.preventDefault();
    uploadZone.classList.remove('dragover');
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
        const file = files[0];
        if (file.type === 'image/svg+xml' || file.name.toLowerCase().endsWith('.svg')) {
            fileInput.files = files;
            uploadFile(file);
        } else {
            showError('Por favor, selecciona un archivo SVG válido.');
        }
    }
}

// File selection handler
function handleFileSelect(e) {
    const file = e.target.files[0];
    if (file) {
        uploadFile(file);
    }
}

// Upload file function
async function uploadFile(file) {
    try {
        showLoading();
        hideError();
        hideResults();
        
        const formData = new FormData();
        formData.append('svgFile', file);
        
        const response = await fetch('/api/upload', {
            method: 'POST',
            body: formData
        });
        
        const result = await response.json();
        
        if (!response.ok) {
            throw new Error(result.error || 'Error al subir el archivo');
        }
        
        if (result.success) {
            displayResults(result, file);
        } else {
            throw new Error(result.error || 'Error procesando el archivo');
        }
        
    } catch (error) {
        console.error('Error:', error);
        showError(error.message);
    } finally {
        hideLoading();
    }
}

// Display results
function displayResults(data, originalFile) {
    const { dimensions, file, svgInfo } = data;
    
    // Guardar datos para redimensionado
    currentSvgData = data;
    originalDimensions = dimensions;
    currentFilePath = file.path;
    
    // Mostrar dimensiones ajustadas (principales)
    document.getElementById('widthValue').textContent = `${dimensions.width} px (${dimensions.widthMm} mm)`;
    document.getElementById('heightValue').textContent = `${dimensions.height} px (${dimensions.heightMm} mm)`;
    document.getElementById('dimensionSummary').textContent = `${dimensions.widthMm} × ${dimensions.heightMm} mm`;
    
    // Establecer valores iniciales en los inputs de redimensionado
    document.getElementById('newWidth').value = dimensions.widthMm;
    document.getElementById('newHeight').value = dimensions.heightMm;
    
    // Mostrar bounding box
    document.getElementById('minXValue').textContent = `${dimensions.minX} px`;
    document.getElementById('minYValue').textContent = `${dimensions.minY} px`;
    document.getElementById('maxXValue').textContent = `${dimensions.maxX} px`;
    document.getElementById('maxYValue').textContent = `${dimensions.maxY} px`;
    
    // Mostrar información del archivo
    const fileInfo = document.getElementById('fileInfo');
    fileInfo.innerHTML = `
        <div style="display: grid; grid-template-columns: auto 1fr; gap: 10px 20px; align-items: center;">
            <strong>Nombre:</strong> <span>${originalFile.name}</span>
            <strong>Tamaño:</strong> <span>${formatFileSize(originalFile.size)}</span>
            <strong>Tipo:</strong> <span>${originalFile.type || 'image/svg+xml'}</span>
            <strong>Puntos analizados:</strong> <span>${dimensions.pointCount} coordenadas</span>
            <strong>SVG viewBox:</strong> <span>${svgInfo.attributes.viewBox || 'No definido'}</span>
            <strong>SVG width:</strong> <span>${svgInfo.attributes.width || 'No definido'}</span>
            <strong>SVG height:</strong> <span>${svgInfo.attributes.height || 'No definido'}</span>
        </div>
        
        <div style="margin-top: 15px; padding: 15px; background: #f0f8ff; border-radius: 8px; border-left: 4px solid #667eea;">
            <h5 style="color: #667eea; margin: 0 0 10px 0;">📊 Comparación de dimensiones</h5>
            <div style="display: grid; grid-template-columns: auto auto auto; gap: 10px; font-size: 0.9rem;">
                <strong>Medida</strong><strong>Ajustado (sin márgenes)</strong><strong>Original (con márgenes)</strong>
                <span>Ancho:</span><span>${dimensions.widthMm} mm</span><span>${dimensions.originalWidthMm} mm</span>
                <span>Alto:</span><span>${dimensions.heightMm} mm</span><span>${dimensions.originalHeightMm} mm</span>
            </div>
        </div>
    `;
    
    // Mostrar vista previa del SVG
    displaySvgPreview(file.path);
    
    // Mostrar sección de resultados
    showResults();
}

// Display SVG preview
async function displaySvgPreview(svgPath) {
    try {
        const response = await fetch(svgPath);
        
        if (!response.ok) {
            throw new Error(`Error cargando SVG: ${response.status}`);
        }
        
        const svgContent = await response.text();
        
        const svgContainer = document.getElementById('svgContainer');
        svgContainer.innerHTML = svgContent;
        
        // Ajustar el SVG para que se vea bien en el contenedor
        const svgElement = svgContainer.querySelector('svg');
        if (svgElement) {
            svgElement.style.maxWidth = '100%';
            svgElement.style.maxHeight = '280px';
            svgElement.style.width = 'auto';
            svgElement.style.height = 'auto';
            svgElement.style.border = '1px solid #ddd';
            svgElement.style.background = 'white';
        } else {
            throw new Error('No se encontró elemento SVG en el archivo');
        }
        
    } catch (error) {
        console.error('Error mostrando vista previa:', error);
        document.getElementById('svgContainer').innerHTML = `
            <div style="color: #666; padding: 20px; text-align: center;">
                <p>❌ No se pudo mostrar la vista previa del SVG</p>
                <p><small>${error.message}</small></p>
                <button onclick="location.reload()" style="margin-top: 10px; padding: 5px 15px; background: #667eea; color: white; border: none; border-radius: 4px; cursor: pointer;">
                    Recargar página
                </button>
            </div>
        `;
    }
}

// Utility functions
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function showLoading() {
    loading.style.display = 'block';
}

function hideLoading() {
    loading.style.display = 'none';
}

function showResults() {
    resultsSection.style.display = 'block';
}

function hideResults() {
    resultsSection.style.display = 'none';
}

function showError(message) {
    errorText.textContent = message;
    errorMessage.style.display = 'flex';
}

function hideError() {
    errorMessage.style.display = 'none';
}

// Funciones para redimensionado
function handleDimensionChange(e) {
    if (!originalDimensions) return;
    
    const keepAspectRatio = document.getElementById('keepAspectRatio').checked;
    if (!keepAspectRatio) return;
    
    const aspectRatio = originalDimensions.widthMm / originalDimensions.heightMm;
    
    if (e.target.id === 'newWidth') {
        const newWidth = parseFloat(e.target.value);
        if (!isNaN(newWidth)) {
            document.getElementById('newHeight').value = (newWidth / aspectRatio).toFixed(2);
        }
    } else if (e.target.id === 'newHeight') {
        const newHeight = parseFloat(e.target.value);
        if (!isNaN(newHeight)) {
            document.getElementById('newWidth').value = (newHeight * aspectRatio).toFixed(2);
        }
    }
}

async function applyResize() {
    if (!currentSvgData || !originalDimensions) {
        showError('No hay SVG cargado para redimensionar');
        return;
    }
    
    const newWidth = parseFloat(document.getElementById('newWidth').value);
    const newHeight = parseFloat(document.getElementById('newHeight').value);
    
    if (isNaN(newWidth) || isNaN(newHeight) || newWidth <= 0 || newHeight <= 0) {
        showError('Por favor, introduce dimensiones válidas');
        return;
    }
    
    try {
        showLoading();
        
        console.log('Redimensionando SVG:', {
            from: `${originalDimensions.widthMm} × ${originalDimensions.heightMm} mm`,
            to: `${newWidth} × ${newHeight} mm`,
            filePath: currentFilePath
        });
        
        const response = await fetch('/api/resize', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                filePath: currentFilePath,
                newWidthMm: newWidth,
                newHeightMm: newHeight,
                originalWidthMm: originalDimensions.widthMm,
                originalHeightMm: originalDimensions.heightMm
            })
        });
        
        const result = await response.json();
        
        if (!response.ok) {
            throw new Error(result.error || 'Error al redimensionar');
        }
        
        console.log('Redimensionado exitoso:', result);
        
        // Actualizar vista previa con el SVG redimensionado
        await displaySvgPreview(result.resizedSvgPath);
        
        // Mostrar botón de descarga
        document.getElementById('downloadSvg').style.display = 'inline-block';
        document.getElementById('downloadSvg').dataset.path = result.resizedSvgPath;
        
        // Actualizar el resumen de dimensiones
        document.getElementById('dimensionSummary').innerHTML = `
            ${newWidth} × ${newHeight} mm (redimensionado)<br>
            <small style="color: #666;">Escala aplicada: ${result.scaleX} × ${result.scaleY}</small>
        `;
        
        // Actualizar información detallada si existe el panel
        const infoDiv = document.getElementById('dimension-info');
        if (infoDiv && result.newDimensions) {
            infoDiv.innerHTML = `
                <h3>SVG Redimensionado</h3>
                <div class="info-row">
                    <span class="label">Nuevas dimensiones:</span>
                    <span class="value">${result.newDimensions.widthMm} × ${result.newDimensions.heightMm} mm</span>
                </div>
                <div class="info-row">
                    <span class="label">Dimensiones en píxeles:</span>
                    <span class="value">${result.newDimensions.widthPx} × ${result.newDimensions.heightPx} px</span>
                </div>
                <div class="info-row">
                    <span class="label">Escala aplicada:</span>
                    <span class="value">X: ${result.scaleX}, Y: ${result.scaleY}</span>
                </div>
                <div class="info-row">
                    <span class="label">Tamaño del contenido:</span>
                    <span class="value">${result.newDimensions.contentWidthPx} × ${result.newDimensions.contentHeightPx} px</span>
                </div>
                ${result.newDimensions.centered ? `
                <div class="info-row">
                    <span class="label">Centrado aplicado:</span>
                    <span class="value">✓ Offset: ${result.newDimensions.offsetX}, ${result.newDimensions.offsetY} px</span>
                </div>
                ` : ''}
            `;
        }
        
        hideError();
        
    } catch (error) {
        console.error('Error completo:', error);
        showError(`Error al redimensionar: ${error.message}`);
    } finally {
        hideLoading();
    }
}

function downloadResizedSvg() {
    const downloadPath = document.getElementById('downloadSvg').dataset.path;
    if (downloadPath) {
        const link = document.createElement('a');
        link.href = downloadPath;
        link.download = 'resized_' + (currentSvgData?.file?.originalName || 'svg_file.svg');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
}

// Global function for error close button
window.hideError = hideError;
