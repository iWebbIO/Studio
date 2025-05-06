// OS Interface State
let isFullscreen = false;
let windows = new Map(); // Map of window IDs to window elements
let activeWindow = null;
let zIndex = 1000;

// Initialize database
const db = new DocumentDB();
let tableDialog, exportDialog;

// Initialize marked with options
marked.setOptions({
    highlight: function(code, lang) {
        if (lang && hljs.getLanguage(lang)) {
            return hljs.highlight(code, { language: lang }).value;
        }
        return hljs.highlightAuto(code).value;
    },
    breaks: true,
    gfm: true,
    tables: true,
    headerIds: true,
    mangle: false
});

// Global variables
let editor, preview, themeToggle, langSelect, documentTitle, wordCount,
    lastSaved, cursorPosition, selectionCount, searchInput, folderTree;
let currentDocument = null;
let searchResults = [];
let currentSearchIndex = -1;

// Loading Screen
function showLoading() {
    const loadingScreen = document.getElementById('loading-screen');
    const app = document.querySelector('.app');
    if (loadingScreen && app) {
        loadingScreen.style.display = 'flex';
        app.style.display = 'none';
    }
}

function hideLoading() {
    const loadingScreen = document.getElementById('loading-screen');
    const app = document.querySelector('.app');
    if (loadingScreen && app) {
        loadingScreen.classList.add('fade-out');
        setTimeout(() => {
            loadingScreen.style.display = 'none';
            app.style.display = 'flex';
        }, 300); // Match the CSS transition duration
    }
}

// Initialize DOM elements and event listeners
function initializeElements() {
    // Initialize dialogs first
    tableDialog = document.getElementById('tableDialog');
    exportDialog = document.getElementById('exportDialog');

    // Initialize other elements
    editor = document.getElementById('editor');
    preview = document.getElementById('preview');
    themeToggle = document.getElementById('themeToggle');
    langSelect = document.getElementById('langSelect');
    documentTitle = document.getElementById('documentTitle');
    wordCount = document.getElementById('wordCount');
    lastSaved = document.getElementById('lastSaved');
    cursorPosition = document.getElementById('cursorPosition');
    selectionCount = document.getElementById('selectionCount');
    searchInput = document.getElementById('searchInput');
    folderTree = document.getElementById('folderTree');

    // Initialize theme
    document.documentElement.setAttribute('data-theme', 
        localStorage.getItem('theme') || 'light');

    // Event Listeners
    editor.addEventListener('input', () => {
        updatePreview();
        updateWordCount();
        saveDocument();
    });

    editor.addEventListener('keydown', (e) => {
        handleKeyboardShortcuts(e);
        handleListContinuation(e);
    });
    editor.addEventListener('select', updateSelectionCount);
    editor.addEventListener('click', updateCursorPosition);
    editor.addEventListener('keyup', updateCursorPosition);

    documentTitle.addEventListener('change', () => {
        if (currentDocument) {
            saveDocument();
        }
    });

    searchInput.addEventListener('input', () => {
        if (searchInput.value) {
            findInText(searchInput.value);
        }
    });
}

// Functions
async function createNewDocument() {
    const doc = await db.createDocument('Untitled Document', '');
    await loadDocument(doc.id);
}

async function loadDocument(id) {
    currentDocument = await db.getDocument(id);
    documentTitle.value = currentDocument.title;
    editor.value = currentDocument.content;
    updatePreview();
    updateWordCount();
    updateLastSaved();
}

async function saveDocument() {
    if (!currentDocument) return;

    const updates = {
        title: documentTitle.value,
        content: editor.value
    };

    try {
        currentDocument = await db.updateDocument(currentDocument.id, updates);
        updateLastSaved();
        showNotification('Document saved');
    } catch (error) {
        showNotification('Failed to save document', 'error');
    }
}

function updatePreview() {
    const content = editor.value;
    preview.innerHTML = marked.parse(content);
    preview.querySelectorAll('pre code').forEach((block) => {
        hljs.highlightElement(block);
    });
}

