class DocumentDB {
    constructor() {
        this.documents = new Map();
        this.folders = new Map();
        this.nextDocId = 1;
        this.nextFolderId = 1;
    }

    async init() {
        // Load from localStorage if available
        const savedDocs = localStorage.getItem('documents');
        const savedFolders = localStorage.getItem('folders');
        
        if (savedDocs) {
            const docs = JSON.parse(savedDocs);
            docs.forEach(doc => {
                this.documents.set(doc.id, doc);
                if (doc.id >= this.nextDocId) {
                    this.nextDocId = doc.id + 1;
                }
            });
        }
        
        if (savedFolders) {
            const folders = JSON.parse(savedFolders);
            folders.forEach(folder => {
                this.folders.set(folder.id, folder);
                if (folder.id >= this.nextFolderId) {
                    this.nextFolderId = folder.id + 1;
                }
            });
        }
    }

    async save() {
        localStorage.setItem('documents', JSON.stringify(Array.from(this.documents.values())));
        localStorage.setItem('folders', JSON.stringify(Array.from(this.folders.values())));
    }

    async createDocument(title, content) {
        const doc = {
            id: this.nextDocId++,
            title,
            content,
            created: Date.now(),
            modified: Date.now(),
            folderId: null
        };
        this.documents.set(doc.id, doc);
        await this.save();
        return doc;
    }

    async getDocument(id) {
        return this.documents.get(id);
    }

    async updateDocument(id, updates) {
        const doc = this.documents.get(id);
        if (!doc) throw new Error('Document not found');

        Object.assign(doc, updates, { modified: Date.now() });
        await this.save();
        return doc;
    }

    async deleteDocument(id) {
        const result = this.documents.delete(id);
        if (result) await this.save();
        return result;
    }

    async getAllDocuments() {
        return Array.from(this.documents.values());
    }

    async createFolder(name) {
        const folder = {
            id: this.nextFolderId++,
            name,
            created: Date.now()
        };
        this.folders.set(folder.id, folder);
        await this.save();
        return folder;
    }

    async getFolder(id) {
        return this.folders.get(id);
    }

    async updateFolder(id, updates) {
        const folder = this.folders.get(id);
        if (!folder) throw new Error('Folder not found');

        Object.assign(folder, updates);
        await this.save();
        return folder;
    }

    async deleteFolder(id) {
        // Delete all documents in the folder
        for (const doc of this.documents.values()) {
            if (doc.folderId === id) {
                this.documents.delete(doc.id);
            }
        }

        const result = this.folders.delete(id);
        if (result) await this.save();
        return result;
    }

    async getAllFolders() {
        return Array.from(this.folders.values());
    }
}
