document.addEventListener('DOMContentLoaded', function() {
    // DOM Elements
    const fileInput = document.getElementById('file-input');
    const dropArea = document.getElementById('drop-area');
    const previewContainer = document.getElementById('preview-container');
    const extractBtn = document.getElementById('extract-btn');
    const resultText = document.getElementById('result-text');
    const copyBtn = document.getElementById('copy-btn');
    const clearBtn = document.getElementById('clear-btn');
    const languageSelect = document.getElementById('language-select');
    const fastModeCheckbox = document.getElementById('fast-mode');
    const progressBar = document.getElementById('progress-bar');
    const pdfControls = document.getElementById('pdf-controls');
    const prevPageBtn = document.getElementById('prev-page');
    const nextPageBtn = document.getElementById('next-page');
    const currentPageEl = document.getElementById('current-page');
    const totalPagesEl = document.getElementById('total-pages');

    let currentFile = null;
    let pdfDoc = null;
    let currentPageNum = 1;
    let isProcessing = false;

    // File input handling
    fileInput.addEventListener('change', handleFileSelect);
    
    // Drag and drop handling
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropArea.addEventListener(eventName, preventDefaults, false);
        document.body.addEventListener(eventName, preventDefaults, false);
    });

    ['dragenter', 'dragover'].forEach(eventName => {
        dropArea.addEventListener(eventName, highlight, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropArea.addEventListener(eventName, unhighlight, false);
    });

    dropArea.addEventListener('drop', handleDrop, false);

    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    function highlight() {
        dropArea.classList.add('highlight');
    }

    function unhighlight() {
        dropArea.classList.remove('highlight');
    }

    function handleDrop(e) {
        const dt = e.dataTransfer;
        const files = dt.files;
        if (files.length) {
            fileInput.files = files;
            handleFileSelect({ target: { files } });
        }
    }

    async function handleFileSelect(e) {
        const files = e.target.files;
        if (!files.length) return;

        currentFile = files[0];
        
        // Reset PDF controls
        pdfControls.classList.add('d-none');
        pdfDoc = null;
        currentPageNum = 1;

        // Check file type
        if (currentFile.type === 'application/pdf') {
            await loadPdf(currentFile);
        } else if (currentFile.type.startsWith('image/')) {
            displayImage(URL.createObjectURL(currentFile));
        } else {
            Swal.fire({
                icon: 'error',
                title: 'Invalid File',
                text: 'Please upload an image or PDF file.'
            });
            return;
        }
    }

    async function loadPdf(file) {
        try {
            const arrayBuffer = await file.arrayBuffer();
            pdfDoc = await pdfjsLib.getDocument(arrayBuffer).promise;
            
            totalPagesEl.textContent = pdfDoc.numPages;
            pdfControls.classList.remove('d-none');
            
            await renderPdfPage(currentPageNum);
        } catch (error) {
            console.error("PDF Error:", error);
            Swal.fire({
                icon: 'error',
                title: 'PDF Error',
                text: 'Could not load the PDF file.'
            });
        }
    }

    async function renderPdfPage(pageNum) {
        if (!pdfDoc) return;
        
        const page = await pdfDoc.getPage(pageNum);
        const viewport = page.getViewport({ scale: 1.5 });
        
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        
        await page.render({
            canvasContext: context,
            viewport: viewport
        }).promise;
        
        displayImage(canvas.toDataURL('image/jpeg'));
        currentPageEl.textContent = pageNum;
    }

    function displayImage(src) {
        previewContainer.innerHTML = '';
        const img = document.createElement('img');
        img.src = src;
        img.classList.add('img-preview');
        previewContainer.appendChild(img);
    }

    // PDF page navigation
    prevPageBtn.addEventListener('click', async () => {
        if (currentPageNum > 1) {
            currentPageNum--;
            await renderPdfPage(currentPageNum);
        }
    });

    nextPageBtn.addEventListener('click', async () => {
        if (pdfDoc && currentPageNum < pdfDoc.numPages) {
            currentPageNum++;
            await renderPdfPage(currentPageNum);
        }
    });

    // Extract text
    extractBtn.addEventListener('click', async () => {
        if (isProcessing) return;
        
        if (!currentFile) {
            Swal.fire({
                icon: 'error',
                title: 'No File',
                text: 'Please upload a file first.'
            });
            return;
        }

        isProcessing = true;
        extractBtn.disabled = true;
        progressBar.classList.remove('d-none');
        
        try {
            const selectedLanguage = languageSelect.value;
            const useFastMode = fastModeCheckbox.checked;
            
            // Get image from preview
            const imgElement = previewContainer.querySelector('img');
            if (!imgElement) throw new Error('No image available');
            
            // Configure Tesseract for faster processing
            const config = {
                lang: selectedLanguage,
                logger: m => {
                    if (m.status === 'recognizing text') {
                        const progress = Math.round(m.progress * 100);
                        progressBar.querySelector('.progress-bar').style.width = `${progress}%`;
                    }
                },
                tessedit_pageseg_mode: useFastMode ? 6 : 3, // 6 = sparse text, 3 = auto
                tessedit_char_whitelist: useFastMode ? '' : '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ.,!?()/-&%$'
            };

            const result = await Tesseract.recognize(imgElement, config);
            
            resultText.value = result.data.text;
            
            if (!result.data.text.trim()) {
                Swal.fire({
                    icon: 'warning',
                    title: 'No Text Found',
                    text: 'No text was detected in the document.'
                });
            }
        } catch (error) {
            console.error("OCR Error:", error);
            Swal.fire({
                icon: 'error',
                title: 'Extraction Failed',
                text: 'An error occurred during text extraction.'
            });
        } finally {
            isProcessing = false;
            extractBtn.disabled = false;
            progressBar.classList.add('d-none');
        }
    });

    // Copy text
    copyBtn.addEventListener('click', () => {
        if (!resultText.value.trim()) {
            Swal.fire({
                icon: 'error',
                title: 'No Text',
                text: 'There is no text to copy.'
            });
            return;
        }
        
        resultText.select();
        document.execCommand('copy');
        
        Swal.fire({
            icon: 'success',
            title: 'Copied!',
            text: 'Text has been copied to clipboard.',
            timer: 2000,
            showConfirmButton: false
        });
    });

    // Clear all
    clearBtn.addEventListener('click', () => {
        currentFile = null;
        previewContainer.innerHTML = '';
        resultText.value = '';
        fileInput.value = '';
        pdfControls.classList.add('d-none');
    });
});