function updateWordCount() {
    const text = editor.value.trim();
    const words = text ? text.split(/\s+/).length : 0;
    wordCount.textContent = `Words: ${words}`;
}

function updateLastSaved() {
    const date = new Date(currentDocument.modified);
    lastSaved.textContent = `Last saved: ${date.toLocaleTimeString()}`;
}

function updateCursorPosition() {
    const pos = editor.selectionStart;
    const text = editor.value.substring(0, pos);
    const lines = text.split('\n');
    const line = lines.length;
    const column = lines[lines.length - 1].length + 1;
    cursorPosition.textContent = `Line: ${line}, Column: ${column}`;
}

function updateSelectionCount() {
    const selected = editor.value.substring(editor.selectionStart, editor.selectionEnd);
    const words = selected ? selected.split(/\s+/).length : 0;
    selectionCount.textContent = `Selected: ${words} words`;
}

function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    
    themeToggle.innerHTML = `<span class="material-icons">
        ${newTheme === 'light' ? 'dark_mode' : 'light_mode'}
    </span>`;
}

// Heading Menu
function showHeadingMenu(event) {
    const headingLevels = [
        { text: 'Heading 1', prefix: '# ' },
        { text: 'Heading 2', prefix: '## ' },
        { text: 'Heading 3', prefix: '### ' },
        { text: 'Heading 4', prefix: '#### ' },
        { text: 'Heading 5', prefix: '##### ' },
        { text: 'Heading 6', prefix: '###### ' }
    ];

    const menu = document.createElement('div');
    menu.className = 'heading-menu';
    menu.style.position = 'absolute';
    menu.style.zIndex = '1000';
    menu.style.backgroundColor = 'var(--primary-bg)';
    menu.style.border = '1px solid var(--border-color)';
    menu.style.borderRadius = '4px';
    menu.style.boxShadow = '0 2px 8px var(--shadow-color)';

    headingLevels.forEach(({ text, prefix }) => {
        const item = document.createElement('div');
        item.className = 'heading-menu-item';
        item.textContent = text;
        item.style.padding = '8px 16px';
        item.style.cursor = 'pointer';
        item.style.transition = 'background-color 0.2s';

        item.addEventListener('mouseover', () => {
            item.style.backgroundColor = 'var(--button-hover)';
        });
        item.addEventListener('mouseout', () => {
            item.style.backgroundColor = '';
        });

        item.addEventListener('click', () => {
            insertMarkdown(prefix, '');
            menu.remove();
        });

        menu.appendChild(item);
    });

    const rect = event.target.getBoundingClientRect();
    menu.style.top = `${rect.bottom + window.scrollY}px`;
    menu.style.left = `${rect.left + window.scrollX}px`;

    document.addEventListener('click', function closeMenu(e) {
        if (!menu.contains(e.target) && e.target !== event.target) {
            menu.remove();
            document.removeEventListener('click', closeMenu);
        }
    });

    document.body.appendChild(menu);
}

function insertMarkdown(prefix, suffix) {
    const start = editor.selectionStart;
    const end = editor.selectionEnd;
    const selectedText = editor.value.substring(start, end);
    const beforeText = editor.value.substring(0, start);
    const afterText = editor.value.substring(end);

    editor.value = beforeText + prefix + selectedText + suffix + afterText;
    
    const newCursorPos = start + prefix.length + selectedText.length + suffix.length;
    editor.setSelectionRange(newCursorPos, newCursorPos);
    
    editor.focus();
    updatePreview();
    saveDocument();
}

function changeDirection() {
    const direction = langSelect.value;
    editor.setAttribute('dir', direction);
    preview.setAttribute('dir', direction);
    
    if (direction === 'rtl') {
        editor.style.textAlign = 'right';
        preview.style.textAlign = 'right';
    } else {
        editor.style.textAlign = 'left';
        preview.style.textAlign = 'left';
    }
}

// Search and Replace Functions
function findInText(searchText) {
    const content = editor.value;
    searchResults = [];
    let match;
    const regex = new RegExp(searchText, 'gi');
    
    while ((match = regex.exec(content)) !== null) {
        searchResults.push(match.index);
    }
    
    currentSearchIndex = -1;
    if (searchResults.length > 0) {
        findNext();
    }
}

