document.addEventListener('DOMContentLoaded', () => {
    // Chave para o LocalStorage
    const LS_KEY = 'organizadorDeArquivosData';

    // --- REFERÊNCIAS AO DOM ---
    const fileList = document.getElementById('file-list');
    const breadcrumbs = document.getElementById('breadcrumbs');
    const searchInput = document.getElementById('search-input');
    const sortSelect = document.getElementById('sort-select');
    const themeToggle = document.getElementById('theme-toggle');
    const toolbar = {
        newFolder: document.getElementById('new-folder'),
        newTextFile: document.getElementById('new-text-file'),
        newSpreadsheet: document.getElementById('new-spreadsheet'),
        rename: document.getElementById('rename-item'),
        delete: document.getElementById('delete-item'),
        importFileBtn: document.getElementById('import-file-btn'),
        resetSystem: document.getElementById('reset-system')
    };
    const fileImportInput = document.getElementById('file-import-input');
    const contextMenu = {
        element: document.getElementById('context-menu'),
        open: document.getElementById('context-open'),
        download: document.getElementById('context-download'),
        rename: document.getElementById('context-rename'),
        delete: document.getElementById('context-delete'),
    };
    const textEditorModal = {
        pane: document.getElementById('text-editor-modal'),
        closeBtn: document.getElementById('close-text-editor'),
        title: document.getElementById('text-editor-title'),
        editor: document.getElementById('text-editor'),
        saveBtn: document.getElementById('save-text-file'),
        downloadBtn: document.getElementById('download-text-file')
    };
    const spreadsheetEditorModal = {
        pane: document.getElementById('spreadsheet-editor-modal'),
        closeBtn: document.getElementById('close-spreadsheet-editor'),
        title: document.getElementById('spreadsheet-editor-title'),
        container: document.getElementById('spreadsheet-container'),
        status: document.getElementById('spreadsheet-status'),
        saveBtn: document.getElementById('save-spreadsheet'),
        downloadBtn: document.getElementById('download-spreadsheet')
    };
    const promptModal = {
        pane: document.getElementById('prompt-modal'),
        title: document.getElementById('prompt-title'),
        label: document.getElementById('prompt-label'),
        input: document.getElementById('prompt-input'),
        okBtn: document.getElementById('prompt-ok-btn'),
        cancelBtn: document.getElementById('prompt-cancel-btn')
    };
    const confirmModal = {
        pane: document.getElementById('confirm-modal'),
        title: document.getElementById('confirm-title'),
        message: document.getElementById('confirm-message'),
        okBtn: document.getElementById('confirm-ok-btn'),
        cancelBtn: document.getElementById('confirm-cancel-btn')
    };
    const formatSelectModal = {
        pane: document.getElementById('format-select-modal'),
        input: document.getElementById('format-select-input'),
        okBtn: document.getElementById('format-select-ok-btn'),
        cancelBtn: document.getElementById('format-select-cancel-btn')
    };

    // --- REFERÊNCIAS AO DOM PARA NAVEGAÇÃO DE PÁGINAS ---
    const mainAppContainer = document.querySelector('.file-explorer-container');
    const pageViewContainer = document.querySelector('.page-view-container');
    const staticPageContainers = {
        privacy: document.getElementById('privacy-policy-page'),
        terms: document.getElementById('terms-of-use-page'),
        contact: document.getElementById('contact-page'),
        cookies: document.getElementById('cookies-policy-page'),
    };
    const navLinks = {
        privacy: document.getElementById('nav-privacy-policy'),
        terms: document.getElementById('nav-terms-of-use'),
        contact: document.getElementById('nav-contact'),
        cookies: document.getElementById('nav-cookies-policy'),
    };

    // --- ESTADO DA APLICAÇÃO ---
    let fileSystem, currentFolderId = 'root',
        selectedItemIds = [],
        focusedItemId = null,
        sortState = { by: 'name', order: 'asc' },
        isSearching = false,
        activeNode = null,
        hasUnsavedChanges = false;

    // --- FUNÇÕES PRINCIPAIS ---
    function init() {
        loadFileSystem();
        initTheme();
        render();
        setupEventListeners();
        setupNavigation();
    }
    
    function render() {
        const searchTerm = searchInput.value.trim().toLowerCase();
        isSearching = searchTerm.length > 0;
        fileList.innerHTML = '';

        let currentFolder = findNodeById(currentFolderId);
        if (!currentFolder) {
            currentFolderId = 'root';
            currentFolder = findNodeById('root');
        }

        let itemsToRender = [];
        if (isSearching) {
            fileList.className = 'list-view';
            itemsToRender = performSearch(searchTerm);
            breadcrumbs.innerHTML = `<span>Resultados da busca por: <strong>"${searchInput.value.trim()}"</strong></span>`;
        } else {
            fileList.className = 'grid-view';
            itemsToRender = currentFolder.children;
            renderBreadcrumbs();
        }

        sortItems(itemsToRender);
        
        if (itemsToRender.length === 0 && !isSearching) {
             fileList.innerHTML = `<div style="text-align: center; padding: 50px; color: var(--color-text-secondary);">
                <i class="fas fa-folder-open fa-3x" style="margin-bottom: 16px;"></i>
                <p>Esta pasta está vazia.</p>
            </div>`;
        } else {
            itemsToRender.forEach(item => renderItem(item, isSearching));
        }
        
        if (itemsToRender.length === 0) {
            focusedItemId = null;
        } else if (focusedItemId && !itemsToRender.some(item => item.id === focusedItemId)) {
            focusedItemId = itemsToRender[0].id;
        }

        updateFocusAndSelectionStyles();
        updateToolbar();
    }

    function renderItem(item, isSearchView = false) {
        const itemElement = document.createElement('div');
        itemElement.dataset.id = item.id;
        let iconHtml;

        if (item.type === 'folder') {
            iconHtml = '<i class="fas fa-folder"></i>';
        } else if (item.subtype === 'text') {
            iconHtml = '<i class="fas fa-file-alt"></i>';
        } else if (item.subtype === 'spreadsheet') {
            iconHtml = `
                <span class="fa-stack fa-file-excel-stacked">
                    <i class="fas fa-file"></i>
                    <i class="fas fa-table"></i>
                </span>`;
        } else {
            iconHtml = '<i class="fas fa-file"></i>';
        }

        if (isSearchView) {
            itemElement.className = 'search-result-item';
            const path = getItemPath(item.id);
            itemElement.innerHTML = `
                <div class="item-icon">${iconHtml}</div>
                <div class="item-details">
                    <span class="item-name">${item.name}</span>
                    <span class="item-path">${path}</span>
                </div>`;
        } else {
            itemElement.className = 'file-item';
            itemElement.draggable = true;
            itemElement.innerHTML = `<div class="file-item-inner">${iconHtml}<span class="item-name">${item.name}</span></div>`;
        }
        fileList.appendChild(itemElement);
    }
    
    function renderBreadcrumbs() {
        breadcrumbs.innerHTML = '';
        let path = [];
        let current = findNodeById(currentFolderId);
        while (current) {
            path.unshift(current);
            current = (current.id === 'root') ? null : findParentNode(current.id);
        }
        path.forEach((node, index) => {
            if (index < path.length - 1) {
                const link = document.createElement('a');
                link.href = '#';
                link.className = 'breadcrumb-link';
                if (node.id === 'root') {
                    link.innerHTML = `<i class="fas fa-home"></i> <span>${node.name}</span>`;
                } else {
                    link.textContent = node.name;
                }
                link.onclick = (e) => {
                    e.preventDefault();
                    currentFolderId = node.id;
                    selectedItemIds = [];
                    render();
                };
                breadcrumbs.appendChild(link);
                breadcrumbs.insertAdjacentHTML('beforeend', '<span class="breadcrumb-separator" style="color: var(--color-border); margin: 0 4px;">/</span>');
            } else {
                const currentEl = document.createElement('span');
                currentEl.className = 'breadcrumb-current';
                currentEl.textContent = node.name;
                breadcrumbs.appendChild(currentEl);
            }
        });
    }
    
    function saveFileSystem() {
        try {
            localStorage.setItem(LS_KEY, JSON.stringify(fileSystem));
        } catch (error) {
            console.error("Erro ao salvar no LocalStorage:", error);
            showConfirmModal('Erro de Salvamento', 'Não foi possível salvar as alterações. O armazenamento local pode estar cheio.', false);
        }
    }

    function createInitialFileSystem() {
        fileSystem = {
            root: { id: 'root', name: 'Raiz', type: 'folder', children: [], createdAt: Date.now(), updatedAt: Date.now() }
        };
        currentFolderId = 'root';
        selectedItemIds = [];
        focusedItemId = null;
    }

    function loadFileSystem() {
        const data = localStorage.getItem(LS_KEY);
        if (data) {
            try {
                const parsedFS = JSON.parse(data);
                if (parsedFS && parsedFS.root && parsedFS.root.id === 'root') {
                    fileSystem = parsedFS;
                    currentFolderId = 'root';
                    selectedItemIds = [];
                    focusedItemId = null;
                    return;
                }
            } catch (error) {
                console.error("Erro ao carregar dados do LocalStorage, iniciando um novo sistema.", error);
            }
        }
        createInitialFileSystem();
    }

    function findNodeById(id, node = fileSystem.root) {
        if (!node) return null;
        if (node.id === id) return node;
        if (node.type === 'folder') {
            for (const child of node.children) {
                const found = findNodeById(id, child);
                if (found) return found;
            }
        }
        return null;
    }

    function findParentNode(childId, node = fileSystem.root) {
        if (node.type !== 'folder') return null;
        for (const child of node.children) {
            if (child.id === childId) return node;
            const found = findParentNode(childId, child);
            if (found) return found;
        }
        return null;
    }

    function getItemPath(id) {
        let path = [];
        let current = findNodeById(id);
        let parent = findParentNode(id);
        while (parent) {
            path.unshift(parent.name);
            current = parent;
            parent = findParentNode(current.id);
        }
        return path.join(' / ');
    }
    
    function setupEventListeners() {
        fileList.addEventListener('click', handleItemSelection);
        fileList.addEventListener('dblclick', handleItemOpen);
        fileList.addEventListener('contextmenu', handleItemContextMenu);
        
        fileList.addEventListener('dragstart', e => {
            const item = e.target.closest('.file-item');
            if (item) e.dataTransfer.setData('text/plain', item.dataset.id);
        });
        fileList.addEventListener('dragover', e => {
            e.preventDefault();
            const item = e.target.closest('.file-item');
            if (item && item.querySelector('.fa-folder')) {
                item.querySelector('.file-item-inner')?.classList.add('drop-target');
            }
        });
        fileList.addEventListener('dragleave', e => {
            e.target.closest('.file-item')?.querySelector('.file-item-inner')?.classList.remove('drop-target');
        });
        fileList.addEventListener('drop', e => {
            e.preventDefault();
            const targetElement = e.target.closest('.file-item');
            targetElement?.querySelector('.file-item-inner')?.classList.remove('drop-target');
            const draggedId = e.dataTransfer.getData('text/plain');
            if (targetElement && draggedId && draggedId !== targetElement.dataset.id) {
                const targetNode = findNodeById(targetElement.dataset.id);
                if (targetNode && targetNode.type === 'folder') {
                    const originalParent = findParentNode(draggedId);
                    const itemToMove = originalParent.children.find(c => c.id === draggedId);
                    if (!targetNode.children.some(c => c.name.toLowerCase() === itemToMove.name.toLowerCase())) {
                        originalParent.children = originalParent.children.filter(c => c.id !== draggedId);
                        targetNode.children.push(itemToMove);
                        saveFileSystem();
                        render();
                    } else {
                        showConfirmModal('Erro ao Mover', `Já existe um item chamado "${itemToMove.name}" na pasta de destino.`, false);
                    }
                }
            }
        });
        
        document.addEventListener('keydown', handleGlobalKeyDown);
        document.addEventListener('click', (e) => {
            if (!e.target.closest('#context-menu')) contextMenu.element.classList.add('hidden');
        });
        searchInput.addEventListener('input', () => { focusedItemId = null; render(); });
        sortSelect.addEventListener('change', e => {
            const [by, order] = e.target.value.split('-');
            sortState = { by, order };
            render();
        });
        themeToggle.addEventListener('click', toggleTheme);

        toolbar.newFolder.addEventListener('click', () => createNewItem('folder'));
        toolbar.newTextFile.addEventListener('click', () => createNewItem('file', 'text'));
        toolbar.newSpreadsheet.addEventListener('click', () => createNewItem('file', 'spreadsheet'));
        toolbar.rename.addEventListener('click', () => selectedItemIds.length === 1 && renameSelectedItem(selectedItemIds[0]));
        toolbar.delete.addEventListener('click', deleteSelectedItems);
        toolbar.importFileBtn.addEventListener('click', () => fileImportInput.click());
        fileImportInput.addEventListener('change', handleFileImport);
        toolbar.resetSystem.addEventListener('click', resetSystem);

        textEditorModal.closeBtn.addEventListener('click', closeTextEditorModal);
        textEditorModal.pane.addEventListener('click', (e) => e.target === textEditorModal.pane && closeTextEditorModal());
        spreadsheetEditorModal.closeBtn.addEventListener('click', closeSpreadsheetEditorModal);
        spreadsheetEditorModal.pane.addEventListener('click', (e) => e.target === spreadsheetEditorModal.pane && closeSpreadsheetEditorModal());
        spreadsheetEditorModal.container.addEventListener('paste', handleSpreadsheetPaste);
    }

    function handleItemSelection(e) {
        contextMenu.element.classList.add('hidden');
        const target = e.target.closest('.file-item, .search-result-item');
        if (!target) {
            if (!e.target.closest('#file-list')) return;
            selectedItemIds = [];
            focusedItemId = null;
        } else {
            const id = target.dataset.id;
            const isCtrl = e.ctrlKey || e.metaKey;
            focusedItemId = id;
            if (!isCtrl) {
                selectedItemIds = [id];
            } else {
                selectedItemIds.includes(id) ? selectedItemIds = selectedItemIds.filter(i => i !== id) : selectedItemIds.push(id);
            }
        }
        updateFocusAndSelectionStyles();
        updateToolbar();
    }

    function handleItemOpen(e) {
        const target = e.target.closest('.file-item, .search-result-item');
        if (target) openItem(target.dataset.id);
    }

    function openItem(id) {
        const node = findNodeById(id);
        if (node.type === 'folder') {
            currentFolderId = id;
            searchInput.value = '';
            selectedItemIds = [];
            focusedItemId = null;
            render();
        } else {
            openFile(node);
        }
    }

    function handleItemContextMenu(e) {
        e.preventDefault();
        const target = e.target.closest('.file-item, .search-result-item');
        if (!target) return;

        const id = target.dataset.id;
        const node = findNodeById(id);
        if (!node) return;

        if (!selectedItemIds.includes(id)) {
            selectedItemIds = [id];
            focusedItemId = id;
            updateFocusAndSelectionStyles();
            updateToolbar();
        }

        const oldMenu = contextMenu.element;
        const newMenu = oldMenu.cloneNode(true);
        oldMenu.parentNode.replaceChild(newMenu, oldMenu);
        contextMenu.element = newMenu;
        
        contextMenu.open = newMenu.querySelector('#context-open');
        contextMenu.download = newMenu.querySelector('#context-download');
        contextMenu.rename = newMenu.querySelector('#context-rename');
        contextMenu.delete = newMenu.querySelector('#context-delete');

        if (node.type === 'folder') {
            contextMenu.download.innerHTML = '<i class="fas fa-file-archive"></i> Baixar Pasta (.zip)';
        } else {
            contextMenu.download.innerHTML = '<i class="fas fa-download"></i> Baixar Arquivo';
        }

        contextMenu.download.onclick = () => {
            if (node.type === 'folder') {
                downloadFolderAsZip(node);
            } else {
                downloadFile(node);
            }
            contextMenu.element.classList.add('hidden');
        };

        contextMenu.open.onclick = () => { openItem(id); contextMenu.element.classList.add('hidden'); };
        contextMenu.rename.onclick = () => { renameSelectedItem(id); contextMenu.element.classList.add('hidden'); };
        contextMenu.delete.onclick = () => { deleteSelectedItems(); contextMenu.element.classList.add('hidden'); };
        
        contextMenu.element.style.left = `${e.clientX}px`;
        contextMenu.element.style.top = `${e.clientY}px`;
        contextMenu.element.classList.remove('hidden');
    }

    function handleGlobalKeyDown(e) {
        if (document.querySelector('.modal-pane:not(.hidden)')) return;

        if (mainAppContainer.classList.contains('view-hidden')) return;

        const items = Array.from(fileList.children).filter(el => el.classList.contains('file-item'));
        if (items.length === 0) return;
        
        const currentIndex = items.findIndex(item => item.dataset.id === focusedItemId);
        let nextIndex = currentIndex;
        
        if (e.key.startsWith('Arrow')) {
            e.preventDefault();
            const cols = isSearching ? 1 : Math.floor(fileList.offsetWidth / items[0].offsetWidth);
            if (e.key === 'ArrowRight' && currentIndex < items.length - 1) nextIndex++;
            if (e.key === 'ArrowLeft' && currentIndex > 0) nextIndex--;
            if (e.key === 'ArrowDown' && currentIndex + cols < items.length) nextIndex += cols;
            if (e.key === 'ArrowUp' && currentIndex - cols >= 0) nextIndex -= cols;
        } else if (e.key === 'Home') {
            e.preventDefault(); nextIndex = 0;
        } else if (e.key === 'End') {
            e.preventDefault(); nextIndex = items.length - 1;
        } else if (e.key === 'Enter') {
            e.preventDefault(); if (focusedItemId) openItem(focusedItemId);
        } else if (e.key === 'F2' && focusedItemId) {
            e.preventDefault(); renameSelectedItem(focusedItemId);
        } else if (e.key === 'Delete' && selectedItemIds.length > 0) {
            e.preventDefault(); deleteSelectedItems();
        } else {
            return;
        }

        if (nextIndex > -1 && nextIndex < items.length && nextIndex !== currentIndex) {
            focusedItemId = items[nextIndex].dataset.id;
            selectedItemIds = [focusedItemId];
            updateFocusAndSelectionStyles();
            updateToolbar();
            items[nextIndex]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }
    }

    function showPromptModal(title, label, defaultValue = '') {
        return new Promise((resolve) => {
            promptModal.title.textContent = title;
            promptModal.label.textContent = label;
            promptModal.input.value = defaultValue;
            promptModal.pane.classList.remove('hidden');
            promptModal.input.focus();
            promptModal.input.select();
            const close = (value) => {
                promptModal.pane.classList.add('hidden');
                removeListeners();
                resolve(value);
            };
            const okListener = () => close(promptModal.input.value);
            const cancelListener = () => close(null);
            const paneListener = (e) => { if (e.target === promptModal.pane) close(null); };
            const keydownListener = (e) => {
                if (e.key === 'Enter') { e.preventDefault(); okListener(); }
                if (e.key === 'Escape') cancelListener();
            };
            const removeListeners = () => {
                promptModal.okBtn.removeEventListener('click', okListener);
                promptModal.cancelBtn.removeEventListener('click', cancelListener);
                promptModal.pane.removeEventListener('click', paneListener);
                document.removeEventListener('keydown', keydownListener, true);
            };
            promptModal.okBtn.addEventListener('click', okListener);
            promptModal.cancelBtn.addEventListener('click', cancelListener);
            promptModal.pane.addEventListener('click', paneListener);
            document.addEventListener('keydown', keydownListener, true);
        });
    }

    function showConfirmModal(title, message, isDestructive = true) {
        return new Promise((resolve) => {
            confirmModal.title.textContent = title;
            document.getElementById('confirm-message').innerHTML = message;
            confirmModal.okBtn.className = isDestructive ? 'btn-danger' : 'btn-primary';
            confirmModal.okBtn.textContent = title.toLowerCase().includes('exclu') ? 'Excluir' : title.toLowerCase().includes('resetar') ? 'Resetar' : 'Confirmar';
            confirmModal.pane.classList.remove('hidden');
            const close = (value) => {
                confirmModal.pane.classList.add('hidden');
                removeListeners();
                resolve(value);
            };
            const okListener = () => close(true);
            const cancelListener = () => close(false);
            const paneListener = (e) => { if (e.target === confirmModal.pane) close(false); };
            const keydownListener = (e) => { if (e.key === 'Escape') cancelListener(); };
            const removeListeners = () => {
                confirmModal.okBtn.removeEventListener('click', okListener);
                confirmModal.cancelBtn.removeEventListener('click', cancelListener);
                confirmModal.pane.removeEventListener('click', paneListener);
                document.removeEventListener('keydown', keydownListener, true);
            };
            confirmModal.okBtn.addEventListener('click', okListener);
            confirmModal.cancelBtn.addEventListener('click', cancelListener);
            confirmModal.pane.addEventListener('click', paneListener);
            document.addEventListener('keydown', keydownListener, true);
        });
    }

    async function createNewItem(type, subtype = null) {
        let title;
        if (type === 'folder') title = 'Criar Nova Pasta';
        else if (subtype === 'text') title = 'Criar Novo Arquivo de Texto';
        else if (subtype === 'spreadsheet') title = 'Criar Nova Planilha';

        const previousFocusedId = focusedItemId;
        selectedItemIds = [];
        focusedItemId = null;
        updateFocusAndSelectionStyles();
        
        const name = await showPromptModal(title, 'Nome:');
        
        if (!name || name.trim() === '') {
            focusedItemId = previousFocusedId;
            if(focusedItemId) selectedItemIds = [focusedItemId];
            render();
            return;
        }
        
        const parent = findNodeById(currentFolderId);
        if (parent.children.some(c => c.name.toLowerCase() === name.trim().toLowerCase())) {
            await showConfirmModal('Erro', 'Um item com este nome já existe nesta pasta.', false);
            focusedItemId = previousFocusedId;
            if(focusedItemId) selectedItemIds = [focusedItemId];
            render();
            return;
        }
        
        const now = Date.now();
        const baseItem = {
            id: `id_${Date.now()}_${Math.random()}`,
            name: name.trim(),
            createdAt: now,
            updatedAt: now,
        };

        let newItem;
        if (type === 'folder') {
            newItem = { ...baseItem, type: 'folder', children: [] };
        } else {
            const content = (subtype === 'spreadsheet') ? Array(15).fill(null).map(() => Array(8).fill('')) : '';
            newItem = { ...baseItem, type: 'file', subtype: subtype, content: content };
        }

        parent.children.push(newItem);
        parent.updatedAt = now;
        
        focusedItemId = newItem.id;
        selectedItemIds = [newItem.id];

        saveFileSystem();
        render();
    }

    async function renameSelectedItem(id) {
        const node = findNodeById(id);
        if (!node) return;
        const newName = await showPromptModal('Renomear Item', 'Novo nome:', node.name);
        if (newName && newName.trim() !== '' && newName.trim() !== node.name) {
            const parent = findParentNode(id);
            if (parent.children.some(c => c.id !== id && c.name.toLowerCase() === newName.trim().toLowerCase())) {
                await showConfirmModal('Erro', 'Um item com este nome já existe nesta pasta.', false);
                return;
            }
            node.name = newName.trim();
            node.updatedAt = Date.now();
            parent.updatedAt = node.updatedAt;
            saveFileSystem();
            render();
        }
    }
    
    async function deleteSelectedItems() {
        if (selectedItemIds.length === 0) return;
        const title = 'Confirmar Exclusão';
        const message = selectedItemIds.length === 1 ?
            `Tem certeza que deseja excluir "<strong>${findNodeById(selectedItemIds[0]).name}</strong>"?` :
            `Tem certeza que deseja excluir <strong>${selectedItemIds.length} itens</strong>?`;
        
        const confirmed = await showConfirmModal(title, message);
        if (confirmed) {
            let parentsToUpdate = new Set();
            selectedItemIds.forEach(id => {
                const parentNode = findParentNode(id);
                if (parentNode) {
                    parentNode.children = parentNode.children.filter(child => child.id !== id);
                    parentsToUpdate.add(parentNode);
                }
            });
            parentsToUpdate.forEach(p => p.updatedAt = Date.now());
            selectedItemIds = [];
            focusedItemId = null;
            saveFileSystem();
            render();
        }
    }
    
    async function resetSystem() {
        const confirmed = await showConfirmModal(
            'Resetar Sistema', 
            '<strong>Atenção:</strong> Isso apagará permanentemente todos os seus arquivos e pastas. Esta ação não pode ser desfeita. Deseja continuar?'
        );

        if (confirmed) {
            localStorage.removeItem(LS_KEY);
            createInitialFileSystem();
            render();
        }
    }
    
    async function handleFileImport(e) {
        const file = e.target.files[0];
        if (!file) return;

        const fileName = file.name.split('.').slice(0, -1).join('.') || file.name;
        const fileExt = file.name.split('.').pop().toLowerCase();

        const parent = findNodeById(currentFolderId);
        if (parent.children.some(c => c.name.toLowerCase() === fileName.toLowerCase())) {
            await showConfirmModal('Erro na Importação', `Um item chamado "${fileName}" já existe nesta pasta.`, false);
            fileImportInput.value = '';
            return;
        }

        const reader = new FileReader();

        const processFile = (content, subtype) => {
            const now = Date.now();
            const newItem = {
                id: `id_${Date.now()}_${Math.random()}`,
                name: fileName,
                type: 'file',
                subtype: subtype,
                createdAt: now,
                updatedAt: now,
                content: content
            };
            parent.children.push(newItem);
            parent.updatedAt = now;
            saveFileSystem();
            render();
            fileImportInput.value = '';
        };
        
        if (fileExt === 'txt') {
            reader.onload = (event) => processFile(event.target.result, 'text');
            reader.readAsText(file);
        } else if (fileExt === 'xlsx') {
            reader.onload = (event) => {
                const data = new Uint8Array(event.target.result);
                const workbook = XLSX.read(data, {type: 'array'});
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                const json = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
                processFile(json, 'spreadsheet');
            };
            reader.readAsArrayBuffer(file);
        } else {
            await showConfirmModal('Formato Inválido', 'Apenas arquivos .txt e .xlsx são suportados para importação.', false);
            fileImportInput.value = '';
        }
    }

    async function downloadFile(node) {
        if (node.subtype === 'text') {
            await promptAndDownloadTextFile(node);
        } else if (node.subtype === 'spreadsheet') {
            downloadSpreadsheetFile(node);
        }
    }

    async function downloadFolderAsZip(folderNode) {
        try {
            const zip = new JSZip();
            const rootZipFolder = zip.folder(folderNode.name);

            addFolderToZip(folderNode, rootZipFolder);

            const blob = await zip.generateAsync({ type: "blob" });
            
            performDownload(`${folderNode.name}.zip`, blob, "application/zip");
        } catch (error) {
            console.error("Erro ao gerar o arquivo .zip:", error);
            alert("Ocorreu um erro ao tentar baixar a pasta. Verifique o console para mais detalhes.");
        }
    }

    function addFolderToZip(folderData, zipFolder) {
        folderData.children.forEach(child => {
            if (child.type === 'folder') {
                const newZipFolder = zipFolder.folder(child.name);
                addFolderToZip(child, newZipFolder);
            } else if (child.type === 'file') {
                if (child.subtype === 'text') {
                    const textContent = stripHtml(child.content || '');
                    zipFolder.file(`${child.name}.txt`, textContent);
                } else if (child.subtype === 'spreadsheet') {
                    const worksheet = XLSX.utils.aoa_to_sheet(child.content);
                    const workbook = XLSX.utils.book_new();
                    XLSX.utils.book_append_sheet(workbook, worksheet, "Sheet1");
                    const xlsxData = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
                    zipFolder.file(`${child.name}.xlsx`, xlsxData);
                }
            }
        });
    }

    function showFormatSelectModal() {
        return new Promise((resolve) => {
            formatSelectModal.pane.classList.remove('hidden');
            formatSelectModal.input.focus();
            const close = (value) => {
                formatSelectModal.pane.classList.add('hidden');
                removeListeners();
                resolve(value);
            };
            const okListener = () => close(formatSelectModal.input.value);
            const cancelListener = () => close(null);
            const removeListeners = () => {
                formatSelectModal.okBtn.removeEventListener('click', okListener);
                formatSelectModal.cancelBtn.removeEventListener('click', cancelListener);
            };
            formatSelectModal.okBtn.addEventListener('click', okListener);
            formatSelectModal.cancelBtn.addEventListener('click', cancelListener);
        });
    }

    function stripHtml(html) {
        const tmp = document.createElement("div");
        tmp.innerHTML = html;
        return tmp.textContent || tmp.innerText || "";
    }

    async function promptAndDownloadTextFile(node, useEditorContent = false) {
        if (!node || node.type !== 'file' || node.subtype !== 'text') return;
        const selectedFormat = await showFormatSelectModal();
        if (!selectedFormat) return;

        let content, extension, mimeType;
        const baseHtmlContent = useEditorContent ? textEditorModal.editor.innerHTML : (node.content || '');
        const baseTextContent = useEditorContent ? textEditorModal.editor.innerText : stripHtml(node.content || '');

        switch (selectedFormat) {
            case 'txt':
                content = baseTextContent; extension = '.txt'; mimeType = 'text/plain;charset=utf-8';
                break;
            case 'doc':
                content = `<html xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"><title>${node.name}</title></head><body>${baseHtmlContent}</body></html>`;
                extension = '.doc'; mimeType = 'application/msword;charset=utf-8';
                break;
            default: return;
        }
        performDownload(`${node.name}${extension}`, content, mimeType);
    }
    
    function downloadSpreadsheetFile(node, useEditorContent = false) {
        const data = useEditorContent ? readSpreadsheetFromTable() : node.content;
        const worksheet = XLSX.utils.aoa_to_sheet(data);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Sheet1");
        XLSX.writeFile(workbook, `${node.name}.xlsx`);
    }

    function performDownload(filename, content, mimeType) {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = filename;
        document.body.appendChild(a); a.click();
        document.body.removeChild(a); URL.revokeObjectURL(url);
    }
    
    function performSearch(term) {
        const results = [];
        function recurse(node) {
            if (node.id !== 'root' && node.name.toLowerCase().includes(term)) {
                results.push(node);
            }
            if (node.type === 'folder') { node.children.forEach(recurse); }
        }
        recurse(fileSystem.root);
        return results;
    }

    function sortItems(items) {
        const { by, order } = sortState;
        const multiplier = order === 'asc' ? 1 : -1;
        items.sort((a, b) => {
            if (a.type === 'folder' && b.type !== 'folder') return -1;
            if (a.type !== 'folder' && b.type === 'folder') return 1;
            if (by === 'name') return a.name.localeCompare(b.name, undefined, { numeric: true }) * multiplier;
            if (by === 'date') return (a.updatedAt - b.updatedAt) * multiplier;
            return 0;
        });
    }

    function initTheme() {
        document.body.classList.remove('dark-theme');
        themeToggle.innerHTML = `<i class="fas fa-moon"></i>`;
    }

    function toggleTheme() {
        document.body.classList.toggle('dark-theme');
        const isDark = document.body.classList.contains('dark-theme');
        themeToggle.innerHTML = `<i class="fas fa-${isDark ? 'sun' : 'moon'}"></i>`;
    }

    function updateFocusAndSelectionStyles() {
        fileList.querySelectorAll('.file-item, .search-result-item').forEach(el => {
            const id = el.dataset.id;
            el.classList.toggle('selected', selectedItemIds.includes(id));
            el.classList.toggle('focused', id === focusedItemId && !isSearching);
        });
    }

    function updateToolbar() {
        toolbar.rename.disabled = selectedItemIds.length !== 1;
        toolbar.delete.disabled = selectedItemIds.length === 0;
    }

    function openFile(node) {
        if (node.subtype === 'text') {
            openTextEditor(node);
        } else if (node.subtype === 'spreadsheet') {
            openSpreadsheetEditor(node);
        }
    }
    
    function openTextEditor(node) {
        activeNode = node;
        hasUnsavedChanges = false;
        textEditorModal.title.textContent = node.name;
        textEditorModal.editor.innerHTML = node.content || '';
        updateStatusBar();
        setupEditorToolbar();
        textEditorModal.pane.classList.remove('hidden');
        textEditorModal.downloadBtn.onclick = () => { promptAndDownloadTextFile(activeNode, true); };
        textEditorModal.saveBtn.onclick = saveTextFile;
    }

    async function closeTextEditorModal() {
        if (hasUnsavedChanges) {
            const confirmed = await showConfirmModal('Alterações Não Salvas', 'Você tem alterações não salvas que serão perdidas. Deseja sair mesmo assim?');
            if (!confirmed) return;
        }
        textEditorModal.pane.classList.add('hidden');
        activeNode = null;
        hasUnsavedChanges = false;
        render(); 
    }

    function setupEditorToolbar() {
        const toolbarContainer = textEditorModal.pane.querySelector('.editor-toolbar');
        toolbarContainer.innerHTML = `<button data-command="bold" title="Negrito"><i class="fas fa-bold"></i></button><button data-command="italic" title="Itálico"><i class="fas fa-italic"></i></button><button data-command="underline" title="Sublinhado"><i class="fas fa-underline"></i></button><span class="toolbar-separator"></span><button data-command="insertUnorderedList" title="Lista com Marcadores"><i class="fas fa-list-ul"></i></button><button data-command="insertOrderedList" title="Lista Numerada"><i class="fas fa-list-ol"></i></button><span class="toolbar-separator"></span><button data-command="justifyLeft" title="Alinhar à Esquerda"><i class="fas fa-align-left"></i></button><button data-command="justifyCenter" title="Centralizar"><i class="fas fa-align-center"></i></button><button data-command="justifyRight" title="Alinhar à Direita"><i class="fas fa-align-right"></i></button><span class="toolbar-separator"></span><button data-command="removeFormat" title="Limpar Formatação"><i class="fas fa-eraser"></i></button>`;
        toolbarContainer.querySelectorAll('button').forEach(button => {
            button.onclick = (e) => { e.preventDefault(); document.execCommand(e.currentTarget.dataset.command, false, null); textEditorModal.editor.focus(); };
        });
        textEditorModal.editor.oninput = () => { hasUnsavedChanges = true; updateStatusBar(); };
        document.onselectionchange = () => {
            if (!textEditorModal.pane.contains(document.activeElement)) return;
            toolbarContainer.querySelectorAll('button[data-command]').forEach(button => {
                document.queryCommandState(button.dataset.command) ? button.classList.add('active') : button.classList.remove('active');
            });
        };
    }

    function updateStatusBar() {
        const text = textEditorModal.editor.innerText;
        document.getElementById('word-count').textContent = `Palavras: ${text.trim() === '' ? 0 : text.trim().split(/\s+/).length}`;
        document.getElementById('char-count').textContent = `Caracteres: ${text.length}`;
    }

    function saveTextFile() {
        if (activeNode && activeNode.subtype === 'text') {
            const now = Date.now();
            activeNode.content = textEditorModal.editor.innerHTML;
            activeNode.updatedAt = now;
            findParentNode(activeNode.id).updatedAt = now;
            saveFileSystem();
            hasUnsavedChanges = false;
            
            const btn = textEditorModal.saveBtn;
            btn.innerHTML = '<i class="fas fa-check"></i> Salvo!';
            btn.classList.add('saved');
            setTimeout(() => {
                btn.innerHTML = '<i class="fas fa-save"></i> Salvar';
                btn.classList.remove('saved');
            }, 2000);
        }
    }

    // --- LÓGICA DO EDITOR DE PLANILHA ---

    function openSpreadsheetEditor(node) {
        activeNode = node;
        hasUnsavedChanges = false;
        spreadsheetEditorModal.title.textContent = node.name;
        renderSpreadsheetTable(spreadsheetEditorModal.container, node.content);
        spreadsheetEditorModal.pane.classList.remove('hidden');
        
        spreadsheetEditorModal.downloadBtn.onclick = () => downloadSpreadsheetFile(activeNode, true);
        spreadsheetEditorModal.saveBtn.onclick = saveSpreadsheetFile;
    }

    async function closeSpreadsheetEditorModal() {
        if (hasUnsavedChanges) {
            const confirmed = await showConfirmModal('Alterações Não Salvas', 'Você tem alterações não salvas que serão perdidas. Deseja sair mesmo assim?');
            if (!confirmed) return;
        }
        spreadsheetEditorModal.pane.classList.add('hidden');
        spreadsheetEditorModal.container.innerHTML = '';
        activeNode = null;
        hasUnsavedChanges = false;
        render();
    }
    
    function renderSpreadsheetTable(container, data) {
        container.innerHTML = '';
        const table = document.createElement('table');
        table.className = 'spreadsheet-table';

        const cols = data.length > 0 && data[0] ? data[0].length : 8;

        const thead = document.createElement('thead');
        const headerRow = document.createElement('tr');
        const emptyTh = document.createElement('th');
        headerRow.appendChild(emptyTh);
        for (let i = 0; i < cols; i++) {
            const th = document.createElement('th');
            th.textContent = String.fromCharCode(65 + i);
            headerRow.appendChild(th);
        }
        thead.appendChild(headerRow);
        table.appendChild(thead);

        const tbody = document.createElement('tbody');
        data.forEach((rowData, rowIndex) => {
            const tr = document.createElement('tr');
            const rowHeaderTd = document.createElement('td');
            rowHeaderTd.textContent = rowIndex + 1;
            rowHeaderTd.style.fontWeight = '600';
            rowHeaderTd.style.backgroundColor = 'var(--color-bg-hover)';
            tr.appendChild(rowHeaderTd);

            rowData.forEach((cellData, colIndex) => {
                const td = document.createElement('td');
                td.textContent = cellData;
                td.contentEditable = true;
                td.dataset.row = rowIndex;
                td.dataset.col = colIndex;
                td.addEventListener('input', () => { hasUnsavedChanges = true; });
                
                if (rowIndex === data.length - 1) {
                    td.addEventListener('focus', (e) => {
                        const currentData = readSpreadsheetFromTable();
                        if (activeNode && currentData.length === activeNode.content.length) {
                             activeNode.content.push(Array(cols).fill(''));
                             renderSpreadsheetTable(container, activeNode.content);
                             const newFocusedCell = container.querySelector(`td[data-row="${e.target.dataset.row}"][data-col="${e.target.dataset.col}"]`);
                             newFocusedCell?.focus();
                        }
                    }, { once: true });
                }
                tr.appendChild(td);
            });
            tbody.appendChild(tr);
        });
        table.appendChild(tbody);
        container.appendChild(table);
    }
    
    function handleSpreadsheetPaste(event) {
        const targetCell = event.target.closest('td[contenteditable="true"]');
        if (!targetCell) return;

        event.preventDefault();
        const pastedText = (event.clipboardData || window.clipboardData).getData('text/plain');
        
        const rows = pastedText.split(/\r?\n/).filter(row => row);
        if (rows.length === 0) return;

        const parsedData = rows.map(row => row.split('\t'));

        const startRow = parseInt(targetCell.dataset.row, 10);
        const startCol = parseInt(targetCell.dataset.col, 10);

        if (isNaN(startRow) || isNaN(startCol)) return;

        let currentData = activeNode.content;
        const requiredRows = startRow + parsedData.length;
        let maxCols = currentData.length > 0 && currentData[0] ? currentData[0].length : 0;

        parsedData.forEach(row => { maxCols = Math.max(maxCols, startCol + row.length); });
        while (currentData.length < requiredRows) { currentData.push(Array(maxCols).fill('')); }
        currentData.forEach(row => { while (row.length < maxCols) { row.push(''); } });
        
        parsedData.forEach((rowData, r_idx) => {
            rowData.forEach((cellData, c_idx) => {
                const target_r = startRow + r_idx;
                const target_c = startCol + c_idx;
                if(currentData[target_r] !== undefined) {
                    currentData[target_r][target_c] = cellData;
                }
            });
        });
        
        hasUnsavedChanges = true;
        renderSpreadsheetTable(spreadsheetEditorModal.container, currentData);
    }
    
    function readSpreadsheetFromTable() {
        const table = spreadsheetEditorModal.container.querySelector('table');
        const data = [];
        if (!table) return data;
        table.querySelectorAll('tbody tr').forEach(tr => {
            const rowData = [];
            tr.querySelectorAll('td[contenteditable="true"]').forEach(td => {
                rowData.push(td.innerText);
            });
            data.push(rowData);
        });
        return data;
    }
    
    function saveSpreadsheetFile() {
        if (activeNode && activeNode.subtype === 'spreadsheet') {
            let newData = readSpreadsheetFromTable();
            while (newData.length > 1 && newData[newData.length - 1].every(cell => cell.trim() === '')) {
                newData.pop();
            }
            activeNode.content = newData;

            const now = Date.now();
            activeNode.updatedAt = now;
            findParentNode(activeNode.id).updatedAt = now;
            saveFileSystem();
            hasUnsavedChanges = false;

            const btn = spreadsheetEditorModal.saveBtn;
            btn.innerHTML = '<i class="fas fa-check"></i> Salvo!';
            btn.classList.add('saved');
            setTimeout(() => {
                btn.innerHTML = '<i class="fas fa-save"></i> Salvar';
                btn.classList.remove('saved');
            }, 2000);
        }
    }
    
    // --- LÓGICA DE NAVEGAÇÃO DE PÁGINAS ESTÁTICAS ---
    function setupNavigation() {
        const backButtonHtml = `<a href="#" class="back-to-app-btn"><i class="fas fa-arrow-left"></i> Voltar ao Organizador</a>`;
    
        staticPageContainers.privacy.innerHTML = `
            <h1>Política de Privacidade</h1>
            <p><strong>Última atualização:</strong> ${new Date().toLocaleDateString('pt-BR')}</p>
            <p>A sua privacidade é importante para nós. É política do Organizador de Arquivos respeitar a sua privacidade em relação a qualquer informação sua que possamos coletar em nosso site.</p>
            <h2>1. Informações que Coletamos</h2>
            <p>Este aplicativo é uma ferramenta que funciona inteiramente no seu navegador (client-side). Todas as informações, arquivos e estruturas de pastas que você cria são armazenados localmente no seu dispositivo, utilizando a tecnologia de <strong>LocalStorage</strong> do seu navegador.</p>
            <p><strong>Nós não coletamos, transmitimos, armazenamos ou temos acesso a nenhum dos seus dados.</strong> Toda a sua informação permanece exclusivamente no seu computador.</p>
            <h2>2. Como Usamos as Informações</h2>
            <p>Como não coletamos suas informações, nós não as usamos para nenhum propósito. A funcionalidade de "Resetar Sistema" simplesmente limpa os dados do LocalStorage do seu navegador para este site, uma ação que você mesmo executa.</p>
            <h2>3. Segurança</h2>
            <p>A segurança dos seus dados depende da segurança do seu próprio computador e navegador. Recomendamos manter seu sistema operacional e navegador atualizados. Como os dados não são enviados pela internet, eles estão protegidos contra interceptação online.</p>
            <h2>4. Links para Outros Sites</h2>
            <p>Nosso site pode conter links para sites externos que não são operados por nós. Esteja ciente de que não temos controle sobre o conteúdo e práticas desses sites e não podemos aceitar responsabilidade por suas respectivas políticas de privacidade.</p>
            <h2>5. Alterações nesta Política de Privacidade</h2>
            <p>Podemos atualizar nossa Política de Privacidade de tempos em tempos. Aconselhamos que você revise esta página periodicamente para quaisquer alterações. A data da última atualização será sempre indicada no topo desta página.</p>
            ${backButtonHtml}`;
    
        staticPageContainers.terms.innerHTML = `
            <h1>Termos de Uso</h1>
            <p><strong>Última atualização:</strong> ${new Date().toLocaleDateString('pt-BR')}</p>
            <p>Ao acessar e usar o site Organizador de Arquivos, você concorda em cumprir estes termos de serviço, todas as leis e regulamentos aplicáveis e concorda que é responsável pelo cumprimento de todas as leis locais aplicáveis.</p>
            <h2>1. Uso da Licença</h2>
            <p>É concedida permissão para usar o aplicativo Organizador de Arquivos para fins pessoais e comerciais. Esta é a concessão de uma licença, não uma transferência de título, e sob esta licença você não pode:</p>
            <ul>
                <li>Tentar descompilar ou fazer engenharia reversa de qualquer software contido no site;</li>
                <li>Remover quaisquer direitos autorais ou outras notações de propriedade dos materiais.</li>
            </ul>
            <p>Esta licença será automaticamente rescindida se você violar alguma dessas restrições e poderá ser rescindida por nós a qualquer momento.</p>
            <h2>2. Isenção de Responsabilidade</h2>
            <p>O Organizador de Arquivos é fornecido "como está". Não oferecemos garantias, expressas ou implícitas, e por este meio isentamos e negamos todas as outras garantias, incluindo, sem limitação, garantias implícitas ou condições de comercialização, adequação a um fim específico ou não violação de propriedade intelectual ou outra violação de direitos.</p>
            <p>Como todos os dados são armazenados localmente no seu dispositivo, não nos responsabilizamos por qualquer perda de dados. É sua responsabilidade garantir backups adequados, se necessário.</p>
            <h2>3. Limitações</h2>
            <p>Em nenhum caso o Organizador de Arquivos ou seus fornecedores serão responsáveis por quaisquer danos (incluindo, sem limitação, danos por perda de dados ou lucro, ou devido a interrupção dos negócios) decorrentes do uso ou da incapacidade de usar os materiais no site, mesmo que o Organizador de Arquivos ou um representante autorizado tenha sido notificado oralmente ou por escrito da possibilidade de tais danos.</p>
            <h2>4. Lei Aplicável</h2>
            <p>Estes termos e condições são regidos e interpretados de acordo com as leis do Brasil e você se submete irrevogavelmente à jurisdição exclusiva dos tribunais naquele estado ou localidade.</p>
            ${backButtonHtml}`;
    
        staticPageContainers.contact.innerHTML = `
            <h1>Página de Contato</h1>
            <p>Tem alguma dúvida, sugestão ou feedback? Adoraríamos ouvir de você. Por favor, preencha o formulário abaixo. Como este é um projeto de demonstração sem um servidor backend, o formulário simulará o envio e oferecerá uma opção de envio por e-mail.</p>
            <form id="contact-form" class="contact-form">
                <div class="form-group">
                    <label for="contact-name">Seu Nome</label>
                    <input type="text" id="contact-name" class="form-control" required>
                </div>
                <div class="form-group">
                    <label for="contact-email">Seu Email</label>
                    <input type="email" id="contact-email" class="form-control" required>
                </div>
                <div class="form-group">
                    <label for="contact-message">Mensagem</label>
                    <textarea id="contact-message" class="form-control" required></textarea>
                </div>
                <button type="submit" class="submit-btn">Enviar Mensagem</button>
            </form>
            <div id="contact-success-message" class="hidden">
                <p><strong>Obrigado pelo seu contato!</strong></p>
                <p>Esta é uma aplicação de demonstração e sua mensagem não foi enviada para um servidor. Para entrar em contato real, por favor, envie um e-mail para <a href="mailto:contato@exemplo.com">contato@exemplo.com</a> com o conteúdo da sua mensagem.</p>
                <a href="#" id="reset-contact-form" style="display: inline-block; margin-top: 1em;">Enviar outra mensagem</a>
            </div>
            ${backButtonHtml}`;
    
        staticPageContainers.cookies.innerHTML = `
            <h1>Política de Cookies</h1>
            <p><strong>Última atualização:</strong> ${new Date().toLocaleDateString('pt-BR')}</p>
            <p>Este site utiliza tecnologias de armazenamento local do navegador para fornecer suas funcionalidades essenciais. Esta página explica o que são essas tecnologias e como as usamos.</p>
            <h2>1. O que é LocalStorage?</h2>
            <p>LocalStorage é um mecanismo de armazenamento da web que permite que sites e aplicativos salvem dados (pares chave/valor) em um navegador da web sem data de expiração. Isso significa que os dados armazenados no navegador persistirão mesmo depois que a janela do navegador for fechada.</p>
            <p>É funcionalmente semelhante a cookies, mas é usado especificamente para armazenar dados do lado do cliente e não é enviado automaticamente para um servidor a cada solicitação HTTP, tornando-o mais seguro e eficiente para aplicações que rodam inteiramente no navegador, como esta.</p>
            <h2>2. Como Usamos o LocalStorage</h2>
            <p>Nós usamos o LocalStorage para uma única finalidade:</p>
            <ul>
                <li><strong>Salvar seu Sistema de Arquivos:</strong> Toda a estrutura de pastas, arquivos e seu conteúdo que você cria no Organizador de Arquivos são salvos no LocalStorage do seu navegador. Isso permite que você feche a página e, ao retornar, encontre seu trabalho exatamente como o deixou.</li>
            </ul>
            <h2>3. Cookies de Terceiros</h2>
            <p>Este site <strong>não utiliza</strong> cookies de terceiros para rastreamento, publicidade ou análise. Todo o código e os recursos (como fontes e ícones) são carregados de redes de distribuição de conteúdo (CDNs) conhecidas, mas não definem cookies de rastreamento por meio do nosso site.</p>
            <h2>4. Gerenciando Seus Dados</h2>
            <p>Você tem controle total sobre os dados armazenados. Você pode:</p>
            <ul>
                <li>Usar a função "Resetar Sistema" dentro do aplicativo para apagar todos os dados relacionados a este site.</li>
                <li>Limpar manualmente o cache e os dados do site através das configurações do seu navegador.</li>
            </ul>
            ${backButtonHtml}`;
    
        function showPage(pageKey) {
            window.scrollTo(0, 0);

            if (pageKey === 'app') {
                mainAppContainer.classList.remove('view-hidden');
                pageViewContainer.classList.add('view-hidden');
                 Object.values(staticPageContainers).forEach(p => p.classList.remove('active'));
            } else {
                mainAppContainer.classList.add('view-hidden');
                pageViewContainer.classList.remove('view-hidden');
                
                Object.values(staticPageContainers).forEach(p => p.classList.remove('active'));
                
                if (staticPageContainers[pageKey]) {
                    staticPageContainers[pageKey].classList.add('active');
                }
            }
        }
    
        navLinks.privacy.addEventListener('click', (e) => { e.preventDefault(); showPage('privacy'); });
        navLinks.terms.addEventListener('click', (e) => { e.preventDefault(); showPage('terms'); });
        navLinks.contact.addEventListener('click', (e) => { e.preventDefault(); showPage('contact'); });
        navLinks.cookies.addEventListener('click', (e) => { e.preventDefault(); showPage('cookies'); });
    
        document.body.addEventListener('click', (e) => {
            if (e.target.matches('.back-to-app-btn') || e.target.closest('.back-to-app-btn')) {
                e.preventDefault();
                showPage('app');
            }
        });
        
        const contactForm = document.getElementById('contact-form');
        const successMessage = document.getElementById('contact-success-message');
        const resetContactBtn = document.getElementById('reset-contact-form');

        if (contactForm && successMessage && resetContactBtn) {
            contactForm.addEventListener('submit', (e) => {
                e.preventDefault();
                successMessage.classList.remove('hidden');
                contactForm.classList.add('hidden');
            });
            resetContactBtn.addEventListener('click', (e) => {
                e.preventDefault();
                contactForm.reset();
                successMessage.classList.add('hidden');
                contactForm.classList.remove('hidden');
            });
        }

        // Inicia mostrando a aplicação principal
        showPage('app');
    }

    init();
});