function findNext() {
    if (searchResults.length === 0) return;
    
    currentSearchIndex = (currentSearchIndex + 1) % searchResults.length;
    const position = searchResults[currentSearchIndex];
    editor.setSelectionRange(position, position + searchInput.value.length);
    editor.focus();
}

function findPrevious() {
    if (searchResults.length === 0) return;
    
    currentSearchIndex = (currentSearchIndex - 1 + searchResults.length) % searchResults.length;
    const position = searchResults[currentSearchIndex];
    editor.setSelectionRange(position, position + searchInput.value.length);
    editor.focus();
}

function toggleReplace() {
    const searchText = searchInput.value;
    const replaceText = prompt('Replace with:', '');
    if (replaceText !== null) {
        const content = editor.value;
        editor.value = content.replace(new RegExp(searchText, 'g'), replaceText);
        updatePreview();
        saveDocument();
    }
}

// Table Dialog Functions
function showTableDialog() {
    tableDialog.showModal();
}

function insertTable() {
    const rows = parseInt(document.getElementById('tableRows').value);
    const cols = parseInt(document.getElementById('tableColumns').value);
    
    // Start with header row
    let table = '\n|';  // Add newline before table for better formatting
    for (let i = 0; i < cols; i++) {
        table += ` Header ${i + 1} |`;
    }
    
    // Add alignment row
    table += '\n|';
    for (let i = 0; i < cols; i++) {
        table += ' :--- |';  // Left align by default
    }
    
    // Add data rows
    for (let i = 0; i < rows; i++) {
        table += '\n|';
        for (let j = 0; j < cols; j++) {
            table += ` Cell ${i + 1},${j + 1} |`;
        }
    }
    table += '\n';  // Add newline after table for better formatting
    
    insertMarkdown(table, '');
    closeDialog('tableDialog');
    updatePreview();  // Force preview update
}

// Export Functions
function showExportMenu(event) {
    exportDialog.showModal();
}

async function exportAs(format) {
    const content = editor.value;
    const title = documentTitle.value || 'document';
    
    try {
        switch (format) {
            case 'markdown':
                downloadFile(content, `${title}.md`, 'text/markdown');
                break;
            case 'html':
                const html = marked.parse(content);
                downloadFile(html, `${title}.html`, 'text/html');
                break;
            case 'pdf':
                const element = document.createElement('div');
                element.innerHTML = marked.parse(content);
                element.className = 'markdown-body';
                document.body.appendChild(element);
                
                const opt = {
                    margin: 1,
                    filename: `${title}.pdf`,
                    image: { type: 'jpeg', quality: 0.98 },
                    html2canvas: { scale: 2 },
                    jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' }
                };
                
                await html2pdf().set(opt).from(element).save();
                document.body.removeChild(element);
                break;
        }
        showNotification(`Exported as ${format.toUpperCase()}`);
    } catch (error) {
        showNotification(`Failed to export as ${format.toUpperCase()}`, 'error');
    }
    closeDialog('exportDialog');
}

function downloadFile(content, filename, type) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function closeDialog(id) {
    document.getElementById(id).close();
}

// List Continuation
function handleListContinuation(e) {
    if (e.key === 'Enter') {
        const text = editor.value;
        const cursorPos = editor.selectionStart;
        const currentLine = text.substring(0, cursorPos).split('\n').pop();
        
        // Check for empty list item (to break the list)
        if (/^(\s*[-*+]|\s*\d+\.|[-*+]|\s*\[[ x]\])\s*$/.test(currentLine)) {
            e.preventDefault();
            const newText = text.substring(0, cursorPos - currentLine.length) + '\n' + text.substring(cursorPos);
            editor.value = newText;
            editor.setSelectionRange(cursorPos - currentLine.length + 1, cursorPos - currentLine.length + 1);
            updatePreview();
            return;
        }

        // Check for different types of lists
        const bulletMatch = /^(\s*)([-*+])\s(.+)$/.exec(currentLine);
        const numberMatch = /^(\s*)(\d+)\.\s(.+)$/.exec(currentLine);
        const taskMatch = /^(\s*)([-*+])\s\[[ x]\]\s(.+)$/.exec(currentLine);

        if (bulletMatch || numberMatch || taskMatch) {
            e.preventDefault();
            let newPrefix;

            if (bulletMatch) {
                // Bullet list
                newPrefix = `${bulletMatch[1]}${bulletMatch[2]} `;
            } else if (numberMatch) {
                // Numbered list
                const nextNumber = parseInt(numberMatch[2]) + 1;
                newPrefix = `${numberMatch[1]}${nextNumber}. `;
            } else {
                // Task list
                newPrefix = `${taskMatch[1]}${taskMatch[2]} [ ] `;
            }

            const newText = text.substring(0, cursorPos) + '\n' + newPrefix + text.substring(cursorPos);
            editor.value = newText;
            editor.setSelectionRange(cursorPos + newPrefix.length + 1, cursorPos + newPrefix.length + 1);
            updatePreview();
        }
    }
}

// Keyboard Shortcuts
function handleKeyboardShortcuts(e) {
    if (e.ctrlKey || e.metaKey) {
        switch (e.key.toLowerCase()) {
            case 's':
                e.preventDefault();
                saveDocument();
                break;
            case 'b':
                e.preventDefault();
                insertMarkdown('**', '**');
                break;
            case 'i':
                e.preventDefault();
                insertMarkdown('*', '*');
                break;
            case 'k':
                e.preventDefault();
                insertMarkdown('[', '](url)');
                break;
            case 'f':
                e.preventDefault();
                searchInput.focus();
                break;
        }
    }
}

// Enhanced Folder Management
async function createNewFolder() {
    const folderName = prompt('Enter folder name:');
    if (!folderName) return;

    try {
        await db.createFolder(folderName);
        await updateFolderTree();
        showNotification('Folder created successfully');
    } catch (error) {
        showNotification('Failed to create folder', 'error');
    }
}

async function updateFolderTree() {
    const folders = await db.getAllFolders();
    const documents = await db.getAllDocuments();
    
    folderTree.innerHTML = '';
    
    // Root documents
    const rootDocs = documents.filter(doc => !doc.folderId);
    if (rootDocs.length > 0) {
        const rootList = document.createElement('ul');
        rootList.className = 'document-list';
        rootDocs.forEach(doc => {
            const li = document.createElement('li');
            li.className = 'document-item';
            li.draggable = true;
            li.dataset.docId = doc.id;
            
            const docIcon = document.createElement('span');
            docIcon.className = 'material-icons';
            docIcon.textContent = 'description';
            
            const docTitle = document.createElement('span');
            docTitle.textContent = doc.title;
            
            li.appendChild(docIcon);
            li.appendChild(docTitle);
            
            li.onclick = (e) => {
                e.stopPropagation();
                loadDocument(doc.id);
            };
            
            li.addEventListener('dragstart', handleDragStart);
            li.addEventListener('dragend', handleDragEnd);
            
            rootList.appendChild(li);
        });
        folderTree.appendChild(rootList);
    }
    
    // Folders and their documents
    folders.forEach(folder => {
        const folderDiv = document.createElement('div');
        folderDiv.className = 'folder';
        folderDiv.dataset.folderId = folder.id;
        
        const folderHeader = document.createElement('div');
        folderHeader.className = 'folder-header';
        
        const folderIcon = document.createElement('span');
        folderIcon.className = 'material-icons';
        folderIcon.textContent = 'folder';
        
        const folderName = document.createElement('span');
        folderName.textContent = folder.name;
        
        folderHeader.appendChild(folderIcon);
        folderHeader.appendChild(folderName);
        
        const folderContent = document.createElement('ul');
        folderContent.className = 'document-list';
        
        folderDiv.addEventListener('dragover', handleDragOver);
        folderDiv.addEventListener('drop', handleDrop);
        
        const folderDocs = documents.filter(doc => doc.folderId === folder.id);
        folderDocs.forEach(doc => {
            const li = document.createElement('li');
            li.className = 'document-item';
            li.draggable = true;
            li.dataset.docId = doc.id;
            
            const docIcon = document.createElement('span');
            docIcon.className = 'material-icons';
            docIcon.textContent = 'description';
            
            const docTitle = document.createElement('span');
            docTitle.textContent = doc.title;
            
            li.appendChild(docIcon);
            li.appendChild(docTitle);
            
            li.onclick = (e) => {
                e.stopPropagation();
                loadDocument(doc.id);
            };
            
            li.addEventListener('dragstart', handleDragStart);
            li.addEventListener('dragend', handleDragEnd);
            
            folderContent.appendChild(li);
        });
        
        folderDiv.appendChild(folderHeader);
        folderDiv.appendChild(folderContent);
        folderTree.appendChild(folderDiv);
    });
}

// Drag and Drop Handlers
function handleDragStart(e) {
    e.dataTransfer.setData('text/plain', e.target.dataset.docId);
    e.target.classList.add('dragging');
}

function handleDragEnd(e) {
    e.target.classList.remove('dragging');
}

function handleDragOver(e) {
    e.preventDefault();
    e.currentTarget.classList.add('drag-over');
}

function handleDrop(e) {
    e.preventDefault();
    const docId = parseInt(e.dataTransfer.getData('text/plain'));
    const folderId = parseInt(e.currentTarget.dataset.folderId);
    
    if (docId && folderId) {
        moveDocumentToFolder(docId, folderId);
    }
    
    e.currentTarget.classList.remove('drag-over');
}

async function moveDocumentToFolder(docId, folderId) {
    try {
        await db.updateDocument(docId, { folderId });
        updateFolderTree();
        showNotification('Document moved successfully');
    } catch (error) {
        showNotification('Failed to move document', 'error');
    }
}

// Notification System
function showNotification(message, type = 'success') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.remove();
    }, 3000);
}

// Mobile Sidebar Toggle
function toggleSidebar() {
    document.querySelector('.sidebar').classList.toggle('show');
}

// Context Menu
let contextMenuTarget = null;

function showContextMenu(e) {
    e.preventDefault();
    const contextMenu = document.getElementById('contextMenu');
    contextMenuTarget = e.target.closest('.document-item, .folder, #folderTree');
    
    // Position the menu
    contextMenu.style.left = `${e.pageX}px`;
    contextMenu.style.top = `${e.pageY}px`;
    contextMenu.classList.add('show');
}

function hideContextMenu() {
    const contextMenu = document.getElementById('contextMenu');
    contextMenu.classList.remove('show');
    contextMenuTarget = null;
}

function handleContextMenuAction(action) {
    switch (action) {
        case 'new':
            createNewDocument();
            break;
        case 'newfolder':
            createNewFolder();
            break;
        case 'delete':
            if (contextMenuTarget) {
                if (contextMenuTarget.classList.contains('document-item')) {
                    deleteDocument(parseInt(contextMenuTarget.dataset.docId));
                } else if (contextMenuTarget.classList.contains('folder')) {
                    deleteFolder(parseInt(contextMenuTarget.dataset.folderId));
                }
            }
            break;
        case 'rename':
            if (contextMenuTarget) {
                if (contextMenuTarget.classList.contains('document-item')) {
                    renameDocument(parseInt(contextMenuTarget.dataset.docId));
                } else if (contextMenuTarget.classList.contains('folder')) {
                    renameFolder(parseInt(contextMenuTarget.dataset.folderId));
                }
            }
            break;
    }
    hideContextMenu();
}

async function deleteDocument(id) {
    if (confirm('Are you sure you want to delete this document?')) {
        try {
            await db.deleteDocument(id);
            await updateFolderTree();
            await loadDesktopIcons(); // Refresh desktop icons
            showNotification('Document deleted successfully');
        } catch (error) {
            showNotification('Failed to delete document', 'error');
        }
    }
}

async function deleteFolder(id) {
    if (confirm('Are you sure you want to delete this folder and all its documents?')) {
        try {
            await db.deleteFolder(id);
            await updateFolderTree();
            await loadDesktopIcons(); // Refresh desktop icons
            showNotification('Folder deleted successfully');
        } catch (error) {
            showNotification('Failed to delete folder', 'error');
        }
    }
}

async function renameDocument(id) {
    const doc = await db.getDocument(id);
    const newTitle = prompt('Enter new document name:', doc.title);
    if (newTitle && newTitle !== doc.title) {
        try {
            await db.updateDocument(id, { title: newTitle });
            await updateFolderTree();
            await loadDesktopIcons(); // Refresh desktop icons
            showNotification('Document renamed successfully');
        } catch (error) {
            showNotification('Failed to rename document', 'error');
        }
    }
}

async function renameFolder(id) {
    const folder = await db.getFolder(id);
    const newName = prompt('Enter new folder name:', folder.name);
    if (newName && newName !== folder.name) {
        try {
            await db.updateFolder(id, { name: newName });
            await updateFolderTree();
            await loadDesktopIcons(); // Refresh desktop icons
            showNotification('Folder renamed successfully');
        } catch (error) {
            showNotification('Failed to rename folder', 'error');
        }
    }
}

async function saveDocument() {
    if (!currentDocument) return;

    const saveIndicator = document.querySelector('.save-indicator');
    const icon = saveIndicator.querySelector('.material-icons');
    
    // Show loading state
    saveIndicator.classList.add('loading');
    icon.textContent = 'sync';

    const updates = {
        title: documentTitle.value,
        content: editor.value
    };

    try {
        currentDocument = await db.updateDocument(currentDocument.id, updates);
        await loadDesktopIcons(); // Refresh desktop icons
        
        // Show success state
        saveIndicator.classList.remove('loading');
        saveIndicator.classList.remove('error');
        icon.textContent = 'check_circle';
    } catch (error) {
        // Show error state
        saveIndicator.classList.remove('loading');
        saveIndicator.classList.add('error');
        icon.textContent = 'error';
        
        // Reset to normal state after 3 seconds
        setTimeout(() => {
            saveIndicator.classList.remove('error');
            icon.textContent = 'check_circle';
        }, 3000);
    }
}

// OS Interface Functions
function toggleFullscreen() {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen();
        enterOSMode();
    } else {
        document.exitFullscreen();
        exitOSMode();
    }
}

function enterOSMode() {
    const app = document.querySelector('.app');
    app.dataset.mode = 'os';
    document.querySelector('.os-interface').style.display = 'flex';
    document.querySelector('.sidebar').style.display = 'none';
    document.querySelector('.main-content').style.display = 'none';
    updateClock();
    loadDesktopIcons();
}

function exitOSMode() {
    const app = document.querySelector('.app');
    app.dataset.mode = 'normal';
    document.querySelector('.os-interface').style.display = 'none';
    document.querySelector('.sidebar').style.display = 'flex';
    document.querySelector('.main-content').style.display = 'flex';
    closeAllWindows();
}

function updateClock() {
    const clock = document.querySelector('.clock');
    clock.textContent = new Date().toLocaleTimeString();
    setTimeout(updateClock, 1000);
}

async function loadDesktopIcons() {
    const desktop = document.querySelector('.desktop-icons');
    desktop.innerHTML = '';
    
    // Add "New Document" icon
    const newDocIcon = createDesktopIcon('New Document', 'note_add', async () => {
        const doc = await db.createDocument('Untitled Document', '');
        createWindowFromDocument(doc);
        await loadDesktopIcons(); // Refresh icons to show new document
    });
    desktop.appendChild(newDocIcon);
    
    // Load existing documents
    const documents = await db.getAllDocuments();
    
    // Show empty state message if no documents
    if (documents.length === 0) {
        const emptyMessage = document.createElement('div');
        emptyMessage.className = 'empty-state';
        emptyMessage.innerHTML = `
            <span class="material-icons">description_off</span>
            <p>No documents found</p>
            <p class="subtitle">Click the "New Document" icon to create one</p>
        `;
        desktop.appendChild(emptyMessage);
    } else {
        // Add document icons
        documents.forEach(doc => {
            const icon = createDesktopIcon(doc.title, 'description', () => {
                createWindowFromDocument(doc);
            });
            desktop.appendChild(icon);
        });
    }
}

function createDesktopIcon(title, icon, onClick) {
    const div = document.createElement('div');
    div.className = 'desktop-icon';
    div.innerHTML = `
        <span class="material-icons">${icon}</span>
        <span>${title}</span>
    `;
    div.addEventListener('click', onClick);
    return div;
}

function createWindowFromDocument(doc = null) {
    const windowId = 'window-' + Date.now();
    const window = document.createElement('div');
    window.className = 'window preview-only';
    window.id = windowId;
    window.style.zIndex = ++zIndex;
    
    const isNew = !doc;
    const title = doc ? doc.title : 'Untitled Document';
    
    window.innerHTML = `
        <div class="window-titlebar">
            <span class="material-icons">description</span>
            <span class="window-title">${title}</span>
            <div class="window-controls">
                <span class="window-control minimize material-icons">remove</span>
                <span class="window-control maximize material-icons">crop_square</span>
                <span class="window-control close material-icons">close</span>
            </div>
        </div>
        <div class="window-content">
            <div class="editor-container">
                <textarea class="window-editor" spellcheck="true">${doc ? doc.content : ''}</textarea>
            </div>
            <div class="preview-container markdown-body"></div>
        </div>
    `;
    
    // Position window with offset from previous
    const offset = windows.size * 30;
    window.style.left = `${50 + offset}px`;
    window.style.top = `${50 + offset}px`;
    
    // Add window controls
    setupWindowControls(window, windowId);
    
    // Make window draggable
    makeWindowDraggable(window);
    
    // Add to desktop and windows map
    document.querySelector('.desktop').appendChild(window);
    windows.set(windowId, { window, doc });
    
    // Add to taskbar
    addTaskbarItem(windowId, title);
    
    // Set as active window
    setActiveWindow(windowId);
    
    return windowId;
}

function setupWindowControls(window, windowId) {
    const controls = window.querySelector('.window-controls');
    controls.querySelector('.minimize').onclick = () => minimizeWindow(windowId);
    controls.querySelector('.maximize').onclick = () => maximizeWindow(windowId);
    controls.querySelector('.close').onclick = () => closeWindow(windowId);
    
    const editor = window.querySelector('.window-editor');
    const preview = window.querySelector('.preview-container');
    
    editor.oninput = () => {
        preview.innerHTML = marked.parse(editor.value);
        if (windows.get(windowId).doc) {
            saveWindowContent(windowId);
        }
    };
}

function makeWindowDraggable(window) {
    const titlebar = window.querySelector('.window-titlebar');
    let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
    
    titlebar.onmousedown = dragMouseDown;
    
    function dragMouseDown(e) {
        e.preventDefault();
        pos3 = e.clientX;
        pos4 = e.clientY;
        document.onmouseup = closeDragElement;
        document.onmousemove = elementDrag;
        setActiveWindow(window.id);
    }
    
    function elementDrag(e) {
        e.preventDefault();
        pos1 = pos3 - e.clientX;
        pos2 = pos4 - e.clientY;
        pos3 = e.clientX;
        pos4 = e.clientY;
        window.style.top = (window.offsetTop - pos2) + "px";
        window.style.left = (window.offsetLeft - pos1) + "px";
    }
    
    function closeDragElement() {
        document.onmouseup = null;
        document.onmousemove = null;
    }
}

function setActiveWindow(windowId) {
    if (activeWindow) {
        windows.get(activeWindow).window.style.zIndex = 1000;
        document.querySelector(`[data-window="${activeWindow}"]`).classList.remove('active');
    }
    windows.get(windowId).window.style.zIndex = ++zIndex;
    document.querySelector(`[data-window="${windowId}"]`).classList.add('active');
    activeWindow = windowId;
}

function minimizeWindow(windowId) {
    const window = windows.get(windowId).window;
    window.style.display = 'none';
}

function maximizeWindow(windowId) {
    const window = windows.get(windowId).window;
    if (window.style.width === '100%') {
        // Restore to preview-only mode
        window.style.width = '';
        window.style.height = '';
        window.style.top = '';
        window.style.left = '';
        window.classList.add('preview-only');
    } else {
        // Maximize to full editor mode
        window.style.width = '100%';
        window.style.height = 'calc(100% - 40px)';
        window.style.top = '0';
        window.style.left = '0';
        window.classList.remove('preview-only');
    }
}

function closeWindow(windowId) {
    const window = windows.get(windowId).window;
    window.remove();
    document.querySelector(`[data-window="${windowId}"]`).remove();
    windows.delete(windowId);
}

function closeAllWindows() {
    windows.forEach((value, windowId) => {
        closeWindow(windowId);
    });
}

function addTaskbarItem(windowId, title) {
    const taskbar = document.querySelector('.taskbar-items');
    const item = document.createElement('div');
    item.className = 'taskbar-item';
    item.dataset.window = windowId;
    item.innerHTML = `
        <span class="material-icons">description</span>
        <span>${title}</span>
    `;
    item.onclick = () => {
        const window = windows.get(windowId).window;
        if (window.style.display === 'none') {
            window.style.display = 'flex';
            setActiveWindow(windowId);
        } else if (activeWindow === windowId) {
            minimizeWindow(windowId);
        } else {
            setActiveWindow(windowId);
        }
    };
    taskbar.appendChild(item);
}

async function saveWindowContent(windowId) {
    const windowData = windows.get(windowId);
    if (!windowData.doc) return;
    
    const saveIndicator = document.querySelector('.save-indicator');
    const icon = saveIndicator.querySelector('.material-icons');
    
    // Show loading state
    saveIndicator.classList.add('loading');
    icon.textContent = 'sync';

    try {
        const editor = windowData.window.querySelector('.window-editor');
        await db.updateDocument(windowData.doc.id, {
            content: editor.value
        });
        
        // Show success state
        saveIndicator.classList.remove('loading');
        saveIndicator.classList.remove('error');
        icon.textContent = 'check_circle';
    } catch (error) {
        // Show error state
        saveIndicator.classList.remove('loading');
        saveIndicator.classList.add('error');
        icon.textContent = 'error';
        
        // Reset to normal state after 3 seconds
        setTimeout(() => {
            saveIndicator.classList.remove('error');
            icon.textContent = 'check_circle';
        }, 3000);
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    // Remove F11 fullscreen key handler since we have immersive button now
    
    document.addEventListener('fullscreenchange', () => {
        isFullscreen = !!document.fullscreenElement;
    });
    
    // Initialize context menu
    document.addEventListener('contextmenu', showContextMenu);
    document.addEventListener('click', hideContextMenu);
    document.querySelectorAll('.menu-item').forEach(item => {
        item.addEventListener('click', () => {
            handleContextMenuAction(item.dataset.action);
        });
    });

    try {
        showLoading();
        initializeElements();
        await db.init();
        await updateFolderTree();
        await createNewDocument();
        hideLoading();
    } catch (error) {
        console.error('Failed to initialize:', error);
        showNotification('Failed to initialize application', 'error');
        hideLoading(); // Ensure loading screen is hidden even on error
    }
});

// Add notification styles
const notificationStyles = document.createElement('style');
notificationStyles.textContent = `
    .notification {
        position: fixed;
        bottom: 20px;
        right: 20px;
        padding: 10px 20px;
        border-radius: 4px;
        color: white;
        z-index: 1000;
        animation: slideIn 0.3s ease-out;
    }
    
    .notification.success {
        background-color: #4caf50;
    }
    
    .notification.error {
        background-color: #f44336;
    }
    
    @keyframes slideIn {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    .heading-menu-item:hover {
        background-color: var(--button-hover);
    }
`;

document.head.appendChild(notificationStyles);